export type TokKind =
  | "int"
  | "str"
  | "ident"
  | "kw"
  | "op"
  | "punct"
  | "eof";

export interface Token {
  kind: TokKind;
  value: string;
  line: number;
  col: number;
}

export class CminusError extends Error {
  constructor(
    message: string,
    public line?: number,
  ) {
    super(message);
    this.name = "CminusError";
  }
}

const KEYWORDS = new Set([
  "meh", // declare
  "iff", // if
  "elz", // else
  "whyle", // while
  "plz", // function
  "gimme", // return
  "yell", // print + newline
  "say", // print, no newline
  "ask", // read a line (prefix expression)
  "yes", // true
  "no", // false
  "nothin", // null
  "and",
  "or",
  "not",
  "brek", // break
  "moar", // continue
]);

// multi-char operators first
const OPS = ["==", "!=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "%", "<", ">", "="];

export function lex(src: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const peek = (o = 0) => src[i + o];
  const adv = () => {
    const c = src[i++]!;
    if (c === "\n") {
      line++;
      col = 1;
    } else col++;
    return c;
  };

  while (i < src.length) {
    const c = peek()!;

    // whitespace
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      adv();
      continue;
    }
    // comment: ?? ... end of line
    if (c === "?" && peek(1) === "?") {
      while (i < src.length && peek() !== "\n") adv();
      continue;
    }

    const startLine = line;
    const startCol = col;

    // string
    if (c === '"') {
      adv();
      let s = "";
      while (i < src.length && peek() !== '"') {
        let ch = adv();
        if (ch === "\\") {
          const e = adv();
          ch =
            e === "n" ? "\n" : e === "t" ? "\t" : e === "\\" ? "\\" : e === '"' ? '"' : e;
        }
        s += ch;
      }
      if (peek() !== '"') throw new CminusError("unterminated string", startLine);
      adv();
      toks.push({ kind: "str", value: s, line: startLine, col: startCol });
      continue;
    }

    // number (integers only — c- has no floats)
    if (c >= "0" && c <= "9") {
      let n = "";
      while (i < src.length && peek()! >= "0" && peek()! <= "9") n += adv();
      if (peek() === ".")
        throw new CminusError("c- has no floats. this is a feature.", startLine);
      toks.push({ kind: "int", value: n, line: startLine, col: startCol });
      continue;
    }

    // identifier / keyword
    if (/[A-Za-z_]/.test(c)) {
      let id = "";
      while (i < src.length && /[A-Za-z0-9_]/.test(peek()!)) id += adv();
      toks.push({
        kind: KEYWORDS.has(id) ? "kw" : "ident",
        value: id,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // punctuation
    if ("(){}[],;".includes(c)) {
      adv();
      toks.push({ kind: "punct", value: c, line: startLine, col: startCol });
      continue;
    }

    // operators
    const two = c + (peek(1) ?? "");
    const op = OPS.find((o) => o.length === 2 && o === two) ?? OPS.find((o) => o === c);
    if (op) {
      for (let k = 0; k < op.length; k++) adv();
      toks.push({ kind: "op", value: op, line: startLine, col: startCol });
      continue;
    }

    throw new CminusError(`unexpected character ${JSON.stringify(c)}`, startLine);
  }

  toks.push({ kind: "eof", value: "", line, col });
  return toks;
}
