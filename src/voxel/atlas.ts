import * as THREE from "three";
import { BLOCKS } from "./blocks";
import { mulberry32 } from "./noise";

// Procedural 16px texture atlas — zero asset files, deterministic on every peer.

const T = 16; // tile px
const GRID = 8; // 8x8 tiles
const SIZE = T * GRID;

export interface UVRect { u0: number; v0: number; u1: number; v1: number }

type Painter = (px: (x: number, y: number, r: number, g: number, b: number, a?: number) => void, rnd: () => number) => void;

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

/** fill tile with base color + per-pixel brightness jitter */
function speckle(p: Parameters<Painter>[0], rnd: () => number, base: string, jitter = 14): void {
  const [r, g, b] = hex(base);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const j = (rnd() - 0.5) * 2 * jitter;
      p(x, y, r + j, g + j, b + j);
    }
  }
}

const PAINTERS: Record<string, Painter> = {
  grass_top: (p, rnd) => {
    speckle(p, rnd, "#5fb554", 16);
    for (let i = 0; i < 26; i++) p(Math.floor(rnd() * T), Math.floor(rnd() * T), 70 + rnd() * 30, 150 + rnd() * 40, 60, 255);
  },
  grass_side: (p, rnd) => {
    speckle(p, rnd, "#7a5230", 12);
    for (let x = 0; x < T; x++) {
      const depth = 3 + Math.floor(rnd() * 3);
      for (let y = 0; y < depth; y++) {
        const j = (rnd() - 0.5) * 24;
        p(x, y, 88 + j, 168 + j, 74 + j);
      }
    }
  },
  dirt: (p, rnd) => {
    speckle(p, rnd, "#7a5230", 16);
    for (let i = 0; i < 12; i++) p(Math.floor(rnd() * T), Math.floor(rnd() * T), 96, 70, 46, 255);
  },
  stone: (p, rnd) => {
    speckle(p, rnd, "#8d8d8d", 10);
    for (let i = 0; i < 5; i++) {
      let x = Math.floor(rnd() * T), y = Math.floor(rnd() * T);
      for (let k = 0; k < 4; k++) { p(x & 15, y & 15, 116, 116, 118); x += rnd() > 0.5 ? 1 : 0; y += 1; }
    }
  },
  cobble: (p, rnd) => {
    speckle(p, rnd, "#757575", 9);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const cell = ((x >> 2) + (y >> 2)) % 2;
      if ((x % 4 === 0) || (y % 4 === 0)) p(x, y, 88, 88, 90);
      else if (cell) p(x, y, 122 + (rnd() - 0.5) * 14, 122, 124);
    }
  },
  sand: (p, rnd) => {
    speckle(p, rnd, "#dbcf9a", 12);
    for (let i = 0; i < 10; i++) p(Math.floor(rnd() * T), Math.floor(rnd() * T), 200, 188, 140, 255);
  },
  log_side: (p, rnd) => {
    speckle(p, rnd, "#6b4a2b", 8);
    for (let x = 0; x < T; x += 3 + Math.floor(rnd() * 2)) {
      for (let y = 0; y < T; y++) p(x, y, 84, 58, 34);
    }
  },
  log_top: (p, rnd) => {
    speckle(p, rnd, "#9c7a4e", 8);
    for (let r = 2; r < 8; r += 2) {
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2;
        const x = Math.round(7.5 + Math.cos(ang) * r);
        const y = Math.round(7.5 + Math.sin(ang) * r);
        if (x >= 0 && x < T && y >= 0 && y < T) p(x, y, 122, 92, 58);
      }
    }
  },
  leaves: (p, rnd) => {
    const [r, g, b] = hex("#3e8f3e");
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (rnd() < 0.16) { p(x, y, 0, 0, 0, 0); continue; } // holes
      const j = (rnd() - 0.5) * 36;
      p(x, y, r + j * 0.4, g + j, b + j * 0.4);
    }
  },
  planks: (p, rnd) => {
    speckle(p, rnd, "#a07a4a", 8);
    for (let y = 3; y < T; y += 4) for (let x = 0; x < T; x++) p(x, y, 122, 90, 52);
    for (const [sx, sy] of [[3, 0], [11, 4], [6, 8], [13, 12]] as const) {
      for (let y = sy; y < Math.min(T, sy + 4); y++) p(sx, y, 130, 98, 58);
    }
  },
  glass: (p, rnd) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x === 0 || y === 0 || x === T - 1 || y === T - 1;
      if (edge) p(x, y, 222, 240, 246);
      else if ((x + y) % 7 === 0 && rnd() < 0.5) p(x, y, 235, 248, 252, 160);
      else p(x, y, 0, 0, 0, 0);
    }
  },
  brick: (p, rnd) => {
    speckle(p, rnd, "#9c4a3c", 10);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const row = y >> 2;
      const off = (row % 2) * 4;
      if (y % 4 === 3 || (x + off) % 8 === 7) p(x, y, 196, 186, 180);
    }
  },
  snow: (p, rnd) => speckle(p, rnd, "#eef4f6", 7),
  snow_side: (p, rnd) => {
    speckle(p, rnd, "#7a5230", 12);
    for (let x = 0; x < T; x++) for (let y = 0; y < 4; y++) p(x, y, 238 + (rnd() - 0.5) * 10, 244, 246);
  },
  water: (p, rnd) => {
    speckle(p, rnd, "#3d6fd6", 10);
    for (let i = 0; i < 8; i++) {
      const y = Math.floor(rnd() * T);
      for (let x = 0; x < 5; x++) p((x + Math.floor(rnd() * T)) & 15, y, 92, 138, 226);
    }
  },
  bedrock: (p, rnd) => speckle(p, rnd, "#3a3a3a", 22),
};

