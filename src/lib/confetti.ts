/** A tiny canvas confetti burst. No dependency. No-ops under reduced-motion / SSR. */
export function burstConfetti(opts: { colors?: string[]; count?: number } = {}): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const colors = opts.colors ?? ["#5eb3ff", "#ffb340", "#4fd6a0", "#dce6f2"];
  const count = opts.count ?? 90;

  const cvs = document.createElement("canvas");
  cvs.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(cvs);
  const ctx = cvs.getContext("2d");
  if (!ctx) {
    cvs.remove();
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cvs.width = innerWidth * dpr;
  cvs.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const cx = innerWidth / 2;
  const cy = innerHeight * 0.38;
  type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number };
  const parts: P[] = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const sp = 4 + Math.random() * 8;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 3,
      r: 3 + Math.random() * 4,
      c: colors[(Math.random() * colors.length) | 0]!,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    };
  });

  const start = performance.now();
  function frame(t: number) {
    const dt = Math.min((t - start) / 1000, 3);
    ctx!.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.globalAlpha = Math.max(0, 1 - dt / 2.6);
      ctx!.fillStyle = p.c;
      ctx!.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      ctx!.restore();
    }
    if (dt < 2.6) requestAnimationFrame(frame);
    else cvs.remove();
  }
  requestAnimationFrame(frame);
}
