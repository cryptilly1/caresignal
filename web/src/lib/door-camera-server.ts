type Peer = {
  id: string;
  offer: RTCSessionDescriptionInit;
  answer: RTCSessionDescriptionInit | null;
  viewerIce: RTCIceCandidateInit[];
  cameraIce: RTCIceCandidateInit[];
  seenAt: number;
};
type Camera = { publisherId: string | null; seenAt: number; peers: Map<string, Peer> };
const globalCamera = globalThis as typeof globalThis & { __careSignalDoorCamera?: Camera };
const LEASE_MS = 30_000;

function camera() {
  const state = globalCamera.__careSignalDoorCamera ??= { publisherId: null, seenAt: 0, peers: new Map() };
  if (Date.now() - state.seenAt > LEASE_MS) {
    state.publisherId = null;
    state.peers.clear();
  }
  for (const [id, peer] of state.peers) {
    if (Date.now() - peer.seenAt > LEASE_MS) state.peers.delete(id);
  }
  return state;
}

export function doorCameraSnapshot(viewerId: string | null, publisherId: string | null) {
  const state = camera();
  const peer = viewerId ? state.peers.get(viewerId) : null;
  return {
    available: !!state.publisherId,
    publisherId: state.publisherId,
    peer: peer ?? null,
    peers: publisherId && publisherId === state.publisherId ? [...state.peers.values()] : [],
  };
}

export function updateDoorCamera(body: Record<string, unknown>) {
  const state = camera();
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("A valid camera connection ID is required.");
  if (body.action === "start") {
    if (state.publisherId && state.publisherId !== id) throw new Error("Another phone camera is watching. Stop it before starting this camera.");
    state.publisherId = id;
    state.seenAt = Date.now();
    return;
  }
  if (body.role === "camera") {
    if (state.publisherId !== id) throw new Error("This camera session has ended. Start watching again.");
    state.seenAt = Date.now();
    if (body.action === "stop") {
      state.publisherId = null;
      state.peers.clear();
      return;
    }
    if (body.action === "heartbeat") return;
    const peer = typeof body.viewerId === "string" ? state.peers.get(body.viewerId) : null;
    if (!peer) throw new Error("The viewer session has ended.");
    if (body.action === "answer" && validSdp(body.sdp, "answer")) peer.answer = body.sdp;
    else if (body.action === "ice" && validIce(body.candidate) && peer.cameraIce.length < 128) peer.cameraIce.push(body.candidate);
    else throw new Error("Invalid camera signal.");
    return;
  }
  if (body.action === "leave") { state.peers.delete(id); return; }
  if (!state.publisherId) throw new Error("The phone camera is not watching.");
  if (body.action === "offer" && validSdp(body.sdp, "offer")) {
    if (state.peers.size >= 12 && !state.peers.has(id)) throw new Error("The camera already has the maximum number of viewers.");
    state.peers.set(id, { id, offer: body.sdp, answer: null, viewerIce: [], cameraIce: [], seenAt: Date.now() });
    return;
  }
  const peer = state.peers.get(id);
  if (!peer) throw new Error("The viewer session has ended.");
  peer.seenAt = Date.now();
  if (body.action === "heartbeat") return;
  if (body.action === "ice" && validIce(body.candidate) && peer.viewerIce.length < 128) peer.viewerIce.push(body.candidate);
  else throw new Error("Invalid viewer signal.");
}

function validSdp(value: unknown, type: "offer" | "answer"): value is RTCSessionDescriptionInit {
  return !!value && typeof value === "object" && "type" in value && value.type === type &&
    "sdp" in value && typeof value.sdp === "string" && value.sdp.length <= 100_000;
}

function validIce(value: unknown): value is RTCIceCandidateInit {
  return !!value && typeof value === "object" && "candidate" in value &&
    typeof value.candidate === "string" && value.candidate.length < 4096;
}
