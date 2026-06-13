import * as THREE from "three";

/**
 * Mutable per-frame player rig shared between systems (controller, viewmodel,
 * HUD sampling). Module singleton — written by PlayerController each frame.
 * Not React state on purpose: zero re-renders in the hot path.
 */
export const rig = {
  pos: new THREE.Vector3(64, 40, 64), // feet position
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  onGround: false,
  inWater: false,
  flying: false,
  /** horizontal speed (viewmodel bob) */
  speed2D: 0,
  /** walk-cycle phase accumulator */
  walkPhase: 0,
  /** 1 on swing start, decays to 0 (viewmodel animation) */
  swing: 0,
  /** targeted block + placement normal, null if none */
  target: null as null | { x: number; y: number; z: number; nx: number; ny: number; nz: number; block: number },
};

export function resetRig(x: number, y: number, z: number): void {
  rig.pos.set(x, y, z);
  rig.vel.set(0, 0, 0);
  rig.yaw = Math.PI * 0.25;
  rig.pitch = -0.2;
  rig.onGround = false;
  rig.inWater = false;
  rig.flying = false;
  rig.swing = 0;
  rig.target = null;
}
