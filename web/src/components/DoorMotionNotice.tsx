"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";

const announced = new Set<string>();

export function DoorMotionNotice({ event }: { event?: { id: string; at: string } | null }) {
  const [visible, setVisible] = useState(false);
  const id = event?.id;
  const at = event?.at;
  useEffect(() => {
    const fresh = id && at && Date.now() - new Date(at).getTime() < 120_000 && !announced.has(id);
    const show = window.setTimeout(() => {
      if (fresh) { announced.add(id); if (announced.size > 100) announced.delete(announced.values().next().value!); }
      setVisible(!!fresh);
    }, 0);
    const hide = window.setTimeout(() => setVisible(false), 6000);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [id, at]);
  return visible && <div className="door-motion-notice" role="status">
    <BellRing aria-hidden="true" size={20} /><span>There’s motion at the door.</span>
    <button aria-label="Dismiss motion notification" onClick={() => setVisible(false)} type="button"><X aria-hidden="true" size={18} /></button>
  </div>;
}
