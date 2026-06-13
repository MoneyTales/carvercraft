// Tiny callback bus: gameplay code fires block FX, the BreakFX component
// (which owns the particle emitters) registers the handler.

export interface BlockFx {
  x: number; y: number; z: number;
  block: number;
  kind: "break" | "place";
}

let handler: ((fx: BlockFx) => void) | null = null;

export function registerFx(cb: (fx: BlockFx) => void): () => void {
  handler = cb;
  return () => {
    if (handler === cb) handler = null;
  };
}

export function fireFx(fx: BlockFx): void {
  handler?.(fx);
}
