"use client";

import { useEffect, useRef, useState } from "react";
import { runLine } from "@/lib/toolbox";

type Line = { text: string; tone: "in" | "out" | "err" | "sys" };

const GREETING = "c- toolbox. type  help  for the verb list. type  about  if you're stalling.";

export function Terminal() {
  const [lines, setLines] = useState<Line[]>([{ text: GREETING, tone: "sys" }]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd || busy) return;
    setInput("");
    setHistory((h) => [cmd, ...h].slice(0, 100));
    setHi(-1);
    setLines((l) => [...l, { text: `c- $ ${cmd}`, tone: "in" }]);
    setBusy(true);
    try {
      const r = await runLine(cmd);
      for (const t of r.out.split("\n"))
        setLines((l) => [...l, { text: t || " ", tone: r.ok ? "out" : "err" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[30rem] flex-col border border-border bg-[#05070a]">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto p-3 text-sm leading-relaxed">
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.tone === "in"
                ? "text-ink-dim"
                : l.tone === "err"
                  ? "text-accent-red"
                  : l.tone === "sys"
                    ? "text-accent-cyan"
                    : "whitespace-pre-wrap text-ink"
            }
          >
            {l.text}
          </div>
        ))}
      </div>
      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-border px-3 py-2"
      >
        <span className="text-accent">c- $</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              const n = Math.min(hi + 1, history.length - 1);
              if (history[n] != null) {
                setHi(n);
                setInput(history[n]!);
              }
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              const n = hi - 1;
              setHi(n);
              setInput(n >= 0 ? history[n]! : "");
            }
          }}
          autoFocus
          spellCheck={false}
          placeholder={'caesar "Khoor Zruog" all'}
          className="flex-1 bg-transparent text-ink outline-none placeholder:text-ink-dim/50"
        />
      </form>
    </div>
  );
}
