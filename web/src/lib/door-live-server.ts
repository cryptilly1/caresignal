/**
 * WebRTC signaling:
 * - Door cam: Mom (pub) ↔ caregiver (view)
 * - Talk: caregiver ↔ doorbell (two-way audio)
 * - Bell→Mom: doorbell mic → care receiver (Mom hears visitor)
 */

export type SignalPayload = {
  sessionId: number;
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  pubIce: RTCIceCandidateInit[];
  viewIce: RTCIceCandidateInit[];
  sharing: boolean;
  label: string;
  talkSessionId: number;
  talkOffer: RTCSessionDescriptionInit | null;
  talkAnswer: RTCSessionDescriptionInit | null;
  talkCareIce: RTCIceCandidateInit[];
  talkBellIce: RTCIceCandidateInit[];
  talking: boolean;
  /** Doorbell mic → Mom */
  bellMomSessionId: number;
  bellMomOffer: RTCSessionDescriptionInit | null;
  bellMomAnswer: RTCSessionDescriptionInit | null;
  bellMomPubIce: RTCIceCandidateInit[];
  bellMomViewIce: RTCIceCandidateInit[];
  bellMomLive: boolean;
  updatedAt: string;
};

type Store = SignalPayload;

const g = globalThis as typeof globalThis & { __doorLive?: Store };

function empty(
  sessionId = 0,
  talkSessionId = 0,
  bellMomSessionId = 0,
): Store {
  return {
    sessionId,
    offer: null,
    answer: null,
    pubIce: [],
    viewIce: [],
    sharing: false,
    label: "",
    talkSessionId,
    talkOffer: null,
    talkAnswer: null,
    talkCareIce: [],
    talkBellIce: [],
    talking: false,
    bellMomSessionId,
    bellMomOffer: null,
    bellMomAnswer: null,
    bellMomPubIce: [],
    bellMomViewIce: [],
    bellMomLive: false,
    updatedAt: new Date().toISOString(),
  };
}

function store(): Store {
  if (!g.__doorLive) g.__doorLive = empty();
  const s = g.__doorLive as Partial<Store> & Store;
  if (s.bellMomSessionId == null) {
    g.__doorLive = {
      ...empty(s.sessionId || 0, s.talkSessionId || 0, 0),
      ...s,
      bellMomSessionId: 0,
      bellMomOffer: null,
      bellMomAnswer: null,
      bellMomPubIce: [],
      bellMomViewIce: [],
      bellMomLive: false,
    };
  }
  return g.__doorLive;
}

export function getDoorLive(): SignalPayload {
  const s = store();
  return {
    ...s,
    pubIce: [...s.pubIce],
    viewIce: [...s.viewIce],
    talkCareIce: [...s.talkCareIce],
    talkBellIce: [...s.talkBellIce],
    bellMomPubIce: [...s.bellMomPubIce],
    bellMomViewIce: [...s.bellMomViewIce],
  };
}

export function resetDoorLive(): SignalPayload {
  const s = store();
  g.__doorLive = empty(
    (s.sessionId || 0) + 1,
    (s.talkSessionId || 0) + 1,
    (s.bellMomSessionId || 0) + 1,
  );
  return getDoorLive();
}

export function applyDoorLiveSignal(body: {
  role?: "pub" | "view" | "care" | "bell" | "mom" | "bellmom";
  type?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
  label?: string;
  sessionId?: number;
}): SignalPayload {
  const s = store();
  const role = body.role ?? "pub";
  const type = body.type ?? "";
  if ((role === "pub" || role === "view") && type !== "offer" && body.sessionId !== undefined && body.sessionId !== s.sessionId) {
    return getDoorLive();
  }

  if (type === "reset") {
    return resetDoorLive();
  }

  if (type === "offer" && body.sdp && (role === "pub" || role === "view")) {
    const keep = {
      talkSessionId: s.talkSessionId,
      talkOffer: s.talkOffer,
      talkAnswer: s.talkAnswer,
      talkCareIce: [...s.talkCareIce],
      talkBellIce: [...s.talkBellIce],
      talking: s.talking,
      bellMomSessionId: s.bellMomSessionId,
      bellMomOffer: s.bellMomOffer,
      bellMomAnswer: s.bellMomAnswer,
      bellMomPubIce: [...s.bellMomPubIce],
      bellMomViewIce: [...s.bellMomViewIce],
      bellMomLive: s.bellMomLive,
    };
    const next = empty((s.sessionId || 0) + 1, s.talkSessionId || 0, s.bellMomSessionId || 0);
    Object.assign(next, keep);
    next.offer = body.sdp;
    next.sharing = true;
    next.label = body.label || s.label || "Door camera";
    next.updatedAt = new Date().toISOString();
    g.__doorLive = next;
    return getDoorLive();
  }

  if (type === "answer" && body.sdp && role === "view") {
    s.answer = body.sdp;
    s.viewIce = [];
    s.updatedAt = new Date().toISOString();
  }

  if (type === "ice" && body.candidate) {
    if (role === "pub") s.pubIce.push(body.candidate);
    else if (role === "view") s.viewIce.push(body.candidate);
    else if (role === "care") s.talkCareIce.push(body.candidate);
    else if (role === "bell") s.talkBellIce.push(body.candidate);
    else if (role === "bellmom") s.bellMomPubIce.push(body.candidate);
    else if (role === "mom") s.bellMomViewIce.push(body.candidate);
    s.updatedAt = new Date().toISOString();
  }

  if (type === "stop" && (role === "pub" || role === "view")) {
    s.sharing = false;
    s.updatedAt = new Date().toISOString();
  }

  if (type === "talk-offer" && body.sdp) {
    s.talkSessionId = (s.talkSessionId || 0) + 1;
    s.talkOffer = body.sdp;
    s.talkAnswer = null;
    s.talkCareIce = [];
    s.talkBellIce = [];
    s.talking = true;
    s.updatedAt = new Date().toISOString();
  }

  if (type === "talk-answer" && body.sdp) {
    s.talkAnswer = body.sdp;
    s.talkBellIce = [];
    s.updatedAt = new Date().toISOString();
  }

  if (type === "talk-stop") {
    s.talking = false;
    s.talkOffer = null;
    s.talkAnswer = null;
    s.talkCareIce = [];
    s.talkBellIce = [];
    s.updatedAt = new Date().toISOString();
  }

  // —— Doorbell mic → Mom ——
  if (type === "bell-mom-offer" && body.sdp) {
    s.bellMomSessionId = (s.bellMomSessionId || 0) + 1;
    s.bellMomOffer = body.sdp;
    s.bellMomAnswer = null;
    s.bellMomPubIce = [];
    s.bellMomViewIce = [];
    s.bellMomLive = true;
    s.updatedAt = new Date().toISOString();
  }

  if (type === "bell-mom-answer" && body.sdp) {
    s.bellMomAnswer = body.sdp;
    s.bellMomViewIce = [];
    s.updatedAt = new Date().toISOString();
  }

  if (type === "bell-mom-stop") {
    s.bellMomLive = false;
    s.bellMomOffer = null;
    s.bellMomAnswer = null;
    s.bellMomPubIce = [];
    s.bellMomViewIce = [];
    s.updatedAt = new Date().toISOString();
  }

  return getDoorLive();
}
