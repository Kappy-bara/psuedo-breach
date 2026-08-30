import { describe, it, expect } from "vitest";
import { evaluateAchRule, type AchSnapshot } from "@/lib/achievements";

const base: AchSnapshot = {
  clearedRooms: 0,
  totalRooms: 10,
  noHintClears: 0,
  flawlessClears: 0,
  clearedTimeRooms: 0,
  fastestSolveSec: Infinity,
  firstBloods: 0,
  credsHeld: 0,
  credsSpent: 0,
  holdsAllTrophies: false,
  latestSolveMs: 0,
};
const snap = (over: Partial<AchSnapshot>): AchSnapshot => ({ ...base, ...over });

describe("evaluateAchRule", () => {
  it("map-runner counts cleared rooms", () => {
    expect(evaluateAchRule({ kind: "map-runner", n: 3 }, snap({ clearedRooms: 2 }))).toBe(false);
    expect(evaluateAchRule({ kind: "map-runner", n: 3 }, snap({ clearedRooms: 3 }))).toBe(true);
  });

  it("all-rooms needs every room and at least one", () => {
    expect(evaluateAchRule({ kind: "all-rooms" }, snap({ clearedRooms: 9, totalRooms: 10 }))).toBe(false);
    expect(evaluateAchRule({ kind: "all-rooms" }, snap({ clearedRooms: 10, totalRooms: 10 }))).toBe(true);
    expect(evaluateAchRule({ kind: "all-rooms" }, snap({ clearedRooms: 0, totalRooms: 0 }))).toBe(false);
  });

  it("flawless-clear only counts clears with no wrong submission", () => {
    expect(evaluateAchRule({ kind: "flawless-clear", n: 3 }, snap({ flawlessClears: 2 }))).toBe(false);
    expect(evaluateAchRule({ kind: "flawless-clear", n: 3 }, snap({ flawlessClears: 3 }))).toBe(true);
  });

  it("no-hint-clear only counts clears with no hint bought", () => {
    expect(evaluateAchRule({ kind: "no-hint-clear", n: 2 }, snap({ noHintClears: 1 }))).toBe(false);
    expect(evaluateAchRule({ kind: "no-hint-clear", n: 2 }, snap({ noHintClears: 5 }))).toBe(true);
  });

  it("speed fires when the fastest solve is within the window", () => {
    expect(evaluateAchRule({ kind: "speed", withinSec: 120 }, base)).toBe(false); // Infinity, no solves
    expect(evaluateAchRule({ kind: "speed", withinSec: 120 }, snap({ fastestSolveSec: 121 }))).toBe(false);
    expect(evaluateAchRule({ kind: "speed", withinSec: 120 }, snap({ fastestSolveSec: 90 }))).toBe(true);
    expect(evaluateAchRule({ kind: "speed", withinSec: 120 }, snap({ fastestSolveSec: 120 }))).toBe(true);
  });

  it("first-blood counts solveIndex-0 solves", () => {
    expect(evaluateAchRule({ kind: "first-blood", n: 1 }, base)).toBe(false);
    expect(evaluateAchRule({ kind: "first-blood", n: 1 }, snap({ firstBloods: 1 }))).toBe(true);
    expect(evaluateAchRule({ kind: "first-blood", n: 3 }, snap({ firstBloods: 2 }))).toBe(false);
  });

  it("creds-held and big-spender compare against thresholds", () => {
    expect(evaluateAchRule({ kind: "creds-held", amount: 400 }, snap({ credsHeld: 399 }))).toBe(false);
    expect(evaluateAchRule({ kind: "creds-held", amount: 400 }, snap({ credsHeld: 400 }))).toBe(true);
    expect(evaluateAchRule({ kind: "big-spender", spent: 150 }, snap({ credsSpent: 150 }))).toBe(true);
  });

  it("all-trophies needs the snapshot flag", () => {
    expect(evaluateAchRule({ kind: "all-trophies" }, snap({ holdsAllTrophies: false }))).toBe(false);
    expect(evaluateAchRule({ kind: "all-trophies" }, snap({ holdsAllTrophies: true }))).toBe(true);
  });

  it("after compares the latest solve against an ISO instant", () => {
    const iso = "2026-09-16T17:45:00.000Z";
    expect(evaluateAchRule({ kind: "after", iso }, snap({ latestSolveMs: Date.parse(iso) - 1 }))).toBe(false);
    expect(evaluateAchRule({ kind: "after", iso }, snap({ latestSolveMs: Date.parse(iso) + 1 }))).toBe(true);
    expect(evaluateAchRule({ kind: "after", iso }, base)).toBe(false); // no solves
  });

  it("time-room fires once one windowed room is cleared", () => {
    expect(evaluateAchRule({ kind: "time-room" }, snap({ clearedTimeRooms: 0 }))).toBe(false);
    expect(evaluateAchRule({ kind: "time-room" }, snap({ clearedTimeRooms: 1 }))).toBe(true);
  });
});
