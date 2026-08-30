import { describe, it, expect } from "vitest";
import { evaluateUnlock, type UnlockCtx, type UnlockRule } from "@/lib/unlock";

const T0 = Date.parse("2026-09-16T12:30:00.000Z"); // event start

function ctx(over: Partial<UnlockCtx> = {}): UnlockCtx {
  return {
    inv: {},
    clearedSlugs: new Set(),
    touchedSlugs: new Set(),
    now: T0,
    eventStart: T0,
    slug: "room",
    itemName: (k) => k,
    ...over,
  };
}
const min = (n: number) => n * 60_000;

describe("unlock engine", () => {
  it("open is always unlocked", () => {
    const s = evaluateUnlock({ open: true }, ctx());
    expect(s).toMatchObject({ unlocked: true, kind: "open", reason: null });
  });

  it("items — held vs missing", () => {
    const rule: UnlockRule = { items: { "keycard-red": 1 } };
    expect(evaluateUnlock(rule, ctx({ inv: { "keycard-red": 1 } })).unlocked).toBe(true);
    const miss = evaluateUnlock(rule, ctx());
    expect(miss.unlocked).toBe(false);
    expect(miss.reason).toContain("keycard-red");
    expect(miss.kind).toBe("item");
  });

  it("clearedRooms prerequisite", () => {
    const rule: UnlockRule = { clearedRooms: ["lobby", "reception"] };
    expect(evaluateUnlock(rule, ctx({ clearedSlugs: new Set(["lobby"]) })).unlocked).toBe(false);
    expect(
      evaluateUnlock(rule, ctx({ clearedSlugs: new Set(["lobby", "reception"]) })).unlocked,
    ).toBe(true);
  });

  it("windowAt — before / during / after", () => {
    const rule: UnlockRule = {
      windowAt: { from: "2026-09-16T13:00:00.000Z", to: "2026-09-16T13:30:00.000Z" },
    };
    const before = evaluateUnlock(rule, ctx({ now: Date.parse("2026-09-16T12:45:00Z") }));
    expect(before.unlocked).toBe(false);
    expect(before.opensAt).toBe(Date.parse("2026-09-16T13:00:00Z"));

    const during = evaluateUnlock(rule, ctx({ now: Date.parse("2026-09-16T13:15:00Z") }));
    expect(during.unlocked).toBe(true);
    expect(during.closesAt).toBe(Date.parse("2026-09-16T13:30:00Z"));

    const after = evaluateUnlock(rule, ctx({ now: Date.parse("2026-09-16T13:45:00Z") }));
    expect(after.unlocked).toBe(false);
    expect(after.reason).toContain("Closed");
  });

  it("windowAt — grace keeps a touched, uncleared room open past close", () => {
    const rule: UnlockRule = {
      windowAt: { from: "2026-09-16T13:00:00.000Z", to: "2026-09-16T13:30:00.000Z" },
    };
    const s = evaluateUnlock(
      rule,
      ctx({ now: Date.parse("2026-09-16T13:45:00Z"), touchedSlugs: new Set(["room"]) }),
    );
    expect(s.unlocked).toBe(true);
    // …but not once cleared (game.ts short-circuits cleared rooms anyway)
    const cleared = evaluateUnlock(
      rule,
      ctx({
        now: Date.parse("2026-09-16T13:45:00Z"),
        touchedSlugs: new Set(["room"]),
        clearedSlugs: new Set(["room"]),
      }),
    );
    expect(cleared.unlocked).toBe(false);
  });

  it("recurring — phase maths and next-open time", () => {
    const rule: UnlockRule = { recurring: { everyMin: 30, openMin: 10 } };
    // 5 min in → within the first 10-min window
    expect(evaluateUnlock(rule, ctx({ now: T0 + min(5) })).unlocked).toBe(true);
    // 20 min in → closed; next open at +30
    const closed = evaluateUnlock(rule, ctx({ now: T0 + min(20) }));
    expect(closed.unlocked).toBe(false);
    expect(closed.opensAt).toBe(T0 + min(30));
    // 35 min in → open again (second cycle)
    expect(evaluateUnlock(rule, ctx({ now: T0 + min(35) })).unlocked).toBe(true);
  });

  it("recurring — offsetMin delays the first window", () => {
    const rule: UnlockRule = { recurring: { everyMin: 30, openMin: 10, offsetMin: 15 } };
    expect(evaluateUnlock(rule, ctx({ now: T0 + min(5) })).unlocked).toBe(false);
    expect(evaluateUnlock(rule, ctx({ now: T0 + min(20) })).unlocked).toBe(true);
  });

  it("all — AND, locked by the hardest gate", () => {
    const rule: UnlockRule = {
      all: [{ items: { "keycard-red": 1 } }, { clearedRooms: ["lobby"] }],
    };
    expect(evaluateUnlock(rule, ctx()).unlocked).toBe(false);
    expect(
      evaluateUnlock(
        rule,
        ctx({ inv: { "keycard-red": 1 }, clearedSlugs: new Set(["lobby"]) }),
      ).unlocked,
    ).toBe(true);
  });

  it("any — OR, unlocked if either path is open", () => {
    const rule: UnlockRule = {
      any: [{ items: { "keycard-gold": 1 } }, { clearedRooms: ["lobby", "reception", "mailroom"] }],
    };
    expect(evaluateUnlock(rule, ctx()).unlocked).toBe(false);
    expect(evaluateUnlock(rule, ctx({ inv: { "keycard-gold": 1 } })).unlocked).toBe(true);
    expect(
      evaluateUnlock(
        rule,
        ctx({ clearedSlugs: new Set(["lobby", "reception", "mailroom"]) }),
      ).unlocked,
    ).toBe(true);
  });

  it("any — reports the soonest time path when all are locked", () => {
    const rule: UnlockRule = {
      any: [
        { windowAt: { from: "2026-09-16T15:00:00Z", to: "2026-09-16T16:00:00Z" } },
        { windowAt: { from: "2026-09-16T13:00:00Z", to: "2026-09-16T14:00:00Z" } },
      ],
    };
    const s = evaluateUnlock(rule, ctx({ now: T0 }));
    expect(s.unlocked).toBe(false);
    expect(s.opensAt).toBe(Date.parse("2026-09-16T13:00:00Z"));
  });
});
