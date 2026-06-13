import { useState } from "react";
import { useLobby } from "@carverjs/multiplayer";
import { sfx } from "../audio/sfx";

interface Props {
  onPlay: (roomId: string, isCreator: boolean, name: string) => void;
}

export function MenuScreen({ onPlay }: Props) {
  const [name, setName] = useState(() => localStorage.getItem("cc-name") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { rooms, createRoom } = useLobby();

  const saveName = (n: string) => {
    setName(n);
    localStorage.setItem("cc-name", n);
  };
  const playerName = name.trim() || "Steve";

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    sfx.click();
    try {
      const roomId = await createRoom({
        name: `${playerName}'s World`,
        maxPlayers: 8,
        gameMode: "sandbox",
      });
      onPlay(roomId, true, playerName);
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  };

  const handleJoin = (id: string) => {
    if (!id.trim() || busy) return;
    sfx.click();
    onPlay(id.trim(), false, playerName);
  };

  // NOTE: lobby announcements always report playerCount 0 (engine never feeds
  // the live count back into the heartbeat), so don't filter on it.
  const openWorlds = rooms.filter((r) => r.playerCount < r.maxPlayers);

  return (
    <div className="menu">
      <div className="menu-sky" />
      <div className="menu-panel">
        <h1 className="logo big">CARVER<span>CRAFT</span></h1>
        <p className="tagline">multiplayer voxel sandbox · built with CarverJS</p>

        <label className="field-label" htmlFor="cc-name">Your name</label>
        <input
          id="cc-name"
          className="input"
          maxLength={14}
          placeholder="Steve"
          value={name}
          onChange={(e) => saveName(e.target.value)}
        />

        <button className="btn primary" onClick={handleCreate} disabled={busy}>
          {busy ? "Creating world…" : "Create a new world"}
        </button>

        <div className="divider"><span>or join friends</span></div>

        <div className="join-row">
          <input
            className="input"
            placeholder="Paste invite code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin(code)}
          />
          <button className="btn" onClick={() => handleJoin(code)} disabled={!code.trim() || busy}>
            Join
          </button>
        </div>

        {openWorlds.length > 0 && (
          <div className="world-list">
            <div className="field-label">Open worlds</div>
            {openWorlds.slice(0, 5).map((r) => (
              <button key={r.id} className="world-row" onClick={() => handleJoin(r.id)}>
                <span>{r.name}</span>
                <span className="dim">{r.playerCount > 0 ? `${r.playerCount}/${r.maxPlayers}` : "open"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="menu-footer">
        P2P WebRTC · no game server · <a href="https://docs.carverjs.dev" target="_blank" rel="noreferrer">docs.carverjs.dev</a>
      </div>
    </div>
  );
}
