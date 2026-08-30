export { run, DEFAULT_LIMITS } from "./interpreter";
export type {
  RunOptions,
  RunResult,
  CminusBridge,
  CminusLimits,
} from "./interpreter";
export { parse } from "./parser";
export { lex, CminusError } from "./lexer";
export { cstr } from "./builtins";

import { run, type RunResult } from "./interpreter";

/** Convenience: run a program, capture stdout, no bridge. */
export async function runToString(
  source: string,
  stdin: string[] = [],
): Promise<RunResult> {
  let out = "";
  return run(source, { stdin, onOutput: (c) => (out += c) }).then((r) => ({
    ...r,
    stdout: r.stdout || out,
  }));
}
