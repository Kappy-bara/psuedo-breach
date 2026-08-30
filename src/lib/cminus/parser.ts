import { lex, type Token, CminusError } from "./lexer";
import type { Block, Expr, Program, Stmt } from "./ast";

/** Binary operator precedence (higher binds tighter). `and`/`or` handled separately. */
const PREC: Record<string, number> = {
  "==": 4, "!=": 4, "<": 5, ">": 5, "<=": 5, ">=": 5,
  "+": 6, "-": 6, "*": 7, "/": 7, "%": 7,
};

export function parse(src: string): Program {
  const toks = lex(src);
  let p = 0;

  const peek = () => toks[p]!;
  const at = (kind: string, value?: string) =>
    peek().kind === kind && (value === undefined || peek().value === value);
  const next = () => toks[p++]!;
  const eat = (kind: string, value?: string): Token => {
    if (!at(kind, value)) {
      const t = peek();
      throw new CminusError(
        `expected ${value ?? kind} but got ${JSON.stringify(t.value || t.kind)}`,
        t.line,
      );
    }
    return next();
  };
  const line = () => peek().line;

  function program(): Program {
    const body: Stmt[] = [];
    while (!at("eof")) body.push(statement());
    return { type: "Program", body };
  }

  function block(): Block {
    const l = line();
    eat("punct", "{");
    const body: Stmt[] = [];
    while (!at("punct", "}") && !at("eof")) body.push(statement());
    eat("punct", "}");
    return { type: "Block", body, line: l };
  }

  function statement(): Stmt {
    const l = line();
    if (at("kw", "meh")) {
      next();
      const name = eat("ident").value;
      eat("op", "=");
      const value = expression();
      eat("punct", ";");
      return { type: "VarDecl", name, value, line: l };
    }
    if (at("kw", "yell") || at("kw", "say")) {
      const newline = next().value === "yell";
      const args: Expr[] = [];
      if (!at("punct", ";")) {
        do {
          args.push(expression());
        } while (at("punct", ",") && next());
      }
      eat("punct", ";");
      return { type: "Print", args, newline, line: l };
    }
    if (at("kw", "iff")) return ifStmt();
    if (at("kw", "whyle")) {
      next();
      const test = expression();
      return { type: "While", test, body: block(), line: l };
    }
    if (at("kw", "plz")) {
      next();
      const name = eat("ident").value;
      eat("punct", "(");
      const params: string[] = [];
      if (!at("punct", ")")) {
        do {
          params.push(eat("ident").value);
        } while (at("punct", ",") && next());
      }
      eat("punct", ")");
      return { type: "FuncDecl", name, params, body: block(), line: l };
    }
    if (at("kw", "gimme")) {
      next();
      let value: Expr | null = null;
      if (!at("punct", ";")) value = expression();
      eat("punct", ";");
      return { type: "Return", value, line: l };
    }
    if (at("kw", "brek")) {
      next();
      eat("punct", ";");
      return { type: "Break", line: l };
    }
    if (at("kw", "moar")) {
      next();
      eat("punct", ";");
      return { type: "Continue", line: l };
    }
    if (at("punct", "{")) return block();

    // assignment or expression statement
    const expr = expression();
    if (at("op", "=")) {
      next();
      const value = expression();
      eat("punct", ";");
      if (expr.type === "Ident")
        return { type: "Assign", name: expr.name, value, line: l };
      if (expr.type === "Index")
        return {
          type: "IndexAssign",
          target: expr.target,
          index: expr.index,
          value,
          line: l,
        };
      throw new CminusError("invalid assignment target", l);
    }
    eat("punct", ";");
    return { type: "ExprStmt", expr, line: l };
  }

  function ifStmt(): Stmt {
    const l = line();
    eat("kw", "iff");
    const test = expression();
    const then = block();
    let elseBranch: Block | Stmt | null = null;
    if (at("kw", "elz")) {
      next();
      elseBranch = at("kw", "iff") ? ifStmt() : block();
    }
    return { type: "If", test, then, else: elseBranch as Block | null, line: l };
  }

  /* ── expressions ── */
  function expression(): Expr {
    return logicalOr();
  }
  function logicalOr(): Expr {
    let left = logicalAnd();
    while (at("kw", "or")) {
      const l = next().line;
      left = { type: "Logical", op: "or", left, right: logicalAnd(), line: l };
    }
    return left;
  }
  function logicalAnd(): Expr {
    let left = binary(0);
    while (at("kw", "and")) {
      const l = next().line;
      left = { type: "Logical", op: "and", left, right: binary(0), line: l };
    }
    return left;
  }
  function binary(minPrec: number): Expr {
    let left = unary();
    while (at("op") && PREC[peek().value] !== undefined && PREC[peek().value]! >= minPrec) {
      const op = next();
      const right = binary(PREC[op.value]! + 1);
      left = { type: "Binary", op: op.value, left, right, line: op.line };
    }
    return left;
  }
  function unary(): Expr {
    if (at("kw", "not") || at("op", "-")) {
      const t = next();
      return {
        type: "Unary",
        op: t.value === "-" ? "-" : "not",
        operand: unary(),
        line: t.line,
      };
    }
    if (at("kw", "ask")) {
      const t = next();
      return {
        type: "Call",
        callee: { type: "Ident", name: "ask", line: t.line },
        args: [unary()],
        line: t.line,
      };
    }
    return postfix();
  }
  function postfix(): Expr {
    let node = primary();
    for (;;) {
      if (at("punct", "(")) {
        const l = next().line;
        const args: Expr[] = [];
        if (!at("punct", ")")) {
          do {
            args.push(expression());
          } while (at("punct", ",") && next());
        }
        eat("punct", ")");
        node = { type: "Call", callee: node, args, line: l };
      } else if (at("punct", "[")) {
        const l = next().line;
        const index = expression();
        eat("punct", "]");
        node = { type: "Index", target: node, index, line: l };
      } else break;
    }
    return node;
  }
  function primary(): Expr {
    const t = peek();
    if (at("int")) {
      next();
      return { type: "NumLit", value: parseInt(t.value, 10), line: t.line };
    }
    if (at("str")) {
      next();
      return { type: "StrLit", value: t.value, line: t.line };
    }
    if (at("kw", "yes")) {
      next();
      return { type: "BoolLit", value: true, line: t.line };
    }
    if (at("kw", "no")) {
      next();
      return { type: "BoolLit", value: false, line: t.line };
    }
    if (at("kw", "nothin")) {
      next();
      return { type: "NullLit", line: t.line };
    }
    if (at("ident")) {
      next();
      return { type: "Ident", name: t.value, line: t.line };
    }
    if (at("punct", "(")) {
      next();
      const e = expression();
      eat("punct", ")");
      return e;
    }
    if (at("punct", "[")) {
      next();
      const elements: Expr[] = [];
      if (!at("punct", "]")) {
        do {
          elements.push(expression());
        } while (at("punct", ",") && next());
      }
      eat("punct", "]");
      return { type: "ListLit", elements, line: t.line };
    }
    throw new CminusError(
      `unexpected ${JSON.stringify(t.value || t.kind)} in expression`,
      t.line,
    );
  }

  return program();
}
