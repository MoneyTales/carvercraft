import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useGameLoop } from "@carverjs/core/hooks";
import { HOTBAR } from "../voxel/blocks";
import { blockPreviewGeometry } from "../voxel/mesher";
import { getAtlas } from "../voxel/atlas";
import { rig } from "./rig";
import { useUI } from "../ui/uiStore";

const OFFSET = new THREE.Vector3(0.4, -0.42, -0.7);
const tmp = new THREE.Vector3();

/** Minecraft-style held block in the bottom-right of the first-person view. */
export function ViewModel({ camRef }: { camRef: RefObject<THREE.Camera | null> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const sel = useUI((s) => s.sel);

  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        map: getAtlas().texture,
        vertexColors: true,
        alphaTest: 0.5,
        depthTest: false,
      }),
    [],
  );
  const geometry = useMemo(() => blockPreviewGeometry(HOTBAR[sel]), [sel]);

  useGameLoop((dt) => {
    const cam = camRef.current;
    const m = mesh.current;
    if (!cam || !m) return;

    if (rig.swing > 0) rig.swing = Math.max(0, rig.swing - dt * 4.5);
    const bob = Math.sin(rig.walkPhase * 2) * 0.018 * Math.min(1, rig.speed2D / 4);
    const swingArc = Math.sin(rig.swing * Math.PI);

    tmp.copy(OFFSET);
    tmp.y += bob - swingArc * 0.16;
    tmp.z -= swingArc * 0.1;
    tmp.applyQuaternion(cam.quaternion);
    m.position.copy(cam.position).add(tmp);
    m.quaternion.copy(cam.quaternion);
    m.rotateY(0.55);
    m.rotateX(-swingArc * 0.9);
  }, { stage: "lateUpdate" });

  return (
    <mesh ref={mesh} geometry={geometry} material={material} scale={0.34} renderOrder={1000} />
  );
}
