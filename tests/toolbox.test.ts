import { describe, it, expect } from "vitest";
import { runLine } from "@/lib/toolbox";

const out = async (line: string) => (await runLine(line)).out;
const okOut = async (line: string) => {
  const r = await runLine(line);
  expect(r.ok, r.out).toBe(true);
  return r.out;
};

describe("c- toolbox", () => {
  it("caesar shifts by a number", async () => {
    expect(await okOut('caesar "Khoor" -3')).toBe("Hello");
    expect(await okOut('caesar "Hello" 3')).toBe("Khoor");
  });

  it("caesar all lists every shift and contains the plaintext", async () => {
    const o = await okOut('caesar "Khoor Zruog" all');
    expect(o.split("\n").filter((l) => /^\s*\d+:/.test(l))).toHaveLength(25);
    expect(o).toContain("Hello World");
  });

  it("rot13 round-trips", async () => {
    expect(await okOut(`rot13 "${await okOut('rot13 "secret"')}"`)).toBe("secret");
  });

  it("base64 / hex / binary / morse round-trip", async () => {
    expect(await okOut(`unbase64 "${await okOut('base64 "hidden"')}"`)).toBe("hidden");
    expect(await okOut(`unhex "${await okOut('hex "bytes"')}"`)).toBe("bytes");
    expect(await okOut(`unbinary "${await okOut('binary "bits"')}"`)).toBe("bits");
    expect(await okOut(`unmorse "${await okOut('morse "sos"')}"`)).toBe("sos");
  });

  it("reverse, length, letters", async () => {
    expect(await okOut('reverse "stressed"')).toBe("desserts");
    expect(await okOut('length "abcde"')).toMatch(/5 characters/);
    expect(await okOut('letters "mississippi"')).toMatch(/^i × 4/);
  });

  it("hash gives md5 + sha256", async () => {
    const o = await okOut('hash "abc"');
    expect(o).toContain("md5:    900150983cd24fb0d6963f7d28e17f72");
    expect(o).toContain("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is rude about nonsense and missing quotes", async () => {
    expect((await runLine("")).ok).toBe(false);
    expect((await runLine("wat")).ok).toBe(false);
    expect((await runLine("wat")).out).toMatch(/never heard of it/);
    expect((await runLine("reverse nope")).out).toMatch(/double quotes/);
  });

  it("help lists the verbs", async () => {
    const o = await okOut("help");
    expect(o).toContain("caesar");
    expect(o).toContain("unbase64");
  });
});
