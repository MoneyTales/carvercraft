import * as THREE from "three";
import { B, BLOCKS, isOpaque } from "./blocks";
import { CHUNK, SY, VoxelWorld } from "./world";
import { getAtlas } from "./atlas";

// Culled mesher with per-vertex ambient occlusion.

interface FaceDef {
  n: [number, number, number];
  /** 4 corners CCW from outside; each [x,y,z] offset 0|1 */
  c: [number, number, number][];
  tile: 0 | 1 | 2; // top/side/bottom index into BlockDef.tiles
}

const FACES: FaceDef[] = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], tile: 1 },  // +X
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], tile: 1 }, // -X
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], tile: 0 },  // +Y
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], tile: 2 }, // -Y
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], tile: 1 },  // +Z
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], tile: 1 }, // -Z
];

const AO_LEVELS = [0.45, 0.62, 0.8, 1.0];

/** corner AO: occluders are the two edge-neighbors + corner cell on the face plane */
function vertexAO(world: VoxelWorld, x: number, y: number, z: number, n: [number, number, number], corner: [number, number, number]): number {
  const [nx, ny, nz] = n;
  // cell just outside the face
  const ox = x + nx, oy = y + ny, oz = z + nz;
  // signed corner direction within the face plane (-1 or +1 per in-plane axis)
  const sx = nx !== 0 ? 0 : (corner[0] === 1 ? 1 : -1);
  const sy = ny !== 0 ? 0 : (corner[1] === 1 ? 1 : -1);
  const sz = nz !== 0 ? 0 : (corner[2] === 1 ? 1 : -1);

  let side1: boolean, side2: boolean, cornerOcc: boolean;
  if (nx !== 0) {
    side1 = isOpaque(world.get(ox, oy + sy, oz));
    side2 = isOpaque(world.get(ox, oy, oz + sz));
    cornerOcc = isOpaque(world.get(ox, oy + sy, oz + sz));
  } else if (ny !== 0) {
    side1 = isOpaque(world.get(ox + sx, oy, oz));
    side2 = isOpaque(world.get(ox, oy, oz + sz));
    cornerOcc = isOpaque(world.get(ox + sx, oy, oz + sz));
  } else {
    side1 = isOpaque(world.get(ox + sx, oy, oz));
    side2 = isOpaque(world.get(ox, oy + sy, oz));
    cornerOcc = isOpaque(world.get(ox + sx, oy + sy, oz));
  }
  if (side1 && side2) return 0;
  return 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (cornerOcc ? 1 : 0));
}

class GeoBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  v = 0;

  quad(face: FaceDef, x: number, y: number, z: number, ao: [number, number, number, number], rect: { u0: number; v0: number; u1: number; v1: number }): void {
    const { n, c } = face;
    const uvs = [
      [rect.u0, rect.v0],
      [rect.u1, rect.v0],
      [rect.u1, rect.v1],
      [rect.u0, rect.v1],
    ];
    for (let i = 0; i < 4; i++) {
      this.pos.push(x + c[i][0], y + c[i][1], z + c[i][2]);
      this.nrm.push(n[0], n[1], n[2]);
      const l = AO_LEVELS[ao[i]];
      this.col.push(l, l, l);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
    // flip quad diagonal for AO anisotropy
    if (ao[0] + ao[2] >= ao[1] + ao[3]) {
      this.idx.push(this.v, this.v + 1, this.v + 2, this.v, this.v + 2, this.v + 3);
    } else {
      this.idx.push(this.v + 1, this.v + 2, this.v + 3, this.v + 1, this.v + 3, this.v);
    }
    this.v += 4;
  }

  build(): THREE.BufferGeometry | null {
    if (this.v === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export interface ChunkGeo {
  solid: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
}

export function meshChunk(world: VoxelWorld, cx: number, cz: number): ChunkGeo {
  const atlas = getAtlas();
  const solid = new GeoBuilder();
  const water = new GeoBuilder();
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const NO_AO: [number, number, number, number] = [3, 3, 3, 3];

  for (let x = x0; x < x0 + CHUNK; x++) {
    for (let z = z0; z < z0 + CHUNK; z++) {
      for (let y = 0; y < SY; y++) {
        const b = world.get(x, y, z);
        if (b === B.AIR) continue;
        const def = BLOCKS[b];

        if (b === B.WATER) {
          for (const face of FACES) {
            const n = world.get(x + face.n[0], y + face.n[1], z + face.n[2]);
            if (n === B.WATER || isOpaque(n)) continue;
            if (n !== B.AIR && face.n[1] !== 1) continue; // sides only vs air
            const rect = atlas.uv("water");
            water.quad(face, x, y, z, NO_AO, rect);
          }
          continue;
        }

        for (const face of FACES) {
          const n = world.get(x + face.n[0], y + face.n[1], z + face.n[2]);
          if (n === b) continue;           // same-type neighbors merge visually
          if (isOpaque(n)) continue;       // hidden face
          const rect = atlas.uv(def.tiles[face.tile]);
          const ao: [number, number, number, number] = [0, 0, 0, 0];
          for (let i = 0; i < 4; i++) ao[i] = vertexAO(world, x, y, z, face.n, face.c[i]);
          solid.quad(face, x, y, z, ao, rect);
        }
      }
    }
  }

  return { solid: solid.build(), water: water.build() };
}

/** Single unit-cube geometry for a block (viewmodel / held item). Centered at origin. */
export function blockPreviewGeometry(blockId: number): THREE.BufferGeometry {
  const atlas = getAtlas();
  const def = BLOCKS[blockId] ?? BLOCKS[B.STONE];
  const b = new GeoBuilder();
  const NO_AO: [number, number, number, number] = [3, 3, 3, 3];
  for (const face of FACES) {
    b.quad(face, 0, 0, 0, NO_AO, atlas.uv(def.tiles[face.tile]));
  }
  const g = b.build()!;
  g.translate(-0.5, -0.5, -0.5);
  return g;
}
