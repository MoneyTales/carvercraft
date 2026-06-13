// Typed network events for useNetworkEvents<NetEvents>.

export interface PosPayload {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** selected hotbar block id (shown in remote hand) */
  sel: number;
}

export interface EditPayload {
  x: number;
  y: number;
  z: number;
  /** block id, 0 = broken */
  b: number;
}

export type NetEvents = {
  pos: PosPayload;
  edit: EditPayload;
  /** late joiner asks for the world */
  syncReq: { t: number };
  /** host answers with seed + flat-packed edit log [x,y,z,b, x,y,z,b, ...] */
  syncRes: { seed: number; edits: number[] };
};

/** mutable remote player state, lerped by RemotePlayers each frame */
export interface RemoteState {
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  sel: number;
  /** swing animation 1 -> 0 */
  swing: number;
  lastSeen: number;
}

// String keys: the world is infinite, coordinates can be negative.
export const editKey = (x: number, y: number, z: number): string => `${x}|${y}|${z}`;

export const unpackKey = (k: string): [number, number, number] =>
  k.split("|").map(Number) as [number, number, number];
