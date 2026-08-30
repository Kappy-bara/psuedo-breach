import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.FLAG_SECRET = "test-flag-secret-000";
});

describe("per-user flags", () => {
  it("is deterministic and well-formed", async () => {
    const { userFlag, FLAG_WRAPPER } = await import("@/lib/flags");
    const a = userFlag("user-1", "ghost-chain");
    const b = userFlag("user-1", "ghost-chain");
    expect(a).toBe(b);
    expect(a).toMatch(FLAG_WRAPPER);
  });

  it("differs per user and per puzzle", async () => {
    const { userFlag } = await import("@/lib/flags");
    expect(userFlag("user-1", "ghost-chain")).not.toBe(userFlag("user-2", "ghost-chain"));
    expect(userFlag("user-1", "ghost-chain")).not.toBe(userFlag("user-1", "xor-decode"));
  });

  it("identifies which user minted a submitted flag", async () => {
    const { userFlag, whichUserMintedFlag } = await import("@/lib/flags");
    const candidates = [{ id: "user-1" }, { id: "user-2" }, { id: "user-3" }];
    const stolen = userFlag("user-2", "xor-decode");
    expect(whichUserMintedFlag(stolen, "xor-decode", candidates)).toBe("user-2");
    expect(whichUserMintedFlag("CMINUS{AAAAAAAAAAAAAAAA}", "xor-decode", candidates)).toBeNull();
  });

  it("validateSubmission matches a user's own flag only", async () => {
    const { userFlag } = await import("@/lib/flags");
    const { validateSubmission } = await import("@/lib/validators");
    const mine = userFlag("user-1", "xor-decode");
    const base = {
      type: "static",
      validatorConfig: JSON.stringify({ perUser: true }),
      perUserFlag: true,
      puzzleSlug: "xor-decode",
    };
    expect(validateSubmission({ ...base, userId: "user-1", submitted: mine })).toBe(true);
    expect(validateSubmission({ ...base, userId: "user-2", submitted: mine })).toBe(false);
  });
});
