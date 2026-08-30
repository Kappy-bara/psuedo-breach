import { CminusError } from "./lexer";

export type CValue = number | string | boolean | null | CValue[] | CFunction;
export interface CFunction {
  __cfn: true;
  name: string;
  arity: number | "any";
  call: (args: CValue[]) => Promise<CValue> | CValue;
}

export function isFn(v: CValue): v is CFunction {
  return typeof v === "object" && v !== null && (v as CFunction).__cfn === true;
}

export function cstr(v: CValue): string {
  if (v === null) return "nothin";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return "[" + v.map(cstr).join(", ") + "]";
  if (isFn(v)) return `<plz ${v.name}>`;
  return String(v);
}

export function truthy(v: CValue): boolean {
  if (v === null || v === false) return false;
  if (v === 0 || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function need(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new CminusError(msg);
}
const S = (v: CValue, fn: string, pos = 0): string => {
  need(typeof v === "string", `${fn}: argument ${pos + 1} must be a str`);
  return v as string;
};
const N = (v: CValue, fn: string, pos = 0): number => {
  need(typeof v === "number", `${fn}: argument ${pos + 1} must be an int`);
  return v as number;
};

/* ── ciphers / encodings (pure, browser-safe) ── */
const A = "a".charCodeAt(0);
const Z = "z".charCodeAt(0);
const AU = "A".charCodeAt(0);

function rotChar(ch: string, n: number): string {
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
  if (!k) throw new CminusError("vigenere: key must contain letters");
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
  if (!key) throw new CminusError("xor: key must not be empty");
  return [...s]
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
    .join("");
}
const b64e = (s: string) => btoa(unescape(encodeURIComponent(s)));
const b64d = (s: string) => decodeURIComponent(escape(atob(s)));
const hexe = (s: string) =>
  [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
const hexd = (h: string) =>
  (h.match(/.{1,2}/g) ?? []).map((b) => String.fromCharCode(parseInt(b, 16))).join("");

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* compact MD5 (RFC 1321) — subtle.digest has no MD5 */
function md5hex(str: string): string {
  function toBytes(s: string) {
    const utf8 = unescape(encodeURIComponent(s));
    const b = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) b[i] = utf8.charCodeAt(i);
    return b;
  }
  function rl(x: number, c: number) {
    return (x << c) | (x >>> (32 - c));
  }
  const bytes = toBytes(str);
  const bitLen = bytes.length * 8;
  const withOne = new Uint8Array(((bytes.length + 8) >> 6 << 6) + 64);
  withOne.set(bytes);
  withOne[bytes.length] = 0x80;
  const dv = new DataView(withOne.buffer);
  dv.setUint32(withOne.length - 8, bitLen >>> 0, true);
  dv.setUint32(withOne.length - 4, Math.floor(bitLen / 0x100000000), true);

  const K = Array.from({ length: 64 }, (_, i) =>
    Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296),
  );
  const Sh = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20,
    5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let off = 0; off < withOne.length; off += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
    let [A2, B2, C2, D2] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) {
        F = (B2 & C2) | (~B2 & D2);
        g = i;
      } else if (i < 32) {
        F = (D2 & B2) | (~D2 & C2);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B2 ^ C2 ^ D2;
        g = (3 * i + 5) % 16;
      } else {
        F = C2 ^ (B2 | ~D2);
        g = (7 * i) % 16;
      }
      F = (F + A2 + K[i]! + M[g]!) >>> 0;
      A2 = D2;
      D2 = C2;
      C2 = B2;
      B2 = (B2 + rl(F, Sh[i]!)) >>> 0;
    }
    a0 = (a0 + A2) >>> 0;
    b0 = (b0 + B2) >>> 0;
    c0 = (c0 + C2) >>> 0;
    d0 = (d0 + D2) >>> 0;
  }
  const hex = (n: number) =>
    [0, 8, 16, 24].map((s) => ((n >>> s) & 0xff).toString(16).padStart(2, "0")).join("");
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

function fn(
  name: string,
  arity: number | "any",
  call: (a: CValue[]) => Promise<CValue> | CValue,
): CFunction {
  return { __cfn: true, name, arity, call };
}

