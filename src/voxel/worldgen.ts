import { B } from "./blocks";
import { fbm2, hash2 } from "./noise";

// Pure, deterministic, infinite terrain functions. Every value depends only
// on (x, z, seed) so any peer can generate any chunk independently and get
// identical results — no terrain data ever crosses the network.

export const CHUNK = 16;
export const SY = 64;
export const WATER_Y = 21;

/** Terrain height for a column, same on every peer. */
export function terrainHeight(x: number, z: number, seed: number): number {
  const cont = fbm2(x * 0.0035, z * 0.0035, seed ^ 0xabcdef, 3); // continents
  const hills = fbm2(x * 0.015, z * 0.015, seed, 4); // rolling terrain
  const ridg = fbm2(x * 0.05 + 97, z * 0.05 + 31, seed ^ 0x9e3779b9, 3); // peaks
  const land = Math.max(0, cont - 0.38) / 0.62; // 0 deep ocean -> 1 inland
  const h = 8 + cont * 14 + land * (hills * 18 + ridg * ridg * 26);
  return Math.min(SY - 8, Math.floor(h));
}

/** Tree trunk height at a column, or 0 if no tree grows here. */
export function treeAt(x: number, z: number, seed: number): number {
  if (hash2(x, z, seed ^ 0x5bd1e995) > 0.009) return 0;
  const h = terrainHeight(x, z, seed);
  if (h <= WATER_Y + 1 || h >= 40) return 0; // grass band only
  return 4 + Math.floor(hash2(z, x, seed) * 3);
}

const idx = (lx: number, y: number, lz: number): number => (lx * CHUNK + lz) * SY + y;

/** Generate one 16x64x16 chunk into `data` (chunk-local layout). */
export function genChunk(data: Uint8Array, cx: number, cz: number, seed: number): void {
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;

  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const x = x0 + lx;
      const z = z0 + lz;
      const h = terrainHeight(x, z, seed);
      for (let y = 0; y <= h; y++) {
        let b: number;
        if (y === 0) b = B.BEDROCK;
        else if (y < h - 3) b = B.STONE;
        else if (y < h) b = B.DIRT;
        else if (h <= WATER_Y + 1) b = B.SAND;
        else if (h >= 44) b = B.SNOW;
        else b = B.GRASS;
        data[idx(lx, y, lz)] = b;
      }
      if (h < WATER_Y) {
        for (let y = h + 1; y <= WATER_Y; y++) data[idx(lx, y, lz)] = B.WATER;
      }
    }
  }

  // Trees: scan anchors up to 2 columns outside this chunk so canopies that
  // spill across chunk borders are written identically by both chunks.
  for (let ax = x0 - 2; ax < x0 + CHUNK + 2; ax++) {
    for (let az = z0 - 2; az < z0 + CHUNK + 2; az++) {
      const trunk = treeAt(ax, az, seed);
      if (!trunk) continue;
      const base = terrainHeight(ax, az, seed) + 1;
      const top = base + trunk;
      if (top + 2 >= SY) continue;

      const put = (wx: number, wy: number, wz: number, b: number, onlyAir: boolean) => {
        const lx = wx - x0;
        const lz = wz - z0;
        if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy < 0 || wy >= SY) return;
        const i = idx(lx, wy, lz);
        if (onlyAir && data[i] !== B.AIR) return;
        data[i] = b;
      };

      for (let ly = top - 2; ly <= top + 1; ly++) {
        const r = ly >= top ? 1 : 2;
        for (let ox = -r; ox <= r; ox++) {
          for (let oz = -r; oz <= r; oz++) {
            if (Math.abs(ox) === r && Math.abs(oz) === r && r === 2) continue;
            put(ax + ox, ly, az + oz, B.LEAVES, true);
          }
        }
      }
      for (let ty = base; ty < top; ty++) put(ax, ty, az, B.LOG, false);
    }
  }
}
