import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648, no padding

function base32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export const FLAG_WRAPPER = /^CMINUS\{([A-Z2-7]{16})\}$/;

/**
 * Deterministic per-user flag for a puzzle. Sharing a flag means sharing YOUR
 * flag — the submit handler can see which user a submitted flag belongs to.
 */
export function userFlag(userId: string, puzzleSlug: string): string {
  const mac = createHmac("sha256", env.flagSecret())
    .update(`${userId}:${puzzleSlug}`)
    .digest();
  return `CMINUS{${base32(mac).slice(0, 16)}}`;
}

/** A shared / non-personalised flag (same for everyone) derived from the puzzle slug. */
export function staticDerivedFlag(puzzleSlug: string): string {
  const mac = createHmac("sha256", env.flagSecret())
    .update(`static:${puzzleSlug}`)
    .digest();
  return `CMINUS{${base32(mac).slice(0, 16)}}`;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Given a submitted flag string, return the userId it was minted for (by brute
 * checking against a set of candidate users). Used for sharing detection.
 */
export function whichUserMintedFlag(
  submitted: string,
  puzzleSlug: string,
  candidates: { id: string }[],
): string | null {
  for (const c of candidates) {
    if (constantTimeEqual(submitted.trim(), userFlag(c.id, puzzleSlug))) return c.id;
  }
  return null;
}