export interface Atlas {
  texture: THREE.CanvasTexture;
  uv: (tile: string) => UVRect;
  /** pseudo-3D cube thumbnail for the hotbar */
  thumb: (blockId: number) => string;
}

let cached: Atlas | null = null;

export function getAtlas(): Atlas {
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  const slots = new Map<string, number>();

  const names = Object.keys(PAINTERS);
  names.forEach((name, slot) => {
    slots.set(name, slot);
    const tx = (slot % GRID) * T;
    const ty = Math.floor(slot / GRID) * T;
    const rnd = mulberry32(0xc0ffee ^ (slot * 2654435761));
    PAINTERS[name]((x, y, r, g, b, a = 255) => {
      const i = ((ty + y) * SIZE + (tx + x)) * 4;
      img.data[i] = Math.max(0, Math.min(255, r));
      img.data[i + 1] = Math.max(0, Math.min(255, g));
      img.data[i + 2] = Math.max(0, Math.min(255, b));
      img.data[i + 3] = a;
    }, rnd);
  });
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const eps = 0.001 / GRID;
  const uv = (tile: string): UVRect => {
    const slot = slots.get(tile) ?? 0;
    const col = slot % GRID;
    const row = Math.floor(slot / GRID);
    return {
      u0: col / GRID + eps,
      u1: (col + 1) / GRID - eps,
      v1: 1 - row / GRID - eps,     // top
      v0: 1 - (row + 1) / GRID + eps, // bottom
    };
  };

  const thumbCache = new Map<number, string>();
  const thumb = (blockId: number): string => {
    const hit = thumbCache.get(blockId);
    if (hit) return hit;
    const def = BLOCKS[blockId];
    const c = document.createElement("canvas");
    c.width = 52; c.height = 52;
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    const tileCanvas = (name: string) => {
      const slot = slots.get(name) ?? 0;
      return [(slot % GRID) * T, Math.floor(slot / GRID) * T] as const;
    };
    const [topX, topY] = tileCanvas(def.tiles[0]);
    const [sideX, sideY] = tileCanvas(def.tiles[1]);
    // top face (lightened diamond)
    g.save();
    g.setTransform(1.05, 0.52, -1.05, 0.52, 26, 2);
    g.drawImage(canvas, topX, topY, T, T, 0, 0, 16, 16);
    g.restore();
    // left face
    g.save();
    g.setTransform(1.05, 0.52, 0, 1.2, 9.2, 10.4);
    g.globalAlpha = 0.82;
    g.drawImage(canvas, sideX, sideY, T, T, 0, 0, 16, 16);
    g.restore();
    // right face (darker)
    g.save();
    g.setTransform(1.05, -0.52, 0, 1.2, 26, 19);
    g.globalAlpha = 0.62;
    g.drawImage(canvas, sideX, sideY, T, T, 0, 0, 16, 16);
    g.restore();
    const url = c.toDataURL();
    thumbCache.set(blockId, url);
    return url;
  };

  cached = { texture, uv, thumb };
  return cached;
}
