import { CminusError } from "./lexer";
import { parse } from "./parser";
import type { Block, Expr, Stmt } from "./ast";
import {
  type CValue,
  type CFunction,
  cstr,
  truthy,
  isFn,
  pureBuiltins,
} from "./builtins";

export interface CminusLimits {
  maxSteps: number;
  maxOutputChars: number;
  wallClockMs: number;
}
export const DEFAULT_LIMITS: CminusLimits = {
  maxSteps: 200_000,
  maxOutputChars: 10_000,
  wallClockMs: 3_000,
};

/** Server bridge — the reason the terminal grants hints. Injected by the host. */
export interface CminusBridge {
  probe(moduleSlug: string): Promise<string>;
  knock(moduleSlug: string, key: string): Promise<string>;
  stash(key: string, value: string): Promise<void>;
  recall(key: string): Promise<string | null>;
  hint(): Promise<string>;
}

export interface RunOptions {
  stdin?: string[];
  onOutput: (chunk: string) => void;
  bridge?: Partial<CminusBridge>;
  limits?: Partial<CminusLimits>;
}

export interface RunResult {
  ok: boolean;
  error?: string;
  errorLine?: number;
  steps: number;
  stdout: string;
}

class ReturnSignal {
  constructor(public value: CValue) {}
}
class BreakSignal {}
class ContinueSignal {}

class Scope {
  vars = new Map<string, CValue>();
  constructor(public parent: Scope | null = null) {}
  get(name: string): CValue {
    if (this.vars.has(name)) return this.vars.get(name)!;
    if (this.parent) return this.parent.get(name);
    throw new CminusError(`${name} is not defined`);
  }
  has(name: string): boolean {
    return this.vars.has(name) || (this.parent?.has(name) ?? false);
  }
  set(name: string, value: CValue): void {
    let s: Scope | null = this;
    while (s) {
      if (s.vars.has(name)) {
        s.vars.set(name, value);
        return;
      }
      s = s.parent;
    }
    throw new CminusError(`${name} is not defined (use 'meh ${name} = ...' first)`);
  }
  declare(name: string, value: CValue): void {
    this.vars.set(name, value);
  }
}

