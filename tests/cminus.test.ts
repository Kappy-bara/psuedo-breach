import { describe, it, expect } from "vitest";
import { runToString } from "@/lib/cminus";

async function out(src: string, stdin: string[] = []) {
  const r = await runToString(src, stdin);
  if (!r.ok) throw new Error(`c- error: ${r.error} (line ${r.errorLine})`);
  return r.stdout;
}

describe("c- interpreter", () => {
  it("prints and does arithmetic", async () => {
    expect(await out(`yell 2 + 3 * 4;`)).toBe("14\n");
  });

  it("has integer division and no floats", async () => {
    expect(await out(`yell 7 / 2;`)).toBe("3\n");
    const r = await runToString(`meh x = 1.5;`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no floats/);
  });

  it("declares, assigns, loops", async () => {
    const src = `
      meh x = 5;
      meh acc = 0;
      whyle x > 0 { acc = acc + x; x = x - 1; }
      yell acc;`;
    expect(await out(src)).toBe("15\n");
  });

  it("if / elz chains", async () => {
    const src = `
      plz cls(n) {
        iff n % 15 == 0 { gimme "fizzbuzz"; }
        elz iff n % 3 == 0 { gimme "fizz"; }
        elz iff n % 5 == 0 { gimme "buzz"; }
        gimme str(n);
      }
      meh i = 1;
      whyle i <= 15 { yell cls(i); i = i + 1; }`;
    const lines = (await out(src)).trim().split("\n");
    expect(lines[0]).toBe("1");
    expect(lines[2]).toBe("fizz");
    expect(lines[4]).toBe("buzz");
    expect(lines[14]).toBe("fizzbuzz");
  });

  it("reads input with ask", async () => {
    expect(await out(`meh n = ask "name?"; yell "hi " + n;`, ["neo"])).toBe(
      "name? hi neo\n",
    );
  });

  it("does ciphers and encodings", async () => {
    expect(await out(`yell caesar("Khoor", -3);`)).toBe("Hello\n");
    expect(await out(`yell b64d("aGVsbG8=");`)).toBe("hello\n");
    expect(await out(`yell hexd("6869");`)).toBe("hi\n");
    expect(await out(`yell vigenere(vigenere("secret", "GHOST"), "GHOST", yes);`)).toBe(
      "secret\n",
    );
    expect(await out(`yell xor(xor("secret", "k"), "k");`)).toBe("secret\n");
  });

  it("hashes", async () => {
    expect(await out(`yell md5("");`)).toBe("d41d8cd98f00b204e9800998ecf8427e\n");
    expect(await out(`yell sha256("abc");`)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad\n",
    );
  });

  it("lists and indexing", async () => {
    expect(await out(`meh a = [1,2,3]; yell a[-1] + len(a);`)).toBe("6\n");
    expect(await out(`yell join(range(1,4), "-");`)).toBe("1-2-3\n");
  });

  it("enforces the step limit", async () => {
    const r = await runToString(`whyle yes { }`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/patience/);
  });

  it("enforces the output limit", async () => {
    const r = await runToString(`whyle yes { say "spam"; }`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/output|patience/);
  });

  it("blocks the bridge outside the terminal", async () => {
    const r = await runToString(`yell probe("x");`);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not available/);
  });
});
