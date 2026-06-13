import { useEffect, type RefObject } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useGameStore } from "@carverjs/core/store";
import { useMultiplayer } from "@carverjs/multiplayer";
import { useWorldSync } from "../net/useWorldSync";
import { VoxelTerrain } from "../voxel/VoxelTerrain";
import { PlayerController, BlockHighlight } from "./PlayerController";
import { RemotePlayers } from "./RemotePlayers";
import { ViewModel } from "./ViewModel";
import { Clouds } from "./Clouds";
import { BreakFX } from "./BreakFX";
import { useUI } from "../ui/uiStore";

function SceneFog() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    // cast: fiber bundles its own @types/three copy; runtime objects are identical
    scene.fog = new THREE.Fog("#cfe3ff", 70, 190) as unknown as typeof scene.fog;
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  return null;
}

interface Props {
  isHost: boolean;
  isCreator: boolean;
  selfId: string;
  camRef: RefObject<THREE.Camera | null>;
}

export function GameScene({ isHost, isCreator, selfId, camRef }: Props) {
  // event-driven sync mode: positions + edits are explicit broadcasts
  useMultiplayer({ mode: "events", tickRate: 60 });
  const { world, remotes, applyLocalEdit } = useWorldSync({ isHost, isCreator });
  const setPhase = useGameStore((s) => s.setPhase);

  useEffect(() => {
    setPhase("playing");
    return () => setPhase("loading");
  }, [setPhase]);

  useEffect(() => {
    useUI.getState().setWorldReady(!!world);
  }, [world]);

  if (!world) return <SceneFog />;

  return (
    <>
      <SceneFog />
      <VoxelTerrain world={world} />
      <PlayerController camRef={camRef} world={world} applyEdit={applyLocalEdit} selfId={selfId} />
      <RemotePlayers remotes={remotes} />
      <BlockHighlight />
      <ViewModel camRef={camRef} />
      <Clouds />
      <BreakFX />
    </>
  );
}
