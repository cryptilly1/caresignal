"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Monitor, Smartphone, ArrowUpRight } from "lucide-react";

type View = "web" | "mobile";

export function AppViewport({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [view, setView] = useState<View | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const [source, setSource] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEmbedded(window.self !== window.top && window.name === "caresignal-mobile-preview");
      setSource(window.location.pathname + window.location.search);
      try {
        setView(sessionStorage.getItem("caresignal-viewport") === "mobile" ? "mobile" : "web");
      } catch {
        setView("web");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function select(next: View) {
    setView(next);
    try { sessionStorage.setItem("caresignal-viewport", next); } catch { /* Preview preference is optional when browser storage is blocked. */ }
  }

  if (pathname === "/" || embedded) return children;

  return (
    <div className="app-viewport">
      <header className="app-viewport__toolbar">
        <Link href="/" className="app-viewport__brand">CareSignal <span>website</span><ArrowUpRight size={14} /></Link>
        <div className="app-viewport__switch" role="group" aria-label="App viewport">
          <button type="button" aria-pressed={view === "web"} onClick={() => select("web")}><Monitor size={16} />Web</button>
          <button type="button" aria-pressed={view === "mobile"} onClick={() => select("mobile")}><Smartphone size={16} />Mobile</button>
        </div>
      </header>
      {view === null ? <div className="app-viewport__loading" role="status">Opening CareSignal...</div> : view === "mobile" ? <div className="app-viewport__stage"><p>Mobile preview <span>390 px</span></p><iframe name="caresignal-mobile-preview" title="CareSignal mobile viewport" src={source} className="app-viewport__frame" allow="camera; microphone; autoplay" /></div> : children}
    </div>
  );
}
