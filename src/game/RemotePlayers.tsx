import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useGameLoop } from "@carverjs/core/hooks";
import { usePlayers } from "@carverjs/multiplayer";
import type { RemoteState } from "../net/protocol";
import { BLOCKS } from "../voxel/blocks";

type RemoteMap = RefObject<Map<string, RemoteState>>;

function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function makeNameTexture(name: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.beginPath();
  g.roundRect(8, 8, 240, 48, 10);
  g.fill();
  g.font = "bold 26px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#ffffff";
  g.fillText(name.slice(0, 14), 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function RemoteAvatar({ peerId, name, remotes }: { peerId: string; name: string; remotes: RemoteMap }) {
  const group = useRef<THREE.Group>(null);
  const headPivot = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const heldMat = useRef<THREE.MeshLambertMaterial>(null);
  const cur = useRef({ x: 0, y: 0, z: 0, yaw: 0, init: false, phase: 0, lastSel: -1 });

  const mats = useMemo(() => {
    const hue = hueOf(peerId);
    return {
      skin: new THREE.MeshLambertMaterial({ color: new THREE.Color("#e0ac69") }),
      shirt: new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.62, 0.5) }),
      pants: new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.4, 0.26) }),
    };
  }, [peerId]);

  const nameTex = useMemo(() => makeNameTexture(name), [name]);
  useEffect(() => () => {
    nameTex.dispose();
    mats.skin.dispose();
    mats.shirt.dispose();
    mats.pants.dispose();
  }, [nameTex, mats]);

  useGameLoop((dt) => {
    const g = group.current;
    const data = remotes.current.get(peerId);
    if (!g) return;
    if (!data) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const c = cur.current;
    if (!c.init) {
      c.x = data.x; c.y = data.y; c.z = data.z; c.yaw = data.yaw;
      c.init = true;
    }
    const t = 1 - Math.pow(0.0004, dt);
    const px = c.x;
    const pz = c.z;
    c.x += (data.x - c.x) * t;
    c.y += (data.y - c.y) * t;
    c.z += (data.z - c.z) * t;
    // shortest-arc yaw lerp
    let dy = data.yaw - c.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    c.yaw += dy * Math.min(1, 12 * dt);
    g.position.set(c.x, c.y, c.z);
    g.rotation.y = c.yaw;

    if (headPivot.current) headPivot.current.rotation.x = -data.pitch * 0.8;

    // walk cycle from actual movement speed
    const speed = Math.hypot(c.x - px, c.z - pz) / Math.max(dt, 1e-4);
    c.phase += dt * Math.min(speed, 8) * 1.9;
    const amp = Math.min(1, speed / 3) * 0.55;
    const s = Math.sin(c.phase) * amp;
    if (legR.current) legR.current.rotation.x = s;
    if (legL.current) legL.current.rotation.x = -s;
    if (armL.current) armL.current.rotation.x = s * 0.8;

    // arm swing on remote edits
    if (data.swing > 0) data.swing = Math.max(0, data.swing - dt * 3.5);
    if (armR.current) {
      armR.current.rotation.x = -s * 0.8 - data.swing * 1.9;
    }

    // held block color
    if (heldMat.current && data.sel !== c.lastSel) {
      c.lastSel = data.sel;
      heldMat.current.color.set(BLOCKS[data.sel]?.color ?? "#888888");
    }
  });

  return (
    <group ref={group} visible={false}>
      {/* head (pivot at neck) */}
      <group ref={headPivot} position={[0, 1.5, 0]}>
        <mesh material={mats.skin} position={[0, 0.25, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        </mesh>
      </group>
      {/* body */}
      <mesh material={mats.shirt} position={[0, 1.14, 0]}>
        <boxGeometry args={[0.52, 0.72, 0.3]} />
      </mesh>
      {/* arms (pivot at shoulder) */}
      <group ref={armR} position={[0.37, 1.46, 0]}>
        <mesh material={mats.shirt} position={[0, -0.3, 0]}>
          <boxGeometry args={[0.22, 0.66, 0.22]} />
        </mesh>
        <mesh position={[0, -0.62, -0.18]}>
          <boxGeometry args={[0.26, 0.26, 0.26]} />
          <meshLambertMaterial ref={heldMat} color="#888888" />
        </mesh>
      </group>
      <group ref={armL} position={[-0.37, 1.46, 0]}>
        <mesh material={mats.shirt} position={[0, -0.3, 0]}>
          <boxGeometry args={[0.22, 0.66, 0.22]} />
        </mesh>
      </group>
      {/* legs (pivot at hip) */}
      <group ref={legR} position={[0.14, 0.78, 0]}>
        <mesh material={mats.pants} position={[0, -0.39, 0]}>
          <boxGeometry args={[0.24, 0.78, 0.24]} />
        </mesh>
      </group>
      <group ref={legL} position={[-0.14, 0.78, 0]}>
        <mesh material={mats.pants} position={[0, -0.39, 0]}>
          <boxGeometry args={[0.24, 0.78, 0.24]} />
        </mesh>
      </group>
      {/* name tag */}
      <sprite position={[0, 2.35, 0]} scale={[1.7, 0.42, 1]}>
        <spriteMaterial map={nameTex} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

export function RemotePlayers({ remotes }: { remotes: RemoteMap }) {
  const { players } = usePlayers();
  const others = players.filter((p) => !p.isSelf && p.isConnected);
  return (
    <>
      {others.map((p) => (
        <RemoteAvatar key={p.peerId} peerId={p.peerId} name={p.displayName || "Player"} remotes={remotes} />
      ))}
    </>
  );
}
