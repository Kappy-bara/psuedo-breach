import { parseJson } from "@/lib/json";
import { userFlag, staticDerivedFlag, constantTimeEqual } from "@/lib/flags";

export type PuzzleType = "static" | "regex" | "numeric" | "cminus-output";

interface StaticCfg {
  answer?: string;
  /** compare against the per-user HMAC flag instead of `answer` */
  perUser?: boolean;
  /** compare against a shared slug-derived flag */
  derived?: boolean;
  /** case-insensitive + whitespace-trimmed compare (default true) */
  ci?: boolean;
}
interface RegexCfg {
  pattern: string;
  flags?: string;
}
interface NumericCfg {
  value: number;
  tolerance?: number;
}
interface CminusCfg {
  expectedStdout: string;
  ci?: boolean;
}

export interface ValidateInput {
  type: string;
  validatorConfig: string;
  perUserFlag: boolean;
  puzzleSlug: string;
  userId: string;
  submitted: string;
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function validateSubmission(input: ValidateInput): boolean {
  const raw = (input.submitted ?? "").toString();
  switch (input.type as PuzzleType) {
    case "static": {
      const cfg = parseJson<StaticCfg>(input.validatorConfig, {});
      if (input.perUserFlag || cfg.perUser) {
        return constantTimeEqual(raw.trim(), userFlag(input.userId, input.puzzleSlug));
      }
      if (cfg.derived) {
        return constantTimeEqual(raw.trim(), staticDerivedFlag(input.puzzleSlug));
      }
      if (typeof cfg.answer !== "string") return false;
      return (cfg.ci ?? true) ? norm(raw) === norm(cfg.answer) : raw.trim() === cfg.answer.trim();
    }
    case "regex": {
      const cfg = parseJson<RegexCfg>(input.validatorConfig, { pattern: "" });
      if (!cfg.pattern) return false;
      try {
        return new RegExp(cfg.pattern, cfg.flags ?? "").test(raw.trim());
      } catch {
        return false;
      }
    }
    case "numeric": {
      const cfg = parseJson<NumericCfg>(input.validatorConfig, { value: NaN });
      const n = Number(raw.trim().replace(/,/g, ""));
      if (Number.isNaN(n) || Number.isNaN(cfg.value)) return false;
      return Math.abs(n - cfg.value) <= (cfg.tolerance ?? 0);
    }
    case "cminus-output": {
      const cfg = parseJson<CminusCfg>(input.validatorConfig, { expectedStdout: "" });
      return (cfg.ci ?? false)
        ? norm(raw) === norm(cfg.expectedStdout)
        : raw.replace(/\r\n/g, "\n").trimEnd() ===
            cfg.expectedStdout.replace(/\r\n/g, "\n").trimEnd();
    }
    default:
      return false;
  }
}
