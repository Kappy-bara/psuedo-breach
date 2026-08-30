"use client";

import { useEffect, useRef, useState } from "react";

/** Animates from its previous value to a new one whenever `value` changes. */
export function CountUp({
  value,
  className = "",
  durationMs = 550,
}: {
  value: number;
  className?: string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (value === from.current) return;
    const reduced =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const a = from.current;
    const b = value;
    from.current = b;
    const start = performance.now();
    const tick = (t: number) => {
      const p = reduced ? 1 : Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (b - a) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs]);

  return <span className={`tabular-nums ${className}`}>{shown.toLocaleString()}</span>;
}
