# `c-` — the c-minus language (v1)

> C, with the good parts removed. Invented for PSEUDO-BREACH.
> This is a living spec — keywords and syntax may be tuned before the event.

## Running it

- In the browser: the `/terminal` page. `edit sol.c-` to write a file, `run sol.c-` to run it, or `repl` for a line-at-a-time prompt.
- Programs run **in your browser**, sandboxed, with hard limits: 200k steps, 3 seconds, 10 KB of output. Hit a limit and c- cuts you off.

## Syntax

```
?? comments start with two question marks and run to the end of the line

meh x = 10;                 ?? 'meh' declares a variable
meh name = ask "who r u?";  ?? 'ask' reads one line of input
yell "hello " + name;       ?? 'yell' prints with a newline; 'say' prints without

iff x > 5 {
  yell "big";
} elz iff x == 5 {
  yell "exactly five";
} elz {
  yell "small";
}

whyle x > 0 {
  yell x;
  x = x - 1;
  iff x == 3 { brek; }     ?? 'brek' = break, 'moar' = continue
}

plz add(a, b) {             ?? 'plz' declares a function
  gimme a + b;              ?? 'gimme' = return
}
yell add(2, 3);             ?? 5
```

## Types

`int` (whole numbers only — **c- has no floats**, on purpose), `str`, `yes`/`no` (booleans),
`nothin` (null), and `list` (`[1, 2, 3]`).

- `/` is integer division, `%` is modulo. Divide by zero and c- stops.
- `+` concatenates strings and joins lists. `str * int` repeats a string.
- Index with `s[0]`; negative indices count from the end. `s[-1]` is the last item.
- `==` compares by value (deep for lists).

## Operators

`+  -  *  /  %`  ·  `==  !=  <  >  <=  >=`  ·  `and  or  not`

## Builtins

**Text / lists** — `len  int  str  chr  ord  upper  lower  reverse  slice(x,a,b)  push(list,x)  range(a,b)  split(s,sep)  join(list,sep)  contains(x,y)  replace(s,a,b)`

**Encodings** — `b64e  b64d  hexe  hexd`

**Ciphers** — `rot(s,n)`  ·  `caesar(s,n)`  ·  `vigenere(s,key[,decrypt])`  ·  `xor(s,key)`

**Hashes** — `sha256(s)`  ·  `md5(s)`   (both return lowercase hex)

**I/O** — `yell(...)`  ·  `say(...)`  ·  `ask(prompt)`

## The bridge (only on `/terminal`)

These talk to the PSEUDO-BREACH server. They are rate-limited. They are also how the
terminal hands you hints.

| call | does |
|---|---|
| `probe(module)` | returns a per-you data / hex dump for a module |
| `knock(module, key)` | try a key against a module; returns a hint token, or `"denied"` |
| `stash(key, value)` | save a value server-side (carry tokens between modules) |
| `recall(key)` | read back what you stashed (or `nothin`) |
| `hint()` | list hints available in the current context |

## Examples

```
?? decode a caesar-shifted flag
meh blob = "FPVQXV{...}";
yell caesar(blob, -3);

?? xor a hex blob with a key and show it
meh data = hexd("1d0f1a...");
yell xor(data, "kee");

?? brute a small rotation
meh ct = "Wkh dqvzhu lv widzh";
meh n = 0;
whyle n < 26 {
  yell n + ": " + caesar(ct, -n);
  n = n + 1;
}
```
