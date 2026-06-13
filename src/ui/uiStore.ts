import { create } from "zustand";

export interface Toast {
  id: number;
  text: string;
}

interface UIState {
  /** selected hotbar slot 0-8 */
  sel: number;
  /** pointer is locked (actively playing) */
  locked: boolean;
  /** world generated / synced, gameplay live */
  worldReady: boolean;
  /** at least one frame rendered */
  firstFrame: boolean;
  coords: { x: number; y: number; z: number };
  fps: number;
  toasts: Toast[];
  setSel: (s: number) => void;
  setLocked: (l: boolean) => void;
  setWorldReady: (r: boolean) => void;
  setFirstFrame: () => void;
  setCoords: (x: number, y: number, z: number, fps: number) => void;
  toast: (text: string) => void;
}

let toastId = 0;

export const useUI = create<UIState>()((set) => ({
  sel: 0,
  locked: false,
  worldReady: false,
  firstFrame: false,
  coords: { x: 0, y: 0, z: 0 },
  fps: 0,
  toasts: [],
  setSel: (sel) => set({ sel }),
  setLocked: (locked) => set({ locked }),
  setWorldReady: (worldReady) => set({ worldReady }),
  setFirstFrame: () => set({ firstFrame: true }),
  setCoords: (x, y, z, fps) => set({ coords: { x, y, z }, fps }),
  toast: (text) =>
    set((s) => {
      const id = ++toastId;
      setTimeout(() => {
        useUI.setState((cur) => ({ toasts: cur.toasts.filter((t) => t.id !== id) }));
      }, 3500);
      return { toasts: [...s.toasts.slice(-3), { id, text }] };
    }),
}));
