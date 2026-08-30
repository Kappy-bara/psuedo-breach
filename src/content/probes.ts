import { userFlag } from "@/lib/flags";
import { xorStr } from "@/lib/cminus/builtins";

const b64 = (s: string) => Buffer.from(s, "latin1").toString("base64");
const hex = (s: string) => Buffer.from(s, "latin1").toString("hex");
const reverse = (s: string) => [...s].reverse().join("");

/**
 * What `probe(moduleSlug)` returns in the terminal, personalised per user.
 * Keep these in sync with the puzzle prompts in prisma/seed.ts.
 */
export const PROBES: Record<string, (userId: string) => string> = {
  "orientation": () =>
    "nothing to see here. the flag is in the page, not the wire. (mostly.)",

  "signal-noise": (uid) => {
    // M5 — signal is the flag, reversed then base64'd, buried in filler
    const payload = b64(reverse(userFlag(uid, "stego-lines")));
    return [
      "-- carrier lock --",
      "noise: 8f2a c1d9 40b0 77e1",
      `sig : ${payload}`,
      "noise: 00ff a1a1 9c9c 3b3b",
      "-- the sig is not plaintext. it was reversed before it was wrapped. --",
    ].join("\n");
  },

  "compilers-curse": (uid) => {
    const chain = b64(xorStr(reverse(userFlag(uid, "read-the-program")), "curse"));
    return [
      "the program that ran here:",
      '  yell b64e(xor(reverse(SECRET), "curse"));',
      "it printed:",
      `  ${chain}`,
      "undo it.",
    ].join("\n");
  },

  "the-vault": () =>
    'sealed. knock("the-vault", "open") once you hold all three module tokens.',

  "front-door": () =>
    'token seen on the wire: eyJ1c2VyIjoiZ3Vlc3QiLCJhZG1pbiI6ZmFsc2V9\n(that\'s base64. decode it. change your mind about "admin". re-encode.)',

  "boot-camp": (uid) => {
    const blob = hex(xorStr(userFlag(uid, "xor-decode"), "cminus"));
    return `xor blob (key is "cminus"):\n  ${blob}`;
  },

  "caesars-ghost": () =>
    "GHOST left a chain: base64 on the outside, a Vigenère (key GHOST) on the inside.",

  "dom-dimension": () => "look in the DOM, not here. check hidden nodes and data- attributes.",

  "tiny-cipher": () => "it's a Caesar shift. small. try caesar(text, -3).",
  "hello-breacher": () => "view source. there's a comment that isn't for you.",
  "pass-the-token": () => "solve TINY CIPHER first — it hands you the relay token.",
};

export function runProbe(moduleSlug: string, userId: string): string | null {
  const p = PROBES[moduleSlug];
  return p ? p(userId) : null;
}
