import { useEffect, type RefObject } from "react";
import type { Group } from "three";
import { useParticles } from "@carverjs/core/hooks";
import { B } from "../voxel/blocks";
import { registerFx, type BlockFx } from "./fx";
import { rig } from "./rig";
import { sfx } from "../audio/sfx";

function crumbConfig(color: string) {
  return {
    maxParticles: 120,
    // Burst mode: the emitter must never stream. The useParticles hook calls
    // start() on mount (enabled defaults true), and the default "stream"
    // emission would then fountain 50 particles/sec forever from the last
    // break point. In burst mode with no scheduled bursts, nothing auto-emits;
    // only our explicit burst() fires, and those particles age out in ~0.5s.
    emission: "burst" as const,
    autoPlay: false,
    loop: false,
    particle: {
      speed: [2.2, 5] as [number, number],
      lifetime: [0.25, 0.55] as [number, number],
      size: [0.08, 0.2] as [number, number],
      color,
      gravity: 2.4,
      drag: 0.08,
      rotationSpeed: [-6, 6] as [number, number],
    },
    shape: { shape: "sphere" as const, radius: 0.3 },
  };
}

/** Particle bursts + sound for every block edit (local and remote). */
export function BreakFX() {
  const earth = useParticles(crumbConfig("#7a5230"));
  const stone = useParticles(crumbConfig("#8d8d8d"));
  const leaf = useParticles(crumbConfig("#4da34d"));
  const light = useParticles(crumbConfig("#e3d9b0"));

  useEffect(() => {
    const pick = (block: number) => {
      switch (block) {
        case B.GRASS:
        case B.LEAVES:
          return leaf;
        case B.SAND:
        case B.SNOW:
        case B.GLASS:
          return light;
        case B.STONE:
        case B.COBBLE:
        case B.BRICK:
        case B.BEDROCK:
          return stone;
        default:
          return earth;
      }
    };

    return registerFx((fx: BlockFx) => {
      const dist = Math.hypot(fx.x + 0.5 - rig.pos.x, fx.y + 0.5 - rig.pos.y, fx.z + 0.5 - rig.pos.z);
      if (fx.kind === "break") {
        sfx.breakBlock(fx.block, dist);
        const em = pick(fx.block);
        if (em.ref.current) {
          em.ref.current.position.set(fx.x + 0.5, fx.y + 0.5, fx.z + 0.5);
          em.ref.current.updateMatrixWorld(true);
          em.burst(16);
        }
      } else {
        sfx.placeBlock(fx.block, dist);
      }
    });
  }, [earth, stone, leaf, light]);

  return (
    <>
      <group ref={earth.ref as unknown as RefObject<Group>} />
      <group ref={stone.ref as unknown as RefObject<Group>} />
      <group ref={leaf.ref as unknown as RefObject<Group>} />
      <group ref={light.ref as unknown as RefObject<Group>} />
    </>
  );
}
