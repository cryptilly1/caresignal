"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Monitor, Smartphone, ArrowUpRight, ChevronUp, PanelTopOpen } from "lucide-react";
import { BrandMark } from "./BrandMark";

type View = "web" | "mobile";
const NARROW_VIEWPORT = "(max-width: 760px)";

function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(NARROW_VIEWPORT);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isNarrowViewport() {
  return window.matchMedia(NARROW_VIEWPORT).matches;
}

function serverViewport() {
  return false;
}

export function AppViewport({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [view, setView] = useState<View | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const [source, setSource] = useState("");
  const [controlsHidden, setControlsHidden] = useState(false);
  const controlsId = useId();
  const showRef = useRef<HTMLButtonElement>(null);
  const hideRef = useRef<HTMLButtonElement>(null);
  const nativeMobile = useSyncExternalStore(subscribeToViewport, isNarrowViewport, serverViewport);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEmbedded(window.self !== window.top && window.name === "caresignal-mobile-preview");
      setSource(window.location.pathname + window.location.search);
      try {
        setView(sessionStorage.getItem("caresignal-viewport") === "mobile" ? "mobile" : "web");
        setControlsHidden(sessionStorage.getItem("caresignal-viewport-controls") === "hidden");
      } catch {
        setView("web");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function select(next: View) {
    if (next === "mobile") setSource(window.location.pathname + window.location.search);
    setView(next);
    try { sessionStorage.setItem("caresignal-viewport", next); } catch { /* Preview preference is optional when browser storage is blocked. */ }
  }

  function toggleControls(hidden: boolean) {
    setControlsHidden(hidden);
    try { sessionStorage.setItem("caresignal-viewport-controls", hidden ? "hidden" : "visible"); } catch { /* Preview preferences are optional. */ }
    requestAnimationFrame(() => (hidden ? showRef : hideRef).current?.focus());
  }

  if (pathname === "/" || embedded || nativeMobile) return children;

  return (
    <div className={`app-viewport${view ? ` app-viewport--${view}` : ""}${controlsHidden ? " app-viewport--controls-hidden" : ""}`}>
      <header className="app-viewport__toolbar" id={controlsId} hidden={controlsHidden}>
        <Link href="/" className="app-viewport__brand"><BrandMark />CareSignal <span>website</span><ArrowUpRight size={14} /></Link>
        <div className="app-viewport__controls">
          <div className="app-viewport__switch" role="group" aria-label="App viewport">
            <button type="button" aria-pressed={view === "web"} onClick={() => select("web")}><Monitor size={16} />Web</button>
            <button type="button" aria-pressed={view === "mobile"} onClick={() => select("mobile")}><Smartphone size={16} />Mobile</button>
          </div>
          <button type="button" className="app-viewport__hide" ref={hideRef} aria-label="Hide preview controls" aria-controls={controlsId} aria-expanded onClick={() => toggleControls(true)}><ChevronUp size={17} />Hide</button>
        </div>
      </header>
      {controlsHidden && <button type="button" className="app-viewport__show" ref={showRef} aria-controls={controlsId} aria-expanded={false} onClick={() => toggleControls(false)}><PanelTopOpen size={17} />Show controls</button>}
      {view === null ? <div className="app-viewport__loading" role="status">Opening CareSignal...</div> : view === "mobile" ? <div className="app-viewport__stage">
        <p>iPhone 16 Pro <span>402 x 874 px</span></p>
        <div className="app-viewport__device">
          <iframe name="caresignal-mobile-preview" title="CareSignal iPhone 16 Pro preview" src={source} className="app-viewport__frame" allow="camera; microphone; autoplay" />
        </div>
      </div> : children}
    </div>
  );
}
