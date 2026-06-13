import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameLoop } from "@carverjs/core/hooks";
import { CHUNK, VoxelWorld, ckey } from "./world";
import { meshChunk } from "./mesher";
import { getAtlas } from "./atlas";
import { rig } from "../game/rig";

// Streaming chunk manager: generates terrain, meshes, and unloads around the
// player as they move — Minecraft-style infinite world.

const R_GEN = 9;    // generate terrain within this chunk radius
const R_MESH = 8;   // mesh within this radius (needs neighbors generated)
const R_UNLOAD = 11; // drop meshes beyond this radius
const R_EVICT = 16; // drop chunk DATA beyond this radius (edits survive)
const GEN_BUDGET = 3;  // chunks generated per frame
const MESH_BUDGET = 2; // chunks meshed per frame

/** chunk offsets within R_GEN, nearest first */
const OFFSETS: [number, number][] = (() => {
  const list: [number, number][] = [];
  for (let dx = -R_GEN; dx <= R_GEN; dx++) {
    for (let dz = -R_GEN; dz <= R_GEN; dz++) list.push([dx, dz]);
  }
  list.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
  return list;
})();

interface ChunkMeshes {
  solid: THREE.Mesh | null;
  water: THREE.Mesh | null;
}

export function VoxelTerrain({ world }: { world: VoxelWorld }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshes = useRef(new Map<string, ChunkMeshes>());
  const dirtyQueue = useRef(new Set<string>());
  const sweepTimer = useRef(0);

  const materials = useMemo(() => {
    const atlas = getAtlas();
    return {
      solid: new THREE.MeshLambertMaterial({
        map: atlas.texture,
        vertexColors: true,
        alphaTest: 0.5,
      }),
      water: new THREE.MeshLambertMaterial({
        map: atlas.texture,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };
  }, []);

  useEffect(() => {
    const unsub = world.onDirty((chunks) => {
      for (const k of chunks) dirtyQueue.current.add(k);
    });
    const group = groupRef.current;
    const all = meshes.current;
    return () => {
      unsub();
      for (const entry of all.values()) disposeEntry(group, entry);
      all.clear();
    };
  }, [world]);

  function disposeEntry(group: THREE.Group | null, entry: ChunkMeshes): void {
    for (const m of [entry.solid, entry.water]) {
      if (m) {
        group?.remove(m);
        m.geometry.dispose();
      }
    }
  }

  function buildChunk(cx: number, cz: number): void {
    const group = groupRef.current;
    if (!group) return;
    const k = ckey(cx, cz);
    const prev = meshes.current.get(k);
    if (prev) disposeEntry(group, prev);
    const geo = meshChunk(world, cx, cz);
    const entry: ChunkMeshes = { solid: null, water: null };
    if (geo.solid) {
      entry.solid = new THREE.Mesh(geo.solid, materials.solid);
      group.add(entry.solid);
    }
    if (geo.water) {
      entry.water = new THREE.Mesh(geo.water, materials.water);
      entry.water.renderOrder = 1;
      group.add(entry.water);
    }
    meshes.current.set(k, entry);
  }

  useGameLoop((dt) => {
    const pcx = Math.floor(rig.pos.x / CHUNK);
    const pcz = Math.floor(rig.pos.z / CHUNK);

    // 1. generate terrain, nearest first
    let gen = GEN_BUDGET;
    for (const [dx, dz] of OFFSETS) {
      if (!world.isGenerated(pcx + dx, pcz + dz)) {
        world.ensureChunk(pcx + dx, pcz + dz);
        if (--gen === 0) break;
      }
    }

    // 2. remesh edited chunks immediately (edits are few and local)
    if (dirtyQueue.current.size > 0) {
      for (const k of dirtyQueue.current) {
        if (meshes.current.has(k)) {
          const [cx, cz] = k.split(",").map(Number);
          buildChunk(cx, cz);
        }
      }
      dirtyQueue.current.clear();
    }

    // 3. mesh new chunks, nearest first, once their neighbors exist
    let mesh = MESH_BUDGET;
    for (const [dx, dz] of OFFSETS) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) > R_MESH) continue;
      const cx = pcx + dx;
      const cz = pcz + dz;
      if (meshes.current.has(ckey(cx, cz))) continue;
      if (
        !world.isGenerated(cx, cz) ||
        !world.isGenerated(cx - 1, cz) || !world.isGenerated(cx + 1, cz) ||
        !world.isGenerated(cx, cz - 1) || !world.isGenerated(cx, cz + 1)
      ) continue;
      buildChunk(cx, cz);
      if (--mesh === 0) break;
    }

    // 4. periodic unload + data eviction
    sweepTimer.current += dt;
    if (sweepTimer.current > 1.5) {
      sweepTimer.current = 0;
      for (const [k, entry] of meshes.current) {
        const [cx, cz] = k.split(",").map(Number);
        if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > R_UNLOAD) {
          disposeEntry(groupRef.current, entry);
          meshes.current.delete(k);
        }
      }
      world.evict(pcx, pcz, R_EVICT);
    }
  });

  return <group ref={groupRef} />;
}
