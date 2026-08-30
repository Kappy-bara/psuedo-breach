"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Line = { text: string; tone?: "in" | "out" | "err" | "sys" };

const HELP = `commands:
  run                 run the editor buffer
  <c- code>           run a one-liner, e.g.  yell caesar("Khoor", -3);
  clear               clear this console
  spec                print the c- cheat-sheet
  connect <module>    set the module the terminal talks to (probe/knock default to it)
  probe(...) knock(...) stash(...) recall(...) hint(...)   talk to the server
  whoami              who you are
the editor on the left persists in your browser. Ctrl+Enter runs it.`;

const SPEC = `c- cheat-sheet
  meh x = 10;              declare        iff / elz               if / else
  yell x;   say x;         print          whyle cond { }          loop
  plz f(a){ gimme a; }     function       brek / moar             break / continue
  ask "prompt"             read a line    yes no nothin           true false null
ciphers   rot caesar vigenere xor          encodings  b64e b64d hexe hexd
hashes    sha256 md5                       text/list  len upper lower slice push range split join
bridge    probe(m) knock(m,k) stash(k,v) recall(k) hint(m)`;

const DEFAULT_BUF = `?? scratchpad — edit me, hit Run (or Ctrl+Enter)
meh ct = "Wkh txlfn eurzq ira";
meh n = 0;
whyle n < 26 {
  yell n + ":  " + caesar(ct, -n);
  n = n + 1;
}
`;

export function Terminal({ registerId, displayName }: { registerId: string; displayName: string }) {
  const [lines, setLines] = useState<Line[]>([
    { text: "PSEUDO-BREACH terminal · c- v1 · type 'help'", tone: "sys" },
  ]);
  const [buf, setBuf] = useState(DEFAULT_BUF);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState<string>("");
  const workerRef = useRef<Worker | null>(null);
  const runId = useRef(0);
  const doners = useRef<Map<number, () => void>>(new Map());
  const scroller = useRef<HTMLDivElement>(null);

  const push = useCallback((text: string, tone?: Line["tone"]) => {
    for (const t of text.split("\n")) setLines((l) => [...l, { text: t, tone }]);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pb:buf");
      if (saved != null) setBuf(saved);
      const c = localStorage.getItem("pb:connected");
      if (c) setConnected(c);
    } catch {}
  }, []);

  useEffect(() => {
    const w = new Worker(new URL("../lib/cminus/worker.ts", import.meta.url));
    workerRef.current = w;
    w.onmessage = async (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "out") {
        push(m.chunk.replace(/\n$/, ""), "out");
      } else if (m.type === "bridge") {
        try {
          const res = await fetch("/api/terminal", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ op: m.op, args: m.args }),
          });
          const data = await res.json();
          w.postMessage({
            type: "bridge-result",
            callId: m.callId,
            value: data.result ?? null,
            error: res.ok ? undefined : data.error ?? "server error",
          });
        } catch {
          w.postMessage({ type: "bridge-result", callId: m.callId, value: null, error: "network error" });
        }
      } else if (m.type === "done") {
        if (m.result.error) {
          push(`✖ ${m.result.error}${m.result.errorLine ? ` (line ${m.result.errorLine})` : ""}`, "err");
        }
        doners.current.get(m.id)?.();
        doners.current.delete(m.id);
        setRunning(false);
      }
    };
    return () => w.terminate();
  }, [push]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  const runSource = useCallback(
    (source: string) => {
      if (!workerRef.current || running) return;
      setRunning(true);
      const id = ++runId.current;
      // rewrite bare probe/knock/... with no module to use the connected one
      const withCtx =
        connected && /\b(probe|knock|hint)\s*\(\s*\)/.test(source)
          ? source.replace(/\b(probe|knock|hint)\s*\(\s*\)/g, `$1("${connected}")`)
          : source;
      doners.current.set(id, () => {});
      workerRef.current.postMessage({ type: "run", id, source: withCtx, stdin: [] });
    },
    [connected, running],
  );

  function saveBuf(v: string) {
    setBuf(v);
    try {
      localStorage.setItem("pb:buf", v);
    } catch {}
  }

  function handleCommand(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    push(`c- $ ${cmd}`, "in");
    setHistory((h) => [cmd, ...h].slice(0, 100));
    setHistIdx(-1);

    const [head, ...rest] = cmd.split(/\s+/);
    switch (head) {
      case "help":
        push(HELP, "sys");
        return;
      case "spec":
        push(SPEC, "sys");
        return;
      case "clear":
        setLines([]);
        return;
      case "whoami":
        push(`${displayName} · ${registerId}`, "sys");
        return;
      case "run":
        runSource(buf);
        return;
      case "connect": {
        const m = rest[0] ?? "";
        setConnected(m);
        try {
          localStorage.setItem("pb:connected", m);
        } catch {}
        push(m ? `terminal is now pointed at "${m}"` : "disconnected", "sys");
        return;
      }
      default:
        // treat the whole line as c-
        runSource(cmd.endsWith(";") || cmd.includes("{") ? cmd : cmd + ";");
    }
  }

  const promptHint = useMemo(
    () => (connected ? `c- [${connected}] $` : "c- $"),
    [connected],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* editor */}
      <div className="flex h-[28rem] flex-col border border-border bg-panel/60">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-ink-dim">
          <span>scratch.c-</span>
          <button
            onClick={() => runSource(buf)}
            disabled={running}
            className="border border-accent/50 px-2 py-0.5 text-accent hover:bg-accent hover:text-bg disabled:opacity-40 transition-colors"
          >
            {running ? "running…" : "▶ run  (Ctrl+Enter)"}
          </button>
        </div>
        <textarea
          value={buf}
          onChange={(e) => saveBuf(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              runSource(buf);
            }
          }}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none bg-transparent p-3 text-sm text-ink outline-none"
        />
      </div>

      {/* console */}
      <div className="flex h-[28rem] flex-col border border-border bg-[#05070a]">
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto p-3 text-sm leading-relaxed"
        >
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
                      : "text-ink"
              }
            >
              {l.text || " "}
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCommand(input);
            setInput("");
          }}
          className="flex items-center gap-2 border-t border-border px-3 py-2"
        >
          <span className="text-accent">{promptHint}</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const ni = Math.min(histIdx + 1, history.length - 1);
                if (history[ni] != null) {
                  setHistIdx(ni);
                  setInput(history[ni]!);
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const ni = histIdx - 1;
                setHistIdx(ni);
                setInput(ni >= 0 ? history[ni]! : "");
              }
            }}
            spellCheck={false}
            autoFocus
            className="flex-1 bg-transparent text-ink outline-none"
            placeholder="yell b64d(&quot;aGk=&quot;);   ·   help"
          />
        </form>
      </div>
    </div>
  );
}
