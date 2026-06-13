import { useEffect, useState } from "react";
import { MultiplayerProvider, useRoom, useHost } from "@carverjs/multiplayer";
import { MenuScreen } from "./ui/MenuScreen";
import { GameView } from "./game/GameView";
import { useUI } from "./ui/uiStore";

interface Session {
  roomId: string;
  isCreator: boolean;
  name: string;
}

function GameApp({
  session,
  onBack,
  onRetry,
}: {
  session: Session;
  onBack: () => void;
  onRetry: () => void;
}) {
  const room = useRoom(session.roomId, {
    displayName: session.name,
    onError: (e) => console.error("[multiplayer]", e),
  });
  const { setRoomState } = useHost();

  // WebRTC channel setup can occasionally come up one-directional (engine
  // race). If the world hasn't synced shortly after joining, remount the
  // whole session for a fresh handshake — the standard self-heal.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useUI.getState().worldReady) {
        console.warn("[cc] world sync stuck — retrying connection");
        onRetry();
      }
    }, 14000);
    return () => clearTimeout(t);
  }, [onRetry]);

  // debug/testing hook
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__room = room;
  }, [room]);

  // mark the room as live so it lists as joinable
  useEffect(() => {
    if (room.isHost && room.connectionState === "connected") setRoomState("playing");
  }, [room.isHost, room.connectionState, setRoomState]);

  const leave = () => {
    room.leave();
    useUI.setState({ worldReady: false, firstFrame: false, locked: false });
    onBack();
  };

  return <GameView room={room} isCreator={session.isCreator} onLeave={leave} />;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [attempt, setAttempt] = useState(0);

  const backToMenu = () => {
    setSession(null);
    setAttempt(0);
  };
  const retry = () => {
    setAttempt((a) => {
      if (a >= 2) {
        // give up after 3 attempts
        setSession(null);
        return 0;
      }
      useUI.getState().toast("Connection stuck — reconnecting…");
      return a + 1;
    });
  };

  const fbUrl = import.meta.env.VITE_FIREBASE_RTDB_URL as string | undefined;
  const turnId = import.meta.env.VITE_TURN_TOKEN_ID as string | undefined;

  return (
    <MultiplayerProvider
      key={attempt} // retry must rebuild the WHOLE transport, not just the room
      appId="carvercraft"
      {...(fbUrl ? { strategy: { type: "firebase" as const, databaseURL: fbUrl } } : {})}
      iceServers={[
        { urls: "stun:stun.cloudflare.com:3478" },
        ...(turnId
          ? [{
              urls: [
                "turn:turn.cloudflare.com:3478?transport=udp",
                "turn:turn.cloudflare.com:3478?transport=tcp",
                "turns:turn.cloudflare.com:5349?transport=tcp",
              ],
              username: turnId,
              credential: import.meta.env.VITE_TURN_API_TOKEN as string,
            }]
          : []),
      ]}
    >
      {session ? (
        <GameApp session={session} onBack={backToMenu} onRetry={retry} />
      ) : (
        <MenuScreen onPlay={(roomId, isCreator, name) => setSession({ roomId, isCreator, name })} />
      )}
    </MultiplayerProvider>
  );
}
