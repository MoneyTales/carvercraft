import { useEffect, useRef } from "react";
import { usePlayers, useRoom } from "@carverjs/multiplayer";

type RoomApi = ReturnType<typeof useRoom>;
import { HOTBAR, BLOCKS } from "../voxel/blocks";
import { getAtlas } from "../voxel/atlas";
import { useUI } from "./uiStore";
import { sfx } from "../audio/sfx";

function lockPointer(): void {
  const canvas = document.querySelector<HTMLCanvasElement>(".game-root canvas");
  canvas?.requestPointerLock();
}

export function HUD({ room, onLeave }: { room: RoomApi; onLeave: () => void }) {
  const { sel, locked, worldReady, coords, fps, toasts, setSel } = useUI();
  const { players, self } = usePlayers();
  const toast = useUI((s) => s.toast);
  const prevPeers = useRef<Map<string, string>>(new Map());

  // join/leave toasts
  useEffect(() => {
    const cur = new Map(players.filter((p) => p.isConnected).map((p) => [p.peerId, p.displayName || "Player"]));
    const prev = prevPeers.current;
    for (const [id, name] of cur) {
      if (!prev.has(id) && prev.size > 0 && id !== self?.peerId) toast(`${name} joined the world`);
    }
    for (const [id, name] of prev) {
      if (!cur.has(id)) toast(`${name} left the world`);
    }
    prevPeers.current = cur;
  }, [players, self?.peerId, toast]);

  const copyCode = () => {
    if (room.roomId) {
      void navigator.clipboard.writeText(room.roomId);
      toast("Invite code copied — send it to a friend");
      sfx.click();
    }
  };

  const connecting = room.connectionState !== "connected";

  return (
    <div className="hud">
      {/* crosshair */}
      {locked && <div className="crosshair" />}

      {/* top-left: coords */}
      <div className="hud-chip hud-coords">
        {coords.x}, {coords.y}, {coords.z} · {fps} fps
      </div>

      {/* top-right: players */}
      <div className="hud-players">
        {players.filter((p) => p.isConnected).map((p) => (
          <div key={p.peerId} className={`hud-chip${p.isSelf ? " self" : ""}`}>
            {p.displayName || "Player"}
            {p.isHost ? " ★" : ""}
            {!p.isSelf && p.latencyMs > 0 ? ` ${Math.round(p.latencyMs)}ms` : ""}
          </div>
        ))}
        <button className="hud-chip hud-invite" onClick={copyCode}>
          Invite code ⧉
        </button>
      </div>

      {/* hotbar */}
      <div className="hotbar">
        {HOTBAR.map((b, i) => (
          <button
            key={b}
            className={`slot${i === sel ? " active" : ""}`}
            onClick={() => {
              setSel(i);
              sfx.click();
            }}
            title={BLOCKS[b].name}
          >
            <img src={getAtlas().thumb(b)} alt={BLOCKS[b].name} draggable={false} />
            <span className="slot-num">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="hotbar-label">{BLOCKS[HOTBAR[sel]].name}</div>

      {/* toasts */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.text}</div>
        ))}
      </div>

      {/* loading overlay */}
      {(connecting || !worldReady) && (
        <div className="overlay">
          <div className="overlay-panel">
            <h1 className="logo">CARVER<span>CRAFT</span></h1>
            <p className="pulse">
              {connecting ? "Connecting to peers…" : "Downloading world from host…"}
            </p>
            <button className="btn ghost" onClick={onLeave}>Back to menu</button>
          </div>
        </div>
      )}

      {/* pause / click-to-play overlay */}
      {!connecting && worldReady && !locked && (
        <div className="overlay clickable" onClick={lockPointer}>
          <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
            <h1 className="logo">CARVER<span>CRAFT</span></h1>
            <div className="controls-grid">
              <span>WASD</span><span>move</span>
              <span>Mouse</span><span>look</span>
              <span>Left click</span><span>break block</span>
              <span>Right click</span><span>place block</span>
              <span>1-9 / wheel</span><span>pick block</span>
              <span>Space</span><span>jump · double-tap to fly</span>
              <span>Shift</span><span>sprint</span>
              <span>C</span><span>descend (flying)</span>
            </div>
            <button className="btn" onClick={lockPointer}>
              {useUI.getState().firstFrame ? "Resume" : "Click to play"}
            </button>
            <div className="btn-row">
              <button className="btn ghost" onClick={copyCode}>Copy invite code</button>
              <button className="btn ghost" onClick={onLeave}>Leave world</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
