export type Node =
  | Program
  | VarDecl
  | Assign
  | IndexAssign
  | If
  | While
  | FuncDecl
  | Return
  | Break
  | Continue
  | Block
  | Print
  | ExprStmt
  | NumLit
  | StrLit
  | BoolLit
  | NullLit
  | ListLit
  | Ident
  | Unary
  | Binary
  | Logical
  | Call
  | Index;

export interface Program {
  type: "Program";
  body: Stmt[];
}
export type Stmt =
  | VarDecl
  | Assign
  | IndexAssign
  | If
  | While
  | FuncDecl
  | Return
  | Break
  | Continue
  | Block
  | Print
  | ExprStmt;
export type Expr =
  | NumLit
  | StrLit
  | BoolLit
  | NullLit
  | ListLit
  | Ident
  | Unary
  | Binary
  | Logical
  | Call
  | Index;

export interface VarDecl { type: "VarDecl"; name: string; value: Expr; line: number }
export interface Assign { type: "Assign"; name: string; value: Expr; line: number }
export interface IndexAssign { type: "IndexAssign"; target: Expr; index: Expr; value: Expr; line: number }
export interface If { type: "If"; test: Expr; then: Block; else: Block | If | null; line: number }
export interface While { type: "While"; test: Expr; body: Block; line: number }
export interface FuncDecl { type: "FuncDecl"; name: string; params: string[]; body: Block; line: number }
export interface Return { type: "Return"; value: Expr | null; line: number }
export interface Break { type: "Break"; line: number }
export interface Continue { type: "Continue"; line: number }
export interface Block { type: "Block"; body: Stmt[]; line: number }
export interface Print { type: "Print"; args: Expr[]; newline: boolean; line: number }
export interface ExprStmt { type: "ExprStmt"; expr: Expr; line: number }

export interface NumLit { type: "NumLit"; value: number; line: number }
export interface StrLit { type: "StrLit"; value: string; line: number }
export interface BoolLit { type: "BoolLit"; value: boolean; line: number }
export interface NullLit { type: "NullLit"; line: number }
export interface ListLit { type: "ListLit"; elements: Expr[]; line: number }
export interface Ident { type: "Ident"; name: string; line: number }
export interface Unary { type: "Unary"; op: string; operand: Expr; line: number }
export interface Binary { type: "Binary"; op: string; left: Expr; right: Expr; line: number }
export interface Logical { type: "Logical"; op: "and" | "or"; left: Expr; right: Expr; line: number }
export interface Call { type: "Call"; callee: Expr; args: Expr[]; line: number }
export interface Index { type: "Index"; target: Expr; index: Expr; line: number }
