# `c-` — the toolbox

`c-` ("c-minus") was going to be a real programming language. It is not. It's a box of
one-line verbs that decode things, so a first-year doesn't have to do a Caesar cipher by hand.

Open it at **/terminal** ("toolkit" in the nav). Type a verb. Get an answer. No room requires it.

Everything runs in your browser — nothing is sent to the server.

## Commands

| verb | example | does |
|---|---|---|
| `caesar` | `caesar "Khoor" -3` | shift letters by a number (negative = backwards) |
| `caesar … all` | `caesar "Khoor Zruog" all` | print all 25 backward shifts — one line is the answer |
| `rot13` | `rot13 "uryyb"` | caesar's boring cousin (always 13) |
| `base64` / `unbase64` | `unbase64 "aGk="` | the encoding that ends in `=` |
| `hex` / `unhex` | `unhex "68 69"` | letters ↔ hex |
| `binary` / `unbinary` | `unbinary "01101000"` | letters ↔ ones and zeroes |
| `morse` / `unmorse` | `unmorse "... --- ..."` | dots and dashes (`/` = space) |
| `reverse` | `reverse "stressed"` | `desserts` |
| `letters` | `letters "mississippi"` | letter frequency, most common first |
| `length` | `length "how long"` | character count |
| `xor` | `xor "text" "key"` | for tryhards — output is hex |
| `ascii` / `ord` | `ascii 65` · `ord "A"` | number ↔ character |
| `hash` | `hash "abc"` | md5 + sha256 |
| `help` | `help` | the list |
| `about` | `about` | the tragic backstory |

Quotes are required around text. `↑` / `↓` cycle command history.

The source of truth is the `COMMANDS` array and `runLine()` in
[`src/lib/toolbox.ts`](../src/lib/toolbox.ts).
