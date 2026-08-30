import { userFlag } from "@/lib/flags";
import { rot } from "@/lib/ciphers";

const b64 = (s: string) => Buffer.from(s, "latin1").toString("base64");
const reverse = (s: string) => [...s].reverse().join("");

export interface PromptContext {
  userId: string;
  puzzleSlug: string;
  displayName: string;
  registerId: string;
}

/**
 * Substitutes `{{VAR}}` placeholders in a puzzle prompt. For per-user-flag
 * puzzles this bakes a personalised value into the prompt so no two
 * participants can share an answer.
 */
export function renderPrompt(md: string, ctx: PromptContext): string {
  const flag = userFlag(ctx.userId, ctx.puzzleSlug);
  const vars: Record<string, string> = {
    displayName: ctx.displayName,
    registerId: ctx.registerId,
    flag,
    flagB64: b64(flag),
    flagReversed: reverse(flag),
    flagCaesar3: rot(flag, 3),
    flagCaesar7: rot(flag, 7),
    flagRot13: rot(flag, 13),
  };
  return md.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) =>
    key in vars ? vars[key]! : whole,
  );
}
