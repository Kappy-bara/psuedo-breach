import { userFlag } from "@/lib/flags";
import { rot, xorStr, vigenere } from "@/lib/cminus/builtins";

const b64 = (s: string) => Buffer.from(s, "latin1").toString("base64");
const hex = (s: string) => Buffer.from(s, "latin1").toString("hex");
const reverse = (s: string) => [...s].reverse().join("");

export interface PromptContext {
  userId: string;
  puzzleSlug: string;
  displayName: string;
  registerId: string;
}

/**
 * Substitutes `{{VAR}}` placeholders in a puzzle prompt. For per-user-flag
 * puzzles this bakes a personalised ciphertext into the prompt so no two
 * participants can share an answer.
 */
export function renderPrompt(md: string, ctx: PromptContext): string {
  const flag = userFlag(ctx.userId, ctx.puzzleSlug);
  const vars: Record<string, string> = {
    displayName: ctx.displayName,
    registerId: ctx.registerId,
    flag,
    flagB64: b64(flag),
    flagHex: hex(flag),
    flagRot13: rot(flag, 13),
    flagCaesar5: rot(flag, 5),
    flagReversed: reverse(flag),
    flagXorHex: hex(xorStr(flag, "cminus")),
    flagVigenereGHOST: vigenere(flag, "GHOST"),
    // base64( vigenere(flag, "GHOST") ) — M2 CAESAR'S GHOST
    flagGhostChain: b64(vigenere(flag, "GHOST")),
    // base64( xor( reverse(flag), "curse" ) ) — M6 THE COMPILER'S CURSE
    flagCurseChain: b64(xorStr(reverse(flag), "curse")),
  };
  return md.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) =>
    key in vars ? vars[key]! : whole,
  );
}
