/**
 * c- ("c-minus") — the world's laziest language. It's not really a language.
 * You type a verb, it does one thing, it prints the answer. No variables, no
 * loops, no feelings. Just vibes.
 *
 *   runLine('caesar "Khoor" -3')   ->  { ok: true, out: "Hello" }
 */
import {
  rot,
  b64e,
  b64d,
  hexe,
  hexd,
  toBinary,
  fromBinary,
  toMorse,
  fromMorse,
  xorStr,
} from "@/lib/ciphers";

export interface ToolResult {
  ok: boolean;
  out: string;
}

const ok = (out: string): ToolResult => ({ ok: true, out });
const nope = (out: string): ToolResult => ({ ok: false, out });

export const COMMANDS: { name: string; usage: string; blurb: string }[] = [
  { name: "caesar", usage: 'caesar "text" 3   ·   caesar "text" all', blurb: "shift letters. 'all' tries every shift." },
  { name: "rot13", usage: 'rot13 "text"', blurb: "caesar's boring cousin (always 13)." },
  { name: "base64", usage: 'base64 "text"   ·   unbase64 "dGV4dA=="', blurb: "the one that ends in =." },
  { name: "hex", usage: 'hex "text"   ·   unhex "7465 7874"', blurb: "numbers pretending to be letters." },
  { name: "binary", usage: 'binary "hi"   ·   unbinary "01101000"', blurb: "ones and zeroes. very hacker." },
  { name: "morse", usage: 'morse "sos"   ·   unmorse "... --- ..."', blurb: "dots and dashes." },
  { name: "reverse", usage: 'reverse "stressed"', blurb: "sdrawkcab." },
  { name: "letters", usage: 'letters "mississippi"', blurb: "counts each letter, most first." },
  { name: "length", usage: 'length "how long is this"', blurb: "counts characters." },
  { name: "xor", usage: 'xor "text" "key"', blurb: "for the tryhards. output is hex." },
  { name: "ascii", usage: 'ascii 65   ·   ord "A"', blurb: "letter <-> number." },
  { name: "hash", usage: 'hash "text"', blurb: "md5 + sha256." },
  { name: "help", usage: "help", blurb: "this." },
  { name: "about", usage: "about", blurb: "the tragic backstory of c-." },
];

const ABOUT = `c- was going to be a real programming language.
then i remembered you have six hours and a leaderboard to climb, not a CS degree.
so now it's this. type a verb, get an answer. you're welcome.
    — the management`;

/** pull the "..." quoted strings out, keep the rest as loose tokens */
function parse(line: string): { verb: string; quoted: string[]; rest: string[] } {
  const verb = (line.trim().split(/\s+/)[0] ?? "").toLowerCase();
  const body = line.trim().slice(verb.length);
  const quoted: string[] = [];
  const stripped = body.replace(/"([^"]*)"/g, (_, s: string) => {
    quoted.push(s);
    return " ";
  });
  const rest = stripped.trim().split(/\s+/).filter(Boolean);
  return { verb, quoted, rest };
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* compact MD5 (RFC 1321) — crypto.subtle has no MD5 */
function md5(str: string): string {
  const utf8 = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i);
  const bitLen = bytes.length * 8;
  const buf = new Uint8Array((((bytes.length + 8) >> 6) << 6) + 64);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(buf.length - 8, bitLen >>> 0, true);
  dv.setUint32(buf.length - 4, Math.floor(bitLen / 0x100000000), true);
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const rl = (x: number, c: number) => (x << c) | (x >>> (32 - c));
  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let off = 0; off < buf.length; off += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
    let [A, B, C, D] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i]! + M[g]!) >>> 0;
      A = D; D = C; C = B;
      B = (B + rl(F, S[i]!)) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const hx = (n: number) => [0, 8, 16, 24].map((s) => ((n >>> s) & 0xff).toString(16).padStart(2, "0")).join("");
  return hx(a0) + hx(b0) + hx(c0) + hx(d0);
}

export async function runLine(line: string): Promise<ToolResult> {
  const raw = line.trim();
  if (!raw) return nope("you gonna type something, or just stare at me?");

  const { verb, quoted, rest } = parse(raw);
  const text = quoted[0];
  const needText = () =>
    text === undefined ? nope('wrap your text in "double quotes". i am not a mind reader.') : null;

  try {
    switch (verb) {
      case "help":
        return ok(
          "c- toolbox — type a verb:\n\n" +
            COMMANDS.map((c) => `  ${c.usage}\n      ${c.blurb}`).join("\n"),
        );
      case "about":
        return ok(ABOUT);

      case "caesar":
      case "shift": {
        const e = needText();
        if (e) return e;
        if (rest.includes("all") || quoted[1] === "all") {
          const rows = [];
          for (let n = 1; n <= 25; n++) rows.push(`${String(n).padStart(2)}: ${rot(text!, -n)}`);
          return ok("shifting back by each amount:\n" + rows.join("\n"));
        }
        const n = Number(rest[0]);
        if (Number.isNaN(n)) return nope('caesar "text" <number>   (or  caesar "text" all)');
        return ok(rot(text!, n));
      }
      case "rot13": {
        const e = needText();
        return e ?? ok(rot(text!, 13));
      }
      case "base64":
      case "b64": {
        const e = needText();
        return e ?? ok(b64e(text!));
      }
      case "unbase64":
      case "unb64": {
        const e = needText();
        if (e) return e;
        try {
          return ok(b64d(text!));
        } catch {
          return nope("that is not valid base64. check for a missing = or a typo.");
        }
      }
      case "hex": {
        const e = needText();
        return e ?? ok(hexe(text!));
      }
      case "unhex": {
        const e = needText();
        return e ?? ok(hexd(text!));
      }
      case "binary": {
        const e = needText();
        return e ?? ok(toBinary(text!));
      }
      case "unbinary": {
        const e = needText();
        return e ?? ok(fromBinary(text!));
      }
      case "morse": {
        const e = needText();
        return e ?? ok(toMorse(text!));
      }
      case "unmorse": {
        const e = needText();
        return e ?? ok(fromMorse(text!));
      }
      case "reverse": {
        const e = needText();
        return e ?? ok([...text!].reverse().join(""));
      }
      case "letters": {
        const e = needText();
        if (e) return e;
        const counts = new Map<string, number>();
        for (const c of text!.toLowerCase()) if (/[a-z0-9]/.test(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
        return ok(
          [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([c, n]) => `${c} × ${n}`)
            .join("\n") || "no letters in there",
        );
      }
      case "length":
      case "count": {
        const e = needText();
        return e ?? ok(`${text!.length} characters`);
      }
      case "xor": {
        if (quoted.length < 2) return nope('xor "text" "key"  — both in quotes.');
        return ok(hexe(xorStr(quoted[0]!, quoted[1]!)) + "  (hex)");
      }
      case "ascii": {
        const n = Number(rest[0]);
        if (Number.isNaN(n)) return nope("ascii <number>   e.g.  ascii 65");
        return ok(String.fromCharCode(n));
      }
      case "ord": {
        const e = needText();
        return e ?? ok(String(text!.charCodeAt(0)));
      }
      case "hash": {
        const e = needText();
        if (e) return e;
        return ok(`md5:    ${md5(text!)}\nsha256: ${await sha256(text!)}`);
      }
      default:
        return nope(`"${verb}"? never heard of it. type  help`);
    }
  } catch (err) {
    return nope((err as Error).message ?? "that broke something. nice.");
  }
}
