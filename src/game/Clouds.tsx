import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameLoop } from "@carverjs/core/hooks";
import { mulberry32 } from "../voxel/noise";
import { rig } from "./rig";

const COUNT = 22;
const SPAN = 320; // cloud field side length, recentered around the player

/** Slow-drifting blocky clouds — one InstancedMesh, follows the player. */
export function Clouds() {
  const ref = useRef<THREE.InstancedMesh>(null);

  const bases = useMemo(() => {
    const rnd = mulberry32(0xc10dd5);
    return Array.from({ length: COUNT }, () => ({
      x: rnd() * SPAN,
      y: 64 + rnd() * 14,
      z: rnd() * SPAN,
      sx: 9 + rnd() * 14,
      sy: 1.6 + rnd() * 1.2,
      sz: 6 + rnd() * 10,
      speed: 0.8 + rnd() * 0.9,
    }));
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = ref.current;
    if (m) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, []);

  useGameLoop((_dt, elapsed) => {
    const m = ref.current;
    if (!m) return;
    const px = rig.pos.x;
    const pz = rig.pos.z;
    for (let i = 0; i < COUNT; i++) {
      const b = bases[i];
      // wrap into a SPAN x SPAN window centered on the player
      const wrap = (v: number, center: number) =>
        ((v - center + SPAN / 2) % SPAN + SPAN) % SPAN + center - SPAN / 2;
      dummy.position.set(wrap(b.x + elapsed * b.speed, px), b.y, wrap(b.z, pz));
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color="#ffffff" transparent opacity={0.82} />
    </instancedMesh>
  );
}
