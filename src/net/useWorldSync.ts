import { useCallback, useEffect, useRef, useState } from "react";
import { useNetworkEvents, usePlayers } from "@carverjs/multiplayer";
import { VoxelWorld } from "../voxel/world";
import { B } from "../voxel/blocks";
import { editKey, unpackKey, type NetEvents, type RemoteState } from "./protocol";
import { fireFx } from "../game/fx";

/**
 * World ownership + replication.
 *
 * - The creator generates a seed and builds the world immediately.
 * - Joiners broadcast `syncReq` until the current host answers `syncRes`
 *   with the seed + full edit log, then build the same world locally.
 * - Every peer keeps the complete edit log, so after host migration ANY
 *   promoted peer can answer future sync requests.
 * - Block edits are broadcast peer-to-peer and applied idempotently.
 */
export function useWorldSync(opts: { isHost: boolean; isCreator: boolean }) {
  const { sendEvent, broadcast, onEvent } = useNetworkEvents<NetEvents>();
  const { players } = usePlayers();
  const [world, setWorld] = useState<VoxelWorld | null>(null);

  const worldRef = useRef<VoxelWorld | null>(null);
  const editLog = useRef(new Map<string, number>());
  const remotes = useRef(new Map<string, RemoteState>());
  const isHostRef = useRef(opts.isHost);
  isHostRef.current = opts.isHost;

  const packEdits = useCallback((): number[] => {
    const edits: number[] = [];
    for (const [k, b] of editLog.current) {
      const [x, y, z] = unpackKey(k);
      edits.push(x, y, z, b);
    }
    return edits;
  }, []);

  // creator builds the world instantly
  useEffect(() => {
    if (!opts.isCreator || worldRef.current) return;
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const w = new VoxelWorld(seed);
    worldRef.current = w;
    setWorld(w);
  }, [opts.isCreator]);

  // joiner asks for the world until it arrives
  useEffect(() => {
    if (opts.isCreator) return;
    const ask = () => {
      if (!worldRef.current) {
        if (import.meta.env.DEV) console.log("[cc] syncReq broadcast");
        broadcast("syncReq", { t: Date.now() });
      }
    };
    ask();
    const iv = setInterval(ask, 1500);
    return () => clearInterval(iv);
  }, [opts.isCreator, broadcast]);

  // network listeners
  useEffect(() => {
    const subs = [
      onEvent("syncReq", (_d, peerId) => {
        const w = worldRef.current;
        if (import.meta.env.DEV) console.log("[cc] syncReq from", peerId, "answer:", !!w && isHostRef.current);
        if (!w || !isHostRef.current) return;
        // broadcast, not targeted: targeted sends can silently drop on a
        // freshly-opened channel (engine bug); receivers ignore duplicates
        broadcast("syncRes", { seed: w.seed, edits: packEdits() });
      }),

      onEvent("syncRes", (d) => {
        if (import.meta.env.DEV) console.log("[cc] syncRes received, edits:", d.edits.length / 4);
        if (worldRef.current) return; // already have a world
        const w = new VoxelWorld(d.seed);
        for (let i = 0; i + 3 < d.edits.length; i += 4) {
          const [x, y, z, b] = [d.edits[i], d.edits[i + 1], d.edits[i + 2], d.edits[i + 3]];
          w.set(x, y, z, b);
          editLog.current.set(editKey(x, y, z), b);
        }
        w.flushDirty();
        worldRef.current = w;
        setWorld(w);
      }),

      onEvent("edit", (d, peerId) => {
        const w = worldRef.current;
        if (!w) return;
        const prev = w.get(d.x, d.y, d.z);
        if (!w.set(d.x, d.y, d.z, d.b)) return;
        w.flushDirty();
        editLog.current.set(editKey(d.x, d.y, d.z), d.b);
        const r = remotes.current.get(peerId);
        if (r) r.swing = 1;
        fireFx({
          x: d.x, y: d.y, z: d.z,
          block: d.b === B.AIR ? prev : d.b,
          kind: d.b === B.AIR ? "break" : "place",
        });
      }),

      onEvent("pos", (d, peerId) => {
        const r = remotes.current.get(peerId);
        if (r) {
          r.x = d.x; r.y = d.y; r.z = d.z;
          r.yaw = d.yaw; r.pitch = d.pitch; r.sel = d.sel;
          r.lastSeen = performance.now();
        } else {
          remotes.current.set(peerId, { ...d, swing: 0, lastSeen: performance.now() });
        }
      }),
    ];
    return () => subs.forEach((u) => u());
  }, [onEvent, sendEvent]);

  // Host-push fallback: don't rely on the joiner's syncReq arriving (one
  // direction of a fresh data channel can lag). When the host sees a new
  // peer, it pushes the world a few times — the receiver ignores duplicates.
  const pushed = useRef(new Set<string>());
  useEffect(() => {
    if (!opts.isHost || !world) return;
    for (const p of players) {
      if (p.isSelf || !p.isConnected || pushed.current.has(p.peerId)) continue;
      pushed.current.add(p.peerId);
      for (const delay of [800, 2500, 6000]) {
        setTimeout(() => {
          const w = worldRef.current;
          if (!w || !isHostRef.current) return;
          if (import.meta.env.DEV) console.log("[cc] host-push syncRes (new peer", p.peerId, ")");
          broadcast("syncRes", { seed: w.seed, edits: packEdits() });
        }, delay);
      }
    }
  }, [opts.isHost, world, players, sendEvent, packEdits]);

  /** local player edits a block: apply, log, broadcast, fx */
  const applyLocalEdit = useCallback(
    (x: number, y: number, z: number, b: number) => {
      const w = worldRef.current;
      if (!w) return;
      const prev = w.get(x, y, z);
      if (!w.set(x, y, z, b)) return;
      w.flushDirty();
      editLog.current.set(editKey(x, y, z), b);
      broadcast("edit", { x, y, z, b });
      fireFx({
        x, y, z,
        block: b === B.AIR ? prev : b,
        kind: b === B.AIR ? "break" : "place",
      });
    },
    [broadcast],
  );

  // debug/testing hook
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__cc = {
      world,
      applyEdit: applyLocalEdit,
      remotes: remotes.current,
    };
  }, [world, applyLocalEdit]);

  return { world, remotes, applyLocalEdit };
}
