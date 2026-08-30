import { describe, it, expect } from "vitest";
import { holds } from "@/lib/inventory";

describe("inventory — holds()", () => {
  it("passes when every requirement is met", () => {
    const r = holds({ "frag-alpha": 3, cred: 50 }, { "frag-alpha": 3 });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual({});
  });

  it("reports the exact shortfall per item", () => {
    const r = holds({ "frag-alpha": 1, cred: 10 }, { "frag-alpha": 3, cred: 30 });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual({ "frag-alpha": 2, cred: 20 });
  });

  it("ignores zero / negative requirements", () => {
    expect(holds({}, { cred: 0 }).ok).toBe(true);
    expect(holds({}, {}).ok).toBe(true);
  });

  it("treats a missing item as quantity 0", () => {
    expect(holds({}, { "keycard-red": 1 })).toEqual({ ok: false, missing: { "keycard-red": 1 } });
  });
});
