import { useRef } from "react";
import * as THREE from "three";
import { Game, World, Camera } from "@carverjs/core/components";
import { MultiplayerBridge, useRoom } from "@carverjs/multiplayer";
import { GameScene } from "./GameScene";
import { HUD } from "../ui/HUD";

type RoomApi = ReturnType<typeof useRoom>;

interface Props {
  room: RoomApi;
  isCreator: boolean;
  onLeave: () => void;
}

export function GameView({ room, isCreator, onLeave }: Props) {
  const camRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);

  return (
    <div className="game-root">
      <Game
        mode="3d"
        shadows={false}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        ambientLightProps={{ intensity: 0.55 }}
        directionalLightProps={{ position: [80, 120, 40], intensity: 1.15, castShadow: false }}
        skyProps={{ sunPosition: [80, 120, 40] }}
        environmentProps={{ background: false }}
      >
        <MultiplayerBridge>
          <World>
            <Camera
              
              ref={camRef}
              type="perspective"
              controls="none"
              perspectiveProps={{ fov: 78, near: 0.1, far: 350, position: [64, 46, 84] }}
            />
            <GameScene
              isHost={room.isHost}
              isCreator={isCreator}
              selfId={room.selfId ?? "self"}
              camRef={camRef}
            />
          </World>
        </MultiplayerBridge>
      </Game>
      <HUD room={room} onLeave={onLeave} />
    </div>
  );
}
