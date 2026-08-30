import { describe, it, expect } from "vitest";
import { scoreSolve, rankBonus, speedBonus, SCORING } from "@/lib/scoring";

describe("scoring", () => {
  it("first blood earns the full rank factor", () => {
    expect(rankBonus(200, 0)).toBe(Math.round(SCORING.RANK_FACTOR * 200));
  });

  it("rank bonus decays and floors to 0", () => {
    const a = rankBonus(200, 0);
    const b = rankBonus(200, 3);
    expect(b).toBeLessThan(a);
    expect(rankBonus(200, 40)).toBe(0);
  });

  it("speed bonus is full at t=0 and 0 past the window", () => {
    expect(speedBonus(300, 0)).toBe(Math.round(SCORING.SPEED_FACTOR * 300));
    expect(speedBonus(300, SCORING.SPEED_WINDOW_SEC + 1)).toBe(0);
    expect(speedBonus(300, SCORING.SPEED_WINDOW_SEC / 2)).toBe(
      Math.round(SCORING.SPEED_FACTOR * 300 * 0.5),
    );
  });

  it("total = base + rank + speed", () => {
    const s = scoreSolve(200, 2, 600);
    expect(s.total).toBe(s.base + s.rankBonus + s.speedBonus);
    expect(s.bonus).toBe(s.rankBonus + s.speedBonus);
  });

  it("never negative", () => {
    const s = scoreSolve(100, 999, 999999);
    expect(s.total).toBeGreaterThanOrEqual(100);
  });
});
