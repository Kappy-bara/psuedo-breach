"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import type { PuzzleView } from "@/lib/game";

const diffColor: Record<string, string> = {
  easy: "text-accent",
  medium: "text-accent-cyan",
  hard: "text-accent-amber",
  boss: "text-accent-red",
};

export function PuzzlePanel({ puzzle, moduleLocked }: { puzzle: PuzzleView; moduleLocked: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(puzzle.cooldownUntil);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!cooldownUntil) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  const cooldownLeft = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !value.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ puzzleSlug: puzzle.slug, value: value.trim() }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setMsg({ kind: "err", text: "Slow down — you're submitting too fast." });
        return;
      }
      const o = data.outcome;
      if (!o) {
        setMsg({ kind: "err", text: data.error ?? "Something went wrong." });
        return;
      }
      switch (o.status) {
        case "correct":
          setMsg({
            kind: "ok",
            text: `SOLVED — +${o.base} base +${o.bonus} bonus${
              o.tokenGranted ? ` · token "${o.tokenGranted}" granted` : ""
            }${o.solveIndex === 0 ? " · FIRST BLOOD 🩸" : ""}`,
          });
          setValue("");
          router.refresh();
          break;
        case "already-solved":
          setMsg({ kind: "info", text: "You already solved this one." });
          router.refresh();
          break;
        case "wrong":
          setCooldownUntil(o.cooldownUntil);
          setNow(Date.now());
          setMsg({ kind: "err", text: `Not it. (${o.wrongCount} wrong so far)` });
          router.refresh();
          break;
        case "cooldown":
          setCooldownUntil(o.cooldownUntil);
          setNow(Date.now());
          setMsg({ kind: "err", text: "Cooldown still active." });
          break;
        case "locked":
          setMsg({ kind: "err", text: o.reason });
          break;
        case "closed":
          setMsg({ kind: "err", text: o.reason });
          break;
        default:
          setMsg({ kind: "err", text: "Puzzle not found." });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`border p-5 ${
        puzzle.solved ? "border-accent/50 bg-accent/[0.05]" : "border-border bg-panel/60"
      }`}
    >
      {/* hidden flag for View-Source puzzles */}
      {puzzle.leakInSource && (
        <div
          dangerouslySetInnerHTML={{
            __html: `<!-- do not ship comments like this. flag: ${puzzle.leakInSource} -->`,
          }}
        />
      )}
      {puzzle.domFlagB64 && (
        <>
          <div hidden data-vault={puzzle.domFlagB64} />
          <script
            dangerouslySetInnerHTML={{
              __html: `/* client-side gate, very secure */ var user={isAdmin:false}; if(user.isAdmin){/* would reveal it here */}`,
            }}
          />
        </>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-bold">{puzzle.title}</h3>
        <span className="text-xs text-ink-dim">
          <span className={diffColor[puzzle.difficulty] ?? "text-ink"}>{puzzle.difficulty}</span>{" "}
          · {puzzle.basePoints} pts
        </span>
      </div>

      <Markdown className="mt-3">{puzzle.promptMd}</Markdown>

      {puzzle.solved ? (
        <p className="mt-4 border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
          ✓ solved — +{puzzle.solveInfo?.basePts} base, +{puzzle.solveInfo?.bonusPts} bonus
          {puzzle.solveInfo?.solveIndex === 0 && " · first blood"}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                puzzle.type === "cminus-output" ? "paste your program's output" : "CMINUS{...}"
              }
              disabled={busy || moduleLocked || cooldownLeft > 0}
              className="flex-1 border border-border bg-panel-2 px-3 py-2 text-ink outline-none focus:border-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || moduleLocked || cooldownLeft > 0 || !value.trim()}
              className="border border-accent bg-accent/10 px-4 font-bold text-accent hover:bg-accent hover:text-bg disabled:opacity-40 transition-colors"
            >
              {cooldownLeft > 0 ? `${cooldownLeft}s` : busy ? "…" : "submit"}
            </button>
          </div>
          {msg && (
            <p
              className={`px-3 py-2 text-sm ${
                msg.kind === "ok"
                  ? "border border-accent/40 bg-accent/10 text-accent"
                  : msg.kind === "err"
                    ? "border border-accent-red/40 bg-accent-red/10 text-accent-red"
                    : "border border-border bg-panel-2 text-ink-dim"
              }`}
            >
              {msg.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
