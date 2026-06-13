import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useGameLoop, useInput } from "@carverjs/core/hooks";
import { useNetworkEvents } from "@carverjs/multiplayer";
import { SY, WATER_Y, VoxelWorld } from "../voxel/world";
import { B, HOTBAR, isSolid } from "../voxel/blocks";
import { rig, resetRig } from "./rig";
import { useUI } from "../ui/uiStore";
import { sfx } from "../audio/sfx";
import type { NetEvents } from "../net/protocol";

const HALF = 0.3;
const HEIGHT = 1.8;
const EYE = 1.62;
const EPS = 0.001;
const REACH = 6;
const WALK = 4.4;
const SPRINT = 7.0;
const FLY = 11;
const FLY_SPRINT = 24;
const GRAVITY = 26;
const JUMP = 8.6;
const POS_RATE = 1 / 15;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function findSpawn(world: VoxelWorld, selfId: string): [number, number, number] {
  // everyone spawns near the world origin, spread on a deterministic spiral
  const h = hashStr(selfId) / 4294967296;
  for (let i = 0; i < 200; i++) {
    const ang = (h + i * 0.61803) * Math.PI * 2;
    const r = 4 + i * 0.9;
    const x = Math.floor(Math.cos(ang) * r);
    const z = Math.floor(Math.sin(ang) * r);
    const y = world.heightAt(x, z);
    if (y > WATER_Y && y < 46) return [x + 0.5, y + 1.05, z + 0.5];
  }
  return [0.5, world.heightAt(0, 0) + 2, 0.5];
}

interface Props {
  camRef: RefObject<THREE.Camera | null>;
  world: VoxelWorld;
  applyEdit: (x: number, y: number, z: number, b: number) => void;
  selfId: string;
}