export async function run(source: string, opts: RunOptions): Promise<RunResult> {
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const stdinQueue = [...(opts.stdin ?? [])];
  let steps = 0;
  let outChars = 0;
  let stdout = "";
  const started = Date.now();

  const emit = (s: string) => {
    outChars += s.length;
    if (outChars > limits.maxOutputChars)
      throw new CminusError("too much output — c- cut you off");
    stdout += s;
    opts.onOutput(s);
  };
  const tick = () => {
    if (++steps > limits.maxSteps)
      throw new CminusError("c- ran out of patience (step limit)");
    if (Date.now() - started > limits.wallClockMs)
      throw new CminusError("c- ran out of patience (time limit)");
  };

  const global = new Scope();
  for (const [name, f] of Object.entries(pureBuiltins())) global.declare(name, f);

  const native = (name: string, fn: (a: CValue[]) => Promise<CValue> | CValue): CFunction => ({
    __cfn: true,
    name,
    arity: "any",
    call: fn,
  });

  // `ask` is a prefix expression in the grammar; the parser lowers it to a call.
  global.declare(
    "ask",
    native("ask", (a) => {
      if (a[0] !== undefined) emit(cstr(a[0]) + " ");
      if (stdinQueue.length === 0) throw new CminusError("ask: no more input");
      return stdinQueue.shift()!;
    }),
  );

  // bridge builtins
  const b = opts.bridge ?? {};
  const bridgeFn = (name: string, impl?: (...x: string[]) => Promise<CValue>) =>
    global.declare(
      name,
      native(name, async (a) => {
        if (!impl) throw new CminusError(`${name}() is not available here — open /terminal`);
        return impl(...a.map((x) => cstr(x)));
      }),
    );
  bridgeFn("probe", b.probe ? (m) => b.probe!(m) : undefined);
  bridgeFn("knock", b.knock ? (m, k) => b.knock!(m, k ?? "") : undefined);
  bridgeFn(
    "stash",
    b.stash
      ? async (k, v) => {
          await b.stash!(k, v ?? "");
          return null;
        }
      : undefined,
  );
  bridgeFn("recall", b.recall ? async (k) => (await b.recall!(k)) ?? null : undefined);
  bridgeFn("hint", b.hint ? () => b.hint!() : undefined);

  /* ── evaluation ── */
  async function execBlock(block: Block, scope: Scope): Promise<void> {
    for (const st of block.body) await exec(st, scope);
  }

  async function exec(node: Stmt, scope: Scope): Promise<void> {
    tick();
    switch (node.type) {
      case "VarDecl":
        scope.declare(node.name, await evalExpr(node.value, scope));
        return;
      case "Assign":
        scope.set(node.name, await evalExpr(node.value, scope));
        return;
      case "IndexAssign": {
        const target = await evalExpr(node.target, scope);
        const idx = await evalExpr(node.index, scope);
        if (!Array.isArray(target)) throw new CminusError("can only index-assign a list", node.line);
        if (typeof idx !== "number") throw new CminusError("list index must be an int", node.line);
        target[idx] = await evalExpr(node.value, scope);
        return;
      }
      case "If":
        if (truthy(await evalExpr(node.test, scope))) await execBlock(node.then, new Scope(scope));
        else if (node.else) {
          if (node.else.type === "Block") await execBlock(node.else, new Scope(scope));
          else await exec(node.else, scope);
        }
        return;
      case "While":
        while (truthy(await evalExpr(node.test, scope))) {
          tick();
          try {
            await execBlock(node.body, new Scope(scope));
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      case "FuncDecl": {
        const fnScope = scope;
        const cfn: CFunction = {
          __cfn: true,
          name: node.name,
          arity: node.params.length,
          call: async (args) => {
            const local = new Scope(fnScope);
            node.params.forEach((p, i) => local.declare(p, args[i] ?? null));
            try {
              await execBlock(node.body, local);
            } catch (e) {
              if (e instanceof ReturnSignal) return e.value;
              throw e;
            }
            return null;
          },
        };
        scope.declare(node.name, cfn);
        return;
      }
      case "Return":
        throw new ReturnSignal(node.value ? await evalExpr(node.value, scope) : null);
      case "Break":
        throw new BreakSignal();
      case "Continue":
        throw new ContinueSignal();
      case "Block":
        await execBlock(node, new Scope(scope));
        return;
      case "Print": {
        const parts: string[] = [];
        for (const a of node.args) parts.push(cstr(await evalExpr(a, scope)));
        emit(parts.join(" ") + (node.newline ? "\n" : ""));
        return;
      }
      case "ExprStmt":
        await evalExpr(node.expr, scope);
        return;
    }
  }

  async function evalExpr(node: Expr, scope: Scope): Promise<CValue> {
    tick();
    switch (node.type) {
      case "NumLit":
      case "StrLit":
      case "BoolLit":
        return node.value;
      case "NullLit":
        return null;
      case "ListLit": {
        const out: CValue[] = [];
        for (const el of node.elements) out.push(await evalExpr(el, scope));
        return out;
      }
      case "Ident":
        return scope.get(node.name);
      case "Unary": {
        const v = await evalExpr(node.operand, scope);
        if (node.op === "not") return !truthy(v);
        if (typeof v !== "number") throw new CminusError("cannot negate a non-int", node.line);
        return -v;
      }
      case "Logical": {
        const l = await evalExpr(node.left, scope);
        if (node.op === "and") return truthy(l) ? await evalExpr(node.right, scope) : l;
        return truthy(l) ? l : await evalExpr(node.right, scope);
      }
      case "Binary":
        return binop(node.op, await evalExpr(node.left, scope), await evalExpr(node.right, scope), node.line);
      case "Index": {
        const target = await evalExpr(node.target, scope);
        const idx = await evalExpr(node.index, scope);
        if (typeof idx !== "number") throw new CminusError("index must be an int", node.line);
        if (typeof target === "string") {
          const ch = target[idx < 0 ? target.length + idx : idx];
          if (ch === undefined) throw new CminusError("string index out of range", node.line);
          return ch;
        }
        if (Array.isArray(target)) {
          const el = target[idx < 0 ? target.length + idx : idx];
          if (el === undefined) throw new CminusError("list index out of range", node.line);
          return el;
        }
        throw new CminusError("can only index a str or list", node.line);
      }
      case "Call": {
        const callee = await evalExpr(node.callee, scope);
        if (!isFn(callee)) throw new CminusError(`${cstr(callee)} is not callable`, node.line);
        const args: CValue[] = [];
        for (const a of node.args) args.push(await evalExpr(a, scope));
        if (callee.arity !== "any" && args.length !== callee.arity)
          throw new CminusError(
            `${callee.name} wants ${callee.arity} argument(s), got ${args.length}`,
            node.line,
          );
        return (await callee.call(args)) ?? null;
      }
      default:
        throw new CminusError("cannot evaluate this expression");
    }
  }

  function binop(op: string, l: CValue, r: CValue, line: number): CValue {
    if (op === "==") return deepEq(l, r);
    if (op === "!=") return !deepEq(l, r);
    if (op === "+") {
      if (typeof l === "string" || typeof r === "string") return cstr(l) + cstr(r);
      if (Array.isArray(l) && Array.isArray(r)) return [...l, ...r];
      return num(l, line) + num(r, line);
    }
    if (op === "*") {
      if (typeof l === "string" && typeof r === "number") return l.repeat(Math.max(0, r));
      if (typeof l === "number" && typeof r === "string") return r.repeat(Math.max(0, l));
      return num(l, line) * num(r, line);
    }
    const a = num(l, line);
    const bb = num(r, line);
    switch (op) {
      case "-": return a - bb;
      case "/":
        if (bb === 0) throw new CminusError("division by zero (c- does not forgive)", line);
        return Math.trunc(a / bb);
      case "%":
        if (bb === 0) throw new CminusError("modulo by zero", line);
        return a % bb;
      case "<": return a < bb;
      case ">": return a > bb;
      case "<=": return a <= bb;
      case ">=": return a >= bb;
    }
    throw new CminusError(`unknown operator ${op}`, line);
  }
  function num(v: CValue, line: number): number {
    if (typeof v !== "number") throw new CminusError(`expected an int, got ${cstr(v)}`, line);
    return v;
  }
  function deepEq(a: CValue, b: CValue): boolean {
    if (Array.isArray(a) && Array.isArray(b))
      return a.length === b.length && a.every((x, i) => deepEq(x, b[i]!));
    return a === b;
  }

  try {
    const program = parse(source);
    for (const st of program.body) await exec(st, global);
    return { ok: true, steps, stdout };
  } catch (e) {
    if (e instanceof ReturnSignal) return { ok: true, steps, stdout };
    const err = e as CminusError;
    return {
      ok: false,
      error: err.message ?? String(e),
      errorLine: err.line,
      steps,
      stdout,
    };
  }
}