/** Pure builtins available in every c- program. */
export function pureBuiltins(): Record<string, CFunction> {
  const defs: CFunction[] = [
    fn("len", 1, (a) => {
      const v = a[0];
      if (typeof v === "string") return v.length;
      if (Array.isArray(v)) return v.length;
      throw new CminusError("len: needs a str or list");
    }),
    fn("int", 1, (a) => {
      const v = a[0];
      const n = typeof v === "boolean" ? (v ? 1 : 0) : parseInt(String(v), 10);
      if (Number.isNaN(n)) throw new CminusError(`int: cannot convert ${cstr(v!)}`);
      return n;
    }),
    fn("str", 1, (a) => cstr(a[0]!)),
    fn("chr", 1, (a) => String.fromCharCode(N(a[0]!, "chr"))),
    fn("ord", 1, (a) => S(a[0]!, "ord").charCodeAt(0)),
    fn("upper", 1, (a) => S(a[0]!, "upper").toUpperCase()),
    fn("lower", 1, (a) => S(a[0]!, "lower").toLowerCase()),
    fn("reverse", 1, (a) => {
      const v = a[0];
      if (typeof v === "string") return [...v].reverse().join("");
      if (Array.isArray(v)) return [...v].reverse();
      throw new CminusError("reverse: needs a str or list");
    }),
    fn("slice", "any", (a) => {
      const v = a[0];
      const start = N(a[1] ?? 0, "slice", 1);
      const end = a[2] === undefined ? undefined : N(a[2], "slice", 2);
      if (typeof v === "string") return v.slice(start, end);
      if (Array.isArray(v)) return v.slice(start, end);
      throw new CminusError("slice: needs a str or list");
    }),
    fn("push", 2, (a) => {
      const list = a[0];
      if (!Array.isArray(list)) throw new CminusError("push: first arg must be a list");
      list.push(a[1]!);
      return list;
    }),
    fn("range", "any", (a) => {
      const lo = a.length > 1 ? N(a[0]!, "range") : 0;
      const hi = a.length > 1 ? N(a[1]!, "range", 1) : N(a[0]!, "range");
      const out: CValue[] = [];
      for (let i = lo; i < hi; i++) out.push(i);
      return out;
    }),
    fn("split", 2, (a) => S(a[0]!, "split").split(S(a[1]!, "split", 1))),
    fn("join", 2, (a) => {
      const list = a[0];
      if (!Array.isArray(list)) throw new CminusError("join: first arg must be a list");
      return list.map(cstr).join(S(a[1]!, "join", 1));
    }),
    fn("contains", 2, (a) => {
      const hay = a[0];
      if (typeof hay === "string") return hay.includes(S(a[1]!, "contains", 1));
      if (Array.isArray(hay)) return hay.some((x) => x === a[1]);
      throw new CminusError("contains: needs a str or list");
    }),
    fn("replace", 3, (a) =>
      S(a[0]!, "replace").split(S(a[1]!, "replace", 1)).join(S(a[2]!, "replace", 2)),
    ),

    // encodings
    fn("b64e", 1, (a) => b64e(S(a[0]!, "b64e"))),
    fn("b64d", 1, (a) => b64d(S(a[0]!, "b64d"))),
    fn("hexe", 1, (a) => hexe(S(a[0]!, "hexe"))),
    fn("hexd", 1, (a) => hexd(S(a[0]!, "hexd"))),

    // ciphers
    fn("rot", 2, (a) => rot(S(a[0]!, "rot"), N(a[1]!, "rot", 1))),
    fn("caesar", 2, (a) => rot(S(a[0]!, "caesar"), N(a[1]!, "caesar", 1))),
    fn("vigenere", "any", (a) =>
      vigenere(S(a[0]!, "vigenere"), S(a[1]!, "vigenere", 1), truthy(a[2] ?? false)),
    ),
    fn("xor", 2, (a) => xorStr(S(a[0]!, "xor"), S(a[1]!, "xor", 1))),

    // hashes
    fn("sha256", 1, async (a) => sha256hex(S(a[0]!, "sha256"))),
    fn("md5", 1, (a) => md5hex(S(a[0]!, "md5"))),
  ];
  return Object.fromEntries(defs.map((d) => [d.name, d]));
}
