/** Pure, dependency-free cipher / encoding helpers. Shared by the toolbox and prompt rendering. */

const A = "a".charCodeAt(0);
const Z = "z".charCodeAt(0);
const AU = "A".charCodeAt(0);

export function rotChar(ch: string, n: number): string {
  const c = ch.charCodeAt(0);
  const k = ((n % 26) + 26) % 26;
  if (c >= A && c <= Z) return String.fromCharCode(((c - A + k) % 26) + A);
  if (c >= AU && c <= AU + 25) return String.fromCharCode(((c - AU + k) % 26) + AU);
  return ch;
}

export function rot(s: string, n: number): string {
  return [...s].map((c) => rotChar(c, n)).join("");
}

export function vigenere(s: string, key: string, decrypt = false): string {
  const k = key.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) throw new Error("vigenere needs a key with letters in it");
  let ki = 0;
  return [...s]
    .map((c) => {
      if (!/[a-zA-Z]/.test(c)) return c;
      const shift = k.charCodeAt(ki % k.length) - A;
      ki++;
      return rotChar(c, decrypt ? -shift : shift);
    })
    .join("");
}

export function xorStr(s: string, key: string): string {
  if (!key) throw new Error("xor needs a key");
  return [...s]
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
    .join("");
}

export const b64e = (s: string) => btoa(unescape(encodeURIComponent(s)));
export const b64d = (s: string) => decodeURIComponent(escape(atob(s)));
export const hexe = (s: string) =>
  [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
export const hexd = (h: string) =>
  (h.replace(/\s+/g, "").match(/.{1,2}/g) ?? [])
    .map((b) => String.fromCharCode(parseInt(b, 16)))
    .join("");

export const toBinary = (s: string) =>
  [...s].map((c) => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
export const fromBinary = (bits: string) =>
  (bits.replace(/[^01]/g, "").match(/.{1,8}/g) ?? [])
    .map((b) => String.fromCharCode(parseInt(b, 2)))
    .join("");

const MORSE: Record<string, string> = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....",
  i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.",
  q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-",
  y: "-.--", z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--",
  "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
};
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export const toMorse = (s: string) =>
  s
    .toLowerCase()
    .split("")
    .map((c) => (c === " " ? "/" : (MORSE[c] ?? "")))
    .filter(Boolean)
    .join(" ");
export const fromMorse = (m: string) =>
  m
    .trim()
    .split(/\s+/)
    .map((sym) => (sym === "/" ? " " : (UNMORSE[sym] ?? "?")))
    .join("");
