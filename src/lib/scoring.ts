/**
 * Scoring — pure and deterministic so it can be unit-tested and explained to
 * participants. Total score for a player is:
 *
 *   Σ (base + bonus)  over solves   −   Σ (hint cost)  over unlocked hints
 *
 * There is NO negative penalty for wrong answers; a wrong answer costs only a
 * short cooldown (see Puzzle.cooldownSec).
 */

export const SCORING = {
  /** rank bonus = RANK_FACTOR * base * RANK_DECAY^solveIndex   (solveIndex 0 = first blood) */
  RANK_FACTOR: 0.5,
  RANK_DECAY: 0.85,
  /** below this the rank bonus is rounded to 0 (keeps late solves clean) */
  RANK_MIN_POINTS: 5,
  /** speed bonus = SPEED_FACTOR * base * clamp(1 - elapsed/SPEED_WINDOW_SEC, 0, 1) */
  SPEED_FACTOR: 0.3,
  SPEED_WINDOW_SEC: 90 * 60,
} as const;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function rankBonus(base: number, solveIndex: number): number {
  const raw =
    SCORING.RANK_FACTOR * base * Math.pow(SCORING.RANK_DECAY, Math.max(0, solveIndex));
  const rounded = Math.round(raw);
  return rounded < SCORING.RANK_MIN_POINTS ? 0 : rounded;
}

export function speedBonus(base: number, elapsedSec: number): number {
  const frac = clamp(1 - elapsedSec / SCORING.SPEED_WINDOW_SEC, 0, 1);
  return Math.round(SCORING.SPEED_FACTOR * base * frac);
}

export interface SolveScore {
  base: number;
  bonus: number;
  rankBonus: number;
  speedBonus: number;
  total: number;
}

/**
 * @param base        puzzle.basePoints
 * @param solveIndex  0-based position among all solvers of this puzzle
 * @param elapsedSec  seconds between the module opening for this player and the solve
 */
export function scoreSolve(
  base: number,
  solveIndex: number,
  elapsedSec: number,
): SolveScore {
  const r = rankBonus(base, solveIndex);
  const s = speedBonus(base, elapsedSec);
  return { base, rankBonus: r, speedBonus: s, bonus: r + s, total: base + r + s };
}

/** Human-readable formula, rendered on the leaderboard / rules page. */
export const SCORING_EXPLAINER = `
Each solve = **base** + **rank bonus** + **speed bonus**.

- **base** — fixed per puzzle by difficulty (100 / 200 / 350 / 500).
- **rank bonus** — ${SCORING.RANK_FACTOR} × base × ${SCORING.RANK_DECAY}^(N), where N is how many
  people solved it before you. First blood earns the most; it fades to 0 after ~15 solvers.
- **speed bonus** — up to ${SCORING.SPEED_FACTOR} × base, scaling linearly from full (instant) down
  to 0 at ${SCORING.SPEED_WINDOW_SEC / 60} minutes after the module opened for you.

Wrong answers never cost points — only a few seconds of cooldown. Hints cost whatever
their listed price is (many are free).
`.trim();
