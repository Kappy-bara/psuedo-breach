/// <reference lib="webworker" />
import { run } from "./interpreter";
import type { CminusBridge } from "./interpreter";

type InMsg = { type: "run"; id: number; source: string; stdin: string[] };
type BridgeReply = { type: "bridge-result"; callId: number; value: unknown; error?: string };

let pendingCall = 0;
const waiters = new Map<number, (v: { value: unknown; error?: string }) => void>();

function callBridge(op: string, args: string[]): Promise<unknown> {
  const callId = ++pendingCall;
  return new Promise((resolve, reject) => {
    waiters.set(callId, ({ value, error }) => (error ? reject(new Error(error)) : resolve(value)));
    (self as unknown as Worker).postMessage({ type: "bridge", callId, op, args });
  });
}

const bridge: CminusBridge = {
  probe: (m) => callBridge("probe", [m]) as Promise<string>,
  knock: (m, k) => callBridge("knock", [m, k]) as Promise<string>,
  stash: async (k, v) => {
    await callBridge("stash", [k, v]);
  },
  recall: (k) => callBridge("recall", [k]) as Promise<string | null>,
  hint: () => callBridge("hint", []) as Promise<string>,
};

self.onmessage = async (e: MessageEvent<InMsg | BridgeReply>) => {
  const msg = e.data;
  if (msg.type === "bridge-result") {
    waiters.get(msg.callId)?.({ value: msg.value, error: msg.error });
    waiters.delete(msg.callId);
    return;
  }
  if (msg.type === "run") {
    const result = await run(msg.source, {
      stdin: msg.stdin,
      onOutput: (chunk) => (self as unknown as Worker).postMessage({ type: "out", chunk }),
      bridge,
    });
    (self as unknown as Worker).postMessage({ type: "done", id: msg.id, result });
  }
};
