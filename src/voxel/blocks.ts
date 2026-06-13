// Block registry. Tile names refer to atlas.ts painters.

export const enum B {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  LOG = 5,
  LEAVES = 6,
  PLANKS = 7,
  GLASS = 8,
  BRICK = 9,
  SNOW = 10,
  COBBLE = 11,
  WATER = 12,
  BEDROCK = 13,
}

export interface BlockDef {
  name: string;
  /** atlas tile names: [top, side, bottom] */
  tiles: [string, string, string];
  /** blocks light/faces of neighbors */
  opaque: boolean;
  /** player collides with it */
  solid: boolean;
  /** representative color (particles, thumbnails fallback) */
  color: string;
  /** sound family: 0 soft / 1 stone / 2 wood / 3 sand / 4 glass */
  sound: number;
}

export const BLOCKS: Record<number, BlockDef> = {
  [B.GRASS]: { name: "Grass", tiles: ["grass_top", "grass_side", "dirt"], opaque: true, solid: true, color: "#58b14c", sound: 0 },
  [B.DIRT]: { name: "Dirt", tiles: ["dirt", "dirt", "dirt"], opaque: true, solid: true, color: "#7a5230", sound: 0 },
  [B.STONE]: { name: "Stone", tiles: ["stone", "stone", "stone"], opaque: true, solid: true, color: "#8a8a8a", sound: 1 },
  [B.SAND]: { name: "Sand", tiles: ["sand", "sand", "sand"], opaque: true, solid: true, color: "#dbcf9a", sound: 3 },
  [B.LOG]: { name: "Log", tiles: ["log_top", "log_side", "log_top"], opaque: true, solid: true, color: "#6b4a2b", sound: 2 },
  [B.LEAVES]: { name: "Leaves", tiles: ["leaves", "leaves", "leaves"], opaque: false, solid: true, color: "#3e8f3e", sound: 0 },
  [B.PLANKS]: { name: "Planks", tiles: ["planks", "planks", "planks"], opaque: true, solid: true, color: "#a07a4a", sound: 2 },
  [B.GLASS]: { name: "Glass", tiles: ["glass", "glass", "glass"], opaque: false, solid: true, color: "#bfe3ee", sound: 4 },
  [B.BRICK]: { name: "Brick", tiles: ["brick", "brick", "brick"], opaque: true, solid: true, color: "#9c4a3c", sound: 1 },
  [B.SNOW]: { name: "Snow", tiles: ["snow", "snow_side", "dirt"], opaque: true, solid: true, color: "#eef4f6", sound: 0 },
  [B.COBBLE]: { name: "Cobble", tiles: ["cobble", "cobble", "cobble"], opaque: true, solid: true, color: "#6e6e6e", sound: 1 },
  [B.WATER]: { name: "Water", tiles: ["water", "water", "water"], opaque: false, solid: false, color: "#3d6fd6", sound: 0 },
  [B.BEDROCK]: { name: "Bedrock", tiles: ["bedrock", "bedrock", "bedrock"], opaque: true, solid: true, color: "#333333", sound: 1 },
};

/** Hotbar: 9 placeable blocks */
export const HOTBAR: number[] = [
  B.GRASS, B.DIRT, B.STONE, B.PLANKS, B.LOG, B.LEAVES, B.GLASS, B.BRICK, B.SNOW,
];

export const isOpaque = (b: number): boolean => b !== B.AIR && (BLOCKS[b]?.opaque ?? false);
export const isSolid = (b: number): boolean => b !== B.AIR && (BLOCKS[b]?.solid ?? false);
/** Can the camera-ray target it? (everything solid; water/air pass through) */
export const isTargetable = (b: number): boolean => isSolid(b);
