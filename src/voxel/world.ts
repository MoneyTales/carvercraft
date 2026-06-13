import { B, isSolid, isTargetable } from "./blocks";
import { CHUNK, SY, genChunk } from "./worldgen";

export { CHUNK, SY, WATER_Y } from "./worldgen";

// Infinite, sparse, chunked voxel world. Chunks generate on demand from the
// shared seed; player edits live in a per-chunk overlay so evicted chunks
// regenerate identically (terrain from seed + overlay replay).

export const ckey = (cx: number, cz: number): string => `${cx},${cz}`;

export interface RayHit {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  block: number;
}

const lidx = (lx: number, y: number, lz: number): number => (lx * CHUNK + lz) * SY + y;
const fdiv = (a: number, b: number): number => Math.floor(a / b);

export class VoxelWorld {
  readonly seed: number;
  private chunks = new Map<string, Uint8Array>();
  private overlay = new Map<string, Map<number, number>>(); // edits, survive eviction
  private dirty = new Set<string>();
  private listeners: Array<(dirtyChunks: string[]) => void> = [];

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  isGenerated(cx: number, cz: number): boolean {
    return this.chunks.has(ckey(cx, cz));
  }

  ensureChunk(cx: number, cz: number): Uint8Array {
    const k = ckey(cx, cz);
    let data = this.chunks.get(k);
    if (data) return data;
    data = new Uint8Array(CHUNK * CHUNK * SY);
    genChunk(data, cx, cz, this.seed);
    const ov = this.overlay.get(k);
    if (ov) for (const [li, b] of ov) data[li] = b;
    this.chunks.set(k, data);
    return data;
  }

  /** Drop chunk data beyond `radius` chunks of (cx, cz). Edits are kept. */
  evict(cx: number, cz: number, radius: number): void {
    for (const k of [...this.chunks.keys()]) {
      const [kx, kz] = k.split(",").map(Number);
      if (Math.max(Math.abs(kx - cx), Math.abs(kz - cz)) > radius) {
        this.chunks.delete(k);
      }
    }
  }

  get(x: number, y: number, z: number): number {
    if (y < 0 || y >= SY) return B.AIR;
    const data = this.chunks.get(ckey(fdiv(x, CHUNK), fdiv(z, CHUNK)));
    if (!data) return B.AIR;
    return data[lidx(x - fdiv(x, CHUNK) * CHUNK, y, z - fdiv(z, CHUNK) * CHUNK)];
  }

  solidAt(x: number, y: number, z: number): boolean {
    if (y < 0) return true;
    if (y >= SY) return false;
    const cx = fdiv(x, CHUNK);
    const cz = fdiv(z, CHUNK);
    const data = this.chunks.get(ckey(cx, cz));
    if (!data) return true; // ungenerated chunks fence the player in
    return isSolid(data[lidx(x - cx * CHUNK, y, z - cz * CHUNK)]);
  }

  /** Set a block (generates the chunk if needed). Returns true if changed. */
  set(x: number, y: number, z: number, b: number): boolean {
    if (y < 0 || y >= SY) return false;
    const cx = fdiv(x, CHUNK);
    const cz = fdiv(z, CHUNK);
    const data = this.ensureChunk(cx, cz);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    const i = lidx(lx, y, lz);
    if (data[i] === b) return false;
    data[i] = b;

    const k = ckey(cx, cz);
    let ov = this.overlay.get(k);
    if (!ov) {
      ov = new Map();
      this.overlay.set(k, ov);
    }
    ov.set(i, b);

    this.dirty.add(k);
    if (lx === 0) this.dirty.add(ckey(cx - 1, cz));
    if (lx === CHUNK - 1) this.dirty.add(ckey(cx + 1, cz));
    if (lz === 0) this.dirty.add(ckey(cx, cz - 1));
    if (lz === CHUNK - 1) this.dirty.add(ckey(cx, cz + 1));
    return true;
  }

  flushDirty(): void {
    if (this.dirty.size === 0) return;
    const list = [...this.dirty];
    this.dirty.clear();
    for (const l of this.listeners) l(list);
  }

  onDirty(cb: (chunks: string[]) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /** Highest solid block y at column (generates the chunk), or -1 */
  heightAt(x: number, z: number): number {
    this.ensureChunk(fdiv(x, CHUNK), fdiv(z, CHUNK));
    for (let y = SY - 1; y >= 0; y--) {
      if (isSolid(this.get(x, y, z))) return y;
    }
    return -1;
  }

  // ── Voxel raycast (Amanatides & Woo DDA) ────────────────────────────────

  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): RayHit | null {
    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = dx !== 0 ? (dx > 0 ? (x + 1 - ox) : (ox - x)) * tDeltaX : Infinity;
    let tMaxY = dy !== 0 ? (dy > 0 ? (y + 1 - oy) : (oy - y)) * tDeltaY : Infinity;
    let tMaxZ = dz !== 0 ? (dz > 0 ? (z + 1 - oz) : (oz - z)) * tDeltaZ : Infinity;
    let nx = 0, ny = 0, nz = 0;
    let t = 0;

    while (t <= maxDist) {
      const b = this.get(x, y, z);
      if (isTargetable(b)) return { x, y, z, nx, ny, nz, block: b };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
      if (y < 0 || y >= SY) return null;
    }
    return null;
  }
}
