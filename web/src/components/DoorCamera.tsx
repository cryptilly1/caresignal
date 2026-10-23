"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSecureMediaContext, speak } from "@/lib/speech";

type Props = {
  announce?: boolean;
  label?: string;
  className?: string;
  /** Prefer back camera on phones */
  defaultFacing?: "environment" | "user";
};

export function DoorCamera({
  announce = false,
  label = "Phone camera (door stand-in)",
  className = "",
  defaultFacing = "environment",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">(defaultFacing);
  const [mirrored, setMirrored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOn(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(
    async (face: "environment" | "user" = facing) => {
      setError(null);
      if (!isSecureMediaContext()) {
        setError(
          "Phone cameras need an https:// link. On your Mac run: npm run phone — then open the https URL it prints.",
        );
        return;
      }
      // Stop previous before switching lenses
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: face },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setFacing(face);
        setOn(true);
        if (announce) speak("Phone camera is on.");
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not open the camera.";
        setError(
          msg.includes("Permission")
            ? "Allow Camera in the browser prompt / phone Settings."
            : msg,
        );
        speak("I could not open the camera. Check permissions.");
      }
    },
    [announce, facing],
  );

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-[1.25rem] bg-black/50 aspect-video border border-white/10">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover ${on ? "opacity-100" : "opacity-0"} ${mirrored ? "-scale-x-100" : ""}`}
        />
        {!on && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <div>
              <p className="font-semibold text-white/90">{label}</p>
              <p className="text-xs text-white/50 mt-1">
                Uses this phone’s camera — back camera by default
              </p>
            </div>
          </div>
        )}
        {on && (
          <span className="absolute left-2 bottom-2 chip chip-urgent text-[10px]">
            LIVE · {facing === "environment" ? "back" : "front"}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {!on ? (
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => start("environment")}
          >
            Use phone camera
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() =>
                start(facing === "environment" ? "user" : "environment")
              }
            >
              Flip camera
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() => setMirrored((m) => !m)}
            >
              {mirrored ? "Mirror on" : "Mirror"}
            </button>
            <button type="button" className="btn btn-ghost text-sm" onClick={stop}>
              Stop
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-[#ffd60a] leading-relaxed">{error}</p>
      )}
    </div>
  );
}
