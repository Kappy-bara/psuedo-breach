"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { useToast } from "@/components/ToastProvider";
import { burstConfetti } from "@/lib/confetti";
import type { PuzzleView } from "@/lib/game";

const diffColor: Record<string, string> = {
  easy: "text-verified",
  medium: "text-accent",
  hard: "text-signal",
  boss: "text-danger",
};

export function PuzzlePanel({
  puzzle,
  moduleLocked,
}: {
  puzzle: PuzzleView;
  moduleLocked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(puzzle.cooldownUntil);
  const [now, setNow] = useState(() => Date.now());

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
        case "correct": {
          const medalTxt = { gold: " · 🥇 first!", silver: " · 🥈", bronze: " · 🥉" }[
            o.medal as string
          ] ?? "";
          setMsg({
            kind: "ok",
            text: `CRACKED — +${o.base + o.bonus} pts${o.roomCleared ? " · ROOM CLEARED" : ""}`,
          });
          toast({
            tone: o.solveIndex === 0 ? "signal" : "ok",
            title:
              (o.solveIndex === 0 ? "FIRST BLOOD 🩸 " : "Cracked ✓ ") +
              `+${o.base + o.bonus} pts${medalTxt}`,
            body: puzzle.rewardsLabel ? `loot: ${puzzle.rewardsLabel}` : undefined,
          });
          for (const a of o.newAchievements ?? []) {
            toast({
              tone: "loot",
              title: `${a.icon} ${a.name}`,
              body:
                (a.title ? `title: “${a.title}”` : "") +
                (a.credReward ? `  ·  +${a.credReward} 💰` : ""),
            });
          }
          if (o.roomCleared || (o.newAchievements ?? []).length) burstConfetti();
          setValue("");
          router.refresh();
          break;
        }
        case "already-solved":
          setMsg({ kind: "info", text: "Already cracked." });
          router.refresh();
          break;
        case "wrong":
          setCooldownUntil(o.cooldownUntil);
          setNow(Date.now());
          setMsg({
            kind: "err",
            text:
              `Not it. (${o.wrongCount} wrong)` +
              (o.credsTaken ? ` · toll: -${o.credsTaken} 💰` : ""),
          });
          if (o.credsTaken) toast({ tone: "info", title: `Honeypot toll: -${o.credsTaken} 💰` });
          router.refresh();
          break;
        case "cooldown":
          setCooldownUntil(o.cooldownUntil);
          setNow(Date.now());
          setMsg({ kind: "err", text: "Cooldown still active." });
          break;
        case "locked":
        case "closed":
          setMsg({ kind: "err", text: o.reason });
          break;
        default:
          setMsg({ kind: "err", text: "Not found." });
      }
    } catch {
      setMsg({ kind: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`panel p-5 ${puzzle.solved ? "border-verified/45 bg-verified/[0.05]" : ""}`}>
      {puzzle.leakInSource && (
        <div
          dangerouslySetInnerHTML={{
            __html: `<!-- reminder: strip debug comments before shipping. flag=${puzzle.leakInSource} -->`,
          }}
        />
      )}
      {puzzle.domFlagB64 && (
        <>
          <div hidden data-vault={puzzle.domFlagB64} />
          <script
            dangerouslySetInnerHTML={{
              __html: `/* client-side gate, totally secure */ var user={isAdmin:false}; if(user.isAdmin){/* would show it here */}`,
            }}
          />
        </>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold">{puzzle.title}</h3>
        <span className="font-mono text-xs text-ink-dim">
          <span className={diffColor[puzzle.difficulty] ?? "text-ink"}>{puzzle.difficulty}</span> ·{" "}
          {puzzle.basePoints} pts
        </span>
      </div>

      <Markdown className="mt-3">{puzzle.promptMd}</Markdown>

      {(puzzle.rewardsLabel || puzzle.wrongCostCreds > 0) && !puzzle.solved && (
        <p className="mt-3 text-xs text-ink-dim">
          {puzzle.rewardsLabel && (
            <>
              loot: <span className="text-verified">{puzzle.rewardsLabel}</span>
            </>
          )}
          {puzzle.wrongCostCreds > 0 && (
            <>
              {puzzle.rewardsLabel && " · "}
              <span className="text-danger">wrong guess costs {puzzle.wrongCostCreds} 💰</span>
            </>
          )}
        </p>
      )}

      {puzzle.solved ? (
        <p className="mt-4 border border-verified/40 bg-verified/10 px-3 py-2 text-sm text-verified">
          ✓ cracked — +{(puzzle.solveInfo?.basePts ?? 0) + (puzzle.solveInfo?.bonusPts ?? 0)} pts
          {puzzle.solveInfo?.solveIndex === 0 && " · first blood"}
          {puzzle.solveInfo?.solveIndex === 1 && " · 🥈"}
          {puzzle.solveInfo?.solveIndex === 2 && " · 🥉"}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="CMINUS{...}"
              disabled={busy || moduleLocked || cooldownLeft > 0}
              className="flex-1 border border-border bg-panel-2 px-3 py-2 font-mono text-ink outline-none focus:border-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || moduleLocked || cooldownLeft > 0 || !value.trim()}
              className="btn px-4"
            >
              {cooldownLeft > 0 ? `${cooldownLeft}s` : busy ? "…" : "submit"}
            </button>
          </div>
          {msg && (
            <p
              className={`px-3 py-2 text-sm ${
                msg.kind === "ok"
                  ? "border border-verified/40 bg-verified/10 text-verified"
                  : msg.kind === "err"
                    ? "border border-danger/40 bg-danger/10 text-danger"
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