export function PlayerController({ camRef, world, applyEdit, selfId }: Props) {
  const gl = useThree((s) => s.gl);
  const input = useInput();
  const { broadcast } = useNetworkEvents<NetEvents>();

  const mouseBtn = useRef<number | null>(null);
  const actTimer = useRef(0);
  const lastSpace = useRef(-1);
  const posTimer = useRef(1); // send immediately
  const uiTimer = useRef(0);
  const fpsAvg = useRef(60);
  const prevVelY = useRef(0);
  const spawnPoint = useRef<[number, number, number]>([0, 0, 0]);

  // spawn
  useEffect(() => {
    const p = findSpawn(world, selfId);
    spawnPoint.current = p;
    resetRig(p[0], p[1], p[2]);
  }, [world, selfId]);

  // pointer lock + mouse handlers
  useEffect(() => {
    const dom = gl.domElement;
    const ui = useUI.getState();

    const onClickCanvas = () => {
      sfx.unlock();
      if (document.pointerLockElement !== dom) dom.requestPointerLock();
    };
    const onLockChange = () => {
      useUI.getState().setLocked(document.pointerLockElement === dom);
      mouseBtn.current = null;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== dom) return;
      rig.yaw -= e.movementX * 0.0022;
      rig.pitch = Math.max(-1.55, Math.min(1.55, rig.pitch - e.movementY * 0.0022));
    };
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== dom) return;
      if (e.button === 1) {
        e.preventDefault();
        pickBlock();
        return;
      }
      mouseBtn.current = e.button;
      actTimer.current = 0; // act immediately
    };
    const onMouseUp = () => {
      mouseBtn.current = null;
    };
    const onContext = (e: Event) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== dom) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const cur = useUI.getState().sel;
      useUI.getState().setSel((cur + dir + HOTBAR.length) % HOTBAR.length);
      sfx.click();
    };

    dom.addEventListener("click", onClickCanvas);
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("contextmenu", onContext);
    dom.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      dom.removeEventListener("click", onClickCanvas);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("contextmenu", onContext);
      dom.removeEventListener("wheel", onWheel);
      ui.setLocked(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  function pickBlock(): void {
    const t = rig.target;
    if (!t) return;
    const idx = HOTBAR.indexOf(t.block);
    if (idx >= 0) {
      useUI.getState().setSel(idx);
      sfx.click();
    }
  }

  function act(button: number): void {
    const t = rig.target;
    if (!t) return;
    if (button === 0) {
      if (t.block === B.BEDROCK) return;
      applyEdit(t.x, t.y, t.z, B.AIR);
      rig.swing = 1;
    } else if (button === 2) {
      const px = t.x + t.nx;
      const py = t.y + t.ny;
      const pz = t.z + t.nz;
      if (py < 0 || py >= SY) return;
      const cur = world.get(px, py, pz);
      if (cur !== B.AIR && cur !== B.WATER) return;
      // don't place inside own AABB
      const p = rig.pos;
      const inter =
        px + 1 > p.x - HALF && px < p.x + HALF &&
        py + 1 > p.y && py < p.y + HEIGHT &&
        pz + 1 > p.z - HALF && pz < p.z + HALF;
      if (inter) return;
      applyEdit(px, py, pz, HOTBAR[useUI.getState().sel]);
      rig.swing = 1;
    }
  }

  function collide(axis: 0 | 1 | 2, dt: number): void {
    const p = rig.pos;
    const v = rig.vel;
    const delta = (axis === 0 ? v.x : axis === 1 ? v.y : v.z) * dt;
    if (delta === 0) return;
    if (axis === 0) p.x += delta;
    else if (axis === 1) p.y += delta;
    else p.z += delta;

    const x0 = Math.floor(p.x - HALF), x1 = Math.floor(p.x + HALF);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + HEIGHT - EPS);
    const z0 = Math.floor(p.z - HALF), z1 = Math.floor(p.z + HALF);

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (!world.solidAt(x, y, z)) continue;
          if (axis === 0) {
            p.x = delta > 0 ? x - HALF - EPS : x + 1 + HALF + EPS;
            v.x = 0;
          } else if (axis === 1) {
            if (delta > 0) {
              p.y = y - HEIGHT - EPS;
            } else {
              p.y = y + 1 + EPS;
              rig.onGround = true;
            }
            v.y = 0;
          } else {
            p.z = delta > 0 ? z - HALF - EPS : z + 1 + HALF + EPS;
            v.z = 0;
          }
          return;
        }
      }
    }
  }

  useGameLoop((dt, elapsed) => {
    const ui = useUI.getState();
    const locked = ui.locked;
    const p = rig.pos;
    const v = rig.vel;

    // ── hotbar digits ──
    for (let i = 0; i < HOTBAR.length; i++) {
      if (input.isJustPressed(`Digit${i + 1}`)) {
        ui.setSel(i);
        sfx.click();
      }
    }

    // ── fly toggle (double space) ──
    if (locked && input.isJustPressed("Space")) {
      if (elapsed - lastSpace.current < 0.28) {
        rig.flying = !rig.flying;
        v.set(0, rig.flying ? 0 : v.y, 0);
        sfx.click();
      }
      lastSpace.current = elapsed;
    }

    // ── movement intent ──
    const az = locked ? input.getAxis("KeyS", "KeyW") : 0;
    const ax = locked ? input.getAxis("KeyA", "KeyD") : 0;
    const sprint = input.isPressed("ShiftLeft");
    const sinY = Math.sin(rig.yaw);
    const cosY = Math.cos(rig.yaw);
    let wx = (-sinY * az) + (cosY * ax);
    let wz = (-cosY * az) + (-sinY * ax);
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    }

    // water state (waist height)
    const waist = world.get(Math.floor(p.x), Math.floor(p.y + 0.9), Math.floor(p.z));
    rig.inWater = waist === B.WATER;

    if (rig.flying) {
      const speed = sprint ? FLY_SPRINT : FLY;
      v.x = wx * speed;
      v.z = wz * speed;
      v.y = (locked && input.isPressed("Space") ? speed : 0) + (locked && input.isPressed("KeyC") ? -speed : 0);
    } else {
      const speed = (sprint ? SPRINT : WALK) * (rig.inWater ? 0.6 : 1);
      const accel = rig.onGround ? 14 : 5;
      v.x += (wx * speed - v.x) * Math.min(1, accel * dt);
      v.z += (wz * speed - v.z) * Math.min(1, accel * dt);
      if (rig.inWater) {
        v.y = Math.max(v.y - 10 * dt, -3.2);
        if (locked && input.isPressed("Space")) v.y = Math.min(v.y + 30 * dt, 4.2);
      } else {
        v.y -= GRAVITY * dt;
        if (locked && input.isPressed("Space") && rig.onGround) {
          v.y = JUMP;
          rig.onGround = false;
          sfx.jump();
        }
      }
    }

    // ── integrate + collide per axis ──
    const wasGround = rig.onGround;
    rig.onGround = false;
    collide(1, dt);
    collide(0, dt);
    collide(2, dt);
    if (!wasGround && rig.onGround && prevVelY.current < -15) sfx.land();
    prevVelY.current = v.y;

    // respawn from the void (infinite world: no horizontal bounds)
    if (p.y < -12) {
      const s = spawnPoint.current;
      resetRig(s[0], s[1], s[2]);
    }

    rig.speed2D = Math.hypot(v.x, v.z);
    if (rig.onGround && rig.speed2D > 0.5) rig.walkPhase += dt * rig.speed2D * 1.8;

    // ── targeting ──
    const cosP = Math.cos(rig.pitch);
    const dx = -sinY * cosP;
    const dy = Math.sin(rig.pitch);
    const dz = -cosY * cosP;
    rig.target = world.raycast(p.x, p.y + EYE, p.z, dx, dy, dz, REACH);

    // ── mine/place repeat while held ──
    if (locked && mouseBtn.current !== null) {
      actTimer.current -= dt;
      if (actTimer.current <= 0) {
        act(mouseBtn.current);
        actTimer.current = 0.24;
      }
    }

    // ── network position ──
    posTimer.current += dt;
    if (posTimer.current >= POS_RATE) {
      posTimer.current = 0;
      broadcast("pos", {
        x: p.x, y: p.y, z: p.z,
        yaw: rig.yaw, pitch: rig.pitch,
        sel: HOTBAR[ui.sel],
      });
    }

    // ── HUD sampling ──
    fpsAvg.current += (1 / Math.max(dt, 1e-4) - fpsAvg.current) * 0.06;
    uiTimer.current += dt;
    if (uiTimer.current >= 0.25) {
      uiTimer.current = 0;
      ui.setCoords(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), Math.round(fpsAvg.current));
      if (!ui.firstFrame) ui.setFirstFrame();
    }
  });

  // camera follows the rig after all updates
  useGameLoop(() => {
    const cam = camRef.current;
    if (!cam) return;
    cam.position.set(rig.pos.x, rig.pos.y + EYE, rig.pos.z);
    cam.rotation.order = "YXZ";
    cam.rotation.y = rig.yaw;
    cam.rotation.x = rig.pitch;
    cam.rotation.z = 0;
  }, { stage: "lateUpdate" });

  return null;
}

/** wireframe highlight on the targeted block */
export function BlockHighlight() {
  const ref = useRef<THREE.LineSegments>(null);
  useGameLoop(() => {
    const m = ref.current;
    if (!m) return;
    if (rig.target) {
      m.visible = true;
      m.position.set(rig.target.x + 0.5, rig.target.y + 0.5, rig.target.z + 0.5);
    } else {
      m.visible = false;
    }
  }, { stage: "lateUpdate" });

  return (
    <lineSegments ref={ref} visible={false} renderOrder={2}>
      <edgesGeometry args={[new THREE.BoxGeometry(1.002, 1.002, 1.002)]} />
      <lineBasicMaterial color="#111111" transparent opacity={0.55} />
    </lineSegments>
  );
}
