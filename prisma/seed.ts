/**
 * Seed — idempotent-ish. Rebuilds the two events (demo + main): item catalogue,
 * the Shop + trades, dungeon rooms with first-year puzzles + loot, hints, test users.
 *
 *   npm run db:seed          # apply / update
 *   npm run db:reset         # wipe file + re-push + re-seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { UnlockRule } from "../src/lib/unlock";

const prisma = new PrismaClient();

const caesar = (s: string, n: number) =>
  [...s]
    .map((c) => {
      const code = c.charCodeAt(0);
      const k = ((n % 26) + 26) % 26;
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + k) % 26) + 97);
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + k) % 26) + 65);
      return c;
    })
    .join("");

type ItemSeed = {
  key: string;
  name: string;
  type: "cred" | "fragment" | "keycard" | "loot" | "trophy";
  icon: string;
  descriptionMd?: string;
  stackable?: boolean;
  sellValue?: number;
};
type HintSeed = {
  ref?: string; // referenced by NPC trades
  contentMd: string;
  rule:
    | { kind: "free" }
    | { kind: "auto-after-wrong"; n: number }
    | { kind: "item"; key: string }
    | { kind: "buy"; cost: number }
    | { kind: "npc" };
  puzzleSlug?: string;
};
type PuzzleSeed = {
  slug: string;
  title: string;
  promptMd: string;
  type?: string;
  basePoints: number;
  difficulty: string;
  perUserFlag?: boolean;
  validatorConfig?: Record<string, unknown>;
  cooldownSec?: number;
  rewards?: Record<string, number>;
};
type ModuleSeed = {
  slug: string;
  title: string;
  theme?: string;
  blurb: string;
  map: { x: number; y: number; zone?: string };
  edges?: string[]; // adjacent room slugs — corridors on the map
  unlock?: UnlockRule; // default { open: true }
  prereq?: Record<string, number>; // shorthand → { items: {...} }
  clearReward?: Record<string, number>;
  puzzles: PuzzleSeed[];
  hints?: HintSeed[];
};
type AchievementSeed = {
  key: string;
  name: string;
  icon: string;
  descriptionMd?: string;
  title?: string;
  credReward?: number;
  priority?: number;
  hidden?: boolean;
  rule: unknown;
};

function compileUnlock(m: ModuleSeed): UnlockRule {
  if (m.unlock) return m.unlock;
  if (m.prereq && Object.keys(m.prereq).length) return { items: m.prereq };
  return { open: true };
}
type TradeSeed = {
  label: string;
  descriptionMd?: string;
  give?: Record<string, number>;
  get?: Record<string, number>;
  revealsHintRef?: string;
  repeatable?: boolean;
  showIfHolds?: Record<string, number>;
};
type EventSeed = {
  slug: string;
  name: string;
  isDemo: boolean;
  startsAt: Date;
  endsAt: Date;
  status: string;
  items: ItemSeed[];
  npc: { slug: string; name: string; icon: string; blurbMd: string; trades: TradeSeed[] };
  modules: ModuleSeed[];
  achievements?: AchievementSeed[];
};

async function seedEvent(ev: EventSeed) {
  const event = await prisma.event.upsert({
    where: { slug: ev.slug },
    update: { name: ev.name, isDemo: ev.isDemo, startsAt: ev.startsAt, endsAt: ev.endsAt, status: ev.status },
    create: {
      slug: ev.slug,
      name: ev.name,
      isDemo: ev.isDemo,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      status: ev.status,
    },
  });

  for (const it of ev.items) {
    await prisma.item.upsert({
      where: { eventId_key: { eventId: event.id, key: it.key } },
      update: {
        name: it.name,
        type: it.type,
        icon: it.icon,
        descriptionMd: it.descriptionMd ?? "",
        stackable: it.stackable ?? false,
        sellValue: it.sellValue ?? 0,
      },
      create: {
        eventId: event.id,
        key: it.key,
        name: it.name,
        type: it.type,
        icon: it.icon,
        descriptionMd: it.descriptionMd ?? "",
        stackable: it.stackable ?? false,
        sellValue: it.sellValue ?? 0,
      },
    });
  }

  const hintRefs = new Map<string, string>(); // ref -> hint id

  for (let mi = 0; mi < ev.modules.length; mi++) {
    const m = ev.modules[mi]!;
    const modFields = {
      title: m.title,
      blurb: m.blurb,
      order: mi,
      theme: m.theme ?? "default",
      mapX: m.map.x,
      mapY: m.map.y,
      mapZone: m.map.zone ?? "",
      mapEdgesJson: JSON.stringify(m.edges ?? []),
      unlockRuleJson: JSON.stringify(compileUnlock(m)),
      clearRewardJson: JSON.stringify(m.clearReward ?? {}),
    };
    const mod = await prisma.module.upsert({
      where: { eventId_slug: { eventId: event.id, slug: m.slug } },
      update: modFields,
      create: { eventId: event.id, slug: m.slug, ...modFields },
    });

    for (let pi = 0; pi < m.puzzles.length; pi++) {
      const p = m.puzzles[pi]!;
      await prisma.puzzle.upsert({
        where: { slug: p.slug },
        update: {
          title: p.title,
          promptMd: p.promptMd,
          type: p.type ?? "static",
          basePoints: p.basePoints,
          difficulty: p.difficulty,
          order: pi,
          perUserFlag: p.perUserFlag ?? false,
          validatorConfig: JSON.stringify(p.validatorConfig ?? {}),
          cooldownSec: p.cooldownSec ?? 15,
          rewardsJson: JSON.stringify(p.rewards ?? {}),
          moduleId: mod.id,
        },
        create: {
          slug: p.slug,
          title: p.title,
          promptMd: p.promptMd,
          type: p.type ?? "static",
          basePoints: p.basePoints,
          difficulty: p.difficulty,
          order: pi,
          perUserFlag: p.perUserFlag ?? false,
          validatorConfig: JSON.stringify(p.validatorConfig ?? {}),
          cooldownSec: p.cooldownSec ?? 15,
          rewardsJson: JSON.stringify(p.rewards ?? {}),
          moduleId: mod.id,
        },
      });
    }

    await prisma.hint.deleteMany({ where: { moduleId: mod.id } });
    for (let hi = 0; hi < (m.hints ?? []).length; hi++) {
      const h = m.hints![hi]!;
      const puzzle = h.puzzleSlug
        ? await prisma.puzzle.findUnique({ where: { slug: h.puzzleSlug } })
        : null;
      const created = await prisma.hint.create({
        data: {
          moduleId: mod.id,
          puzzleId: puzzle?.id ?? null,
          order: hi,
          contentMd: h.contentMd,
          unlockRule: JSON.stringify(h.rule),
        },
      });
      if (h.ref) hintRefs.set(h.ref, created.id);
    }
  }

  // NPC + trades
  const npc = await prisma.npc.upsert({
    where: { eventId_slug: { eventId: event.id, slug: ev.npc.slug } },
    update: { name: ev.npc.name, icon: ev.npc.icon, blurbMd: ev.npc.blurbMd },
    create: {
      eventId: event.id,
      slug: ev.npc.slug,
      name: ev.npc.name,
      icon: ev.npc.icon,
      blurbMd: ev.npc.blurbMd,
    },
  });
  await prisma.npcTrade.deleteMany({ where: { npcId: npc.id } });
  for (let ti = 0; ti < ev.npc.trades.length; ti++) {
    const t = ev.npc.trades[ti]!;
    await prisma.npcTrade.create({
      data: {
        npcId: npc.id,
        order: ti,
        label: t.label,
        descriptionMd: t.descriptionMd ?? "",
        giveJson: JSON.stringify(t.give ?? {}),
        getItemsJson: JSON.stringify(t.get ?? {}),
        revealsHintId: t.revealsHintRef ? (hintRefs.get(t.revealsHintRef) ?? null) : null,
        repeatable: t.repeatable ?? false,
        showIfHoldsJson: JSON.stringify(t.showIfHolds ?? {}),
      },
    });
  }

  for (const a of ev.achievements ?? []) {
    const fields = {
      name: a.name,
      icon: a.icon,
      descriptionMd: a.descriptionMd ?? "",
      title: a.title ?? "",
      credReward: a.credReward ?? 0,
      priority: a.priority ?? 0,
      hidden: a.hidden ?? false,
      ruleJson: JSON.stringify(a.rule),
    };
    await prisma.achievement.upsert({
      where: { eventId_key: { eventId: event.id, key: a.key } },
      update: fields,
      create: { eventId: event.id, key: a.key, ...fields },
    });
  }

  return event;
}

/* ══════════════════════════════ DEMO EVENT ══════════════════════════════ */

const D_LOCKER_PLAIN = "CMINUS{SP1N_TH3_D14L}";

const demoEvent: EventSeed = {
  slug: "demo-session",
  name: "PSEUDO-BREACH · Practice Run",
  isDemo: true,
  startsAt: new Date(Date.now() - 3600_000),
  endsAt: new Date(Date.now() + 30 * 24 * 3600_000),
  status: "live",
  items: [
    { key: "cred", name: "Cred", type: "cred", icon: "💰", stackable: true },
    { key: "frag-demo", name: "Practice Shard", type: "fragment", icon: "🧩", stackable: true, descriptionMd: "Two of these forge the practice keycard." },
    { key: "keycard-demo", name: "Practice Keycard", type: "keycard", icon: "🔑", descriptionMd: "Opens THE DESK." },
  ],
  npc: {
    slug: "shop",
    name: "The Shop",
    icon: "🛒",
    blurbMd: "`> shop.exe — back-room fabricator & fence.`\n\nBring me shards, I make keycards. Bring me junk, I make it creds. Bring me your feelings, I make you leave.",
    trades: [
      {
        label: "Forge the Practice Keycard",
        descriptionMd: "Two Practice Shards. Watch the sparks.",
        give: { "frag-demo": 2 },
        get: { "keycard-demo": 1 },
        showIfHolds: { "frag-demo": 1 },
      },
    ],
  },
  achievements: [
    { key: "demo-first", name: "Warmed Up", icon: "👣", credReward: 5, rule: { kind: "map-runner", n: 1 } },
    { key: "demo-forge", name: "Fabricator", icon: "🔧", title: "the Fabricator", priority: 10, credReward: 10, rule: { kind: "map-runner", n: 2 } },
    { key: "demo-vent", name: "Right on Time", icon: "⏰", title: "the Punctual", priority: 20, credReward: 10, rule: { kind: "time-room" } },
  ],
  modules: [
    {
      slug: "door",
      title: "D0 · THE DOOR",
      theme: "green",
      blurb: "It's not even locked. Push.",
      map: { x: 1, y: 0 },
      edges: ["locker", "desk"],
      clearReward: { "frag-demo": 1 },
      puzzles: [
        {
          slug: "door-flag",
          title: "The sticky note",
          basePoints: 50,
          difficulty: "easy",
          validatorConfig: { answer: "CMINUS{W3LC0M3}", leakInSource: true },
          rewards: { cred: 10 },
          promptMd:
            "Right-click → **View Page Source** (or `Ctrl+U`). Somewhere there's an HTML comment with a flag shaped like `CMINUS{...}`. Paste it below.",
        },
      ],
      hints: [{ contentMd: "`Ctrl+U`, then `Ctrl+F` for `CMINUS`.", rule: { kind: "free" } }],
    },
    {
      slug: "locker",
      title: "D1 · THE LOCKER",
      theme: "cyan",
      blurb: "Meet the toolkit.",
      map: { x: 3, y: 0 },
      edges: ["door", "vent"],
      clearReward: { cred: 10 },
      puzzles: [
        {
          slug: "locker-caesar",
          title: "Nudged letters",
          basePoints: 60,
          difficulty: "easy",
          validatorConfig: { answer: D_LOCKER_PLAIN },
          rewards: { cred: 15, "frag-demo": 1 },
          promptMd: `Every letter got pushed **3 forward**. Push it back.

\`\`\`
${caesar(D_LOCKER_PLAIN, 3)}
\`\`\`

Open the **toolkit** and run \`caesar "${caesar(D_LOCKER_PLAIN, 3)}" all\` — one of the lines is the flag.`,
        },
      ],
      hints: [
        { contentMd: 'toolkit: `caesar "…" all`, then read the list for the `CMINUS{...}` line.', rule: { kind: "free" } },
        { contentMd: `It's \`${D_LOCKER_PLAIN}\`. You still get the points.`, rule: { kind: "auto-after-wrong", n: 3 }, puzzleSlug: "locker-caesar" },
      ],
    },
    {
      slug: "desk",
      title: "D2 · THE DESK",
      theme: "magenta",
      blurb: "The drawer's locked. Its keycard comes from the Shop — two shards.",
      map: { x: 1, y: 2 },
      edges: ["door"],
      prereq: { "keycard-demo": 1 },
      clearReward: { cred: 10 },
      puzzles: [
        {
          slug: "desk-flag",
          title: "The drawer",
          basePoints: 60,
          difficulty: "easy",
          validatorConfig: { answer: "CMINUS{DR4W3R_0P3N}" },
          rewards: { cred: 15 },
          promptMd:
            "You forged a keycard from two shards and the door opened. That's the whole loop: **crack rooms → collect shards → the Shop turns them into keycards → new rooms open.** Now unlock the intel below (you're holding the keycard) and it'll give you the flag.",
        },
      ],
      hints: [
        { contentMd: "You made it in. The flag is `CMINUS{DR4W3R_0P3N}`.", rule: { kind: "item", key: "keycard-demo" } },
      ],
    },
    {
      slug: "vent",
      title: "D3 · THE VENT",
      theme: "amber",
      blurb: "Only open for 2 minutes at a time. Watch the map and dash in.",
      map: { x: 4, y: 2 },
      edges: ["locker"],
      unlock: { recurring: { everyMin: 5, openMin: 2 } },
      clearReward: { cred: 10 },
      puzzles: [
        {
          slug: "vent-quick",
          title: "Quick — before it shuts",
          basePoints: 40,
          difficulty: "easy",
          validatorConfig: { answer: "CMINUS{1N_4ND_0UT}" },
          rewards: { cred: 20 },
          promptMd:
            "This room opens **2 minutes every 5**. The flag is `CMINUS{1N_4ND_0UT}` — submit it while you're here. (Once you've had a go, the map won't lock you out mid-attempt.)",
        },
      ],
      hints: [{ contentMd: "It's right there in the prompt. This one's about the *timing*.", rule: { kind: "free" } }],
    },
  ],
};

/* ══════════════════════════════ MAIN EVENT ══════════════════════════════ */

const R6_TRAIL_PLAIN = "CMINUS{TH3_TUNN3LS_C0NN3CT}";

const mainEvent: EventSeed = {
  slug: "pseudo-breach-main",
  name: "PSEUDO-BREACH",
  isDemo: false,
  // 2026-09-16 18:00–23:59 IST (UTC+5:30)
  startsAt: new Date("2026-09-16T12:30:00.000Z"),
  endsAt: new Date("2026-09-16T18:29:00.000Z"),
  status: "draft",
  items: [
    { key: "cred", name: "Cred", type: "cred", icon: "💰", stackable: true },
    { key: "frag-alpha", name: "Alpha Shard", type: "fragment", icon: "🧩", stackable: true, descriptionMd: "Three forge a **Red Keycard** at the Shop." },
    { key: "frag-beta", name: "Beta Shard", type: "fragment", icon: "🧩", stackable: true, descriptionMd: "Three forge a **Black Keycard** at the Shop." },
    { key: "keycard-blue", name: "Blue Keycard", type: "keycard", icon: "🔑", descriptionMd: "Opens the **Server Closet**." },
    { key: "keycard-red", name: "Red Keycard", type: "keycard", icon: "🔑", descriptionMd: "Opens the **Security Office**." },
    { key: "keycard-green", name: "Green Keycard", type: "keycard", icon: "🔑", descriptionMd: "Opens the **Maintenance Tunnels**." },
    { key: "keycard-black", name: "Black Keycard", type: "keycard", icon: "🔑", descriptionMd: "One of three that open **THE CORE**." },
    { key: "keycard-master", name: "Master Keycard", type: "keycard", icon: "🗝️", descriptionMd: "**THE CORE** is open." },
    { key: "loot-old-badge", name: "Corroded ID Badge", type: "loot", icon: "💾", sellValue: 15, descriptionMd: "Belonged to someone who worked here. The shop buys these." },
    { key: "loot-coffee", name: "Cold Coffee", type: "loot", icon: "☕", sellValue: 5, descriptionMd: "Why did you pick this up." },
    { key: "trophy-sweettooth", name: "Sweet Tooth", type: "trophy", icon: "🍯", descriptionMd: "You walked into the honeypot and walked back out." },
    { key: "trophy-onair", name: "On Air", type: "trophy", icon: "📻", descriptionMd: "You made the broadcast window." },
    { key: "trophy-root", name: "root", type: "trophy", icon: "👑", descriptionMd: "You own THE STACK." },
  ],
  achievements: [
    { key: "first-steps", name: "First Steps", icon: "👣", descriptionMd: "Clear your first room.", credReward: 15, rule: { kind: "map-runner", n: 1 } },
    { key: "spelunker", name: "Spelunker", icon: "🗺️", descriptionMd: "Clear 5 rooms.", credReward: 30, rule: { kind: "map-runner", n: 5 } },
    { key: "completionist", name: "Completionist", icon: "🏆", descriptionMd: "Clear every room in THE STACK.", title: "the Completionist", priority: 90, credReward: 120, rule: { kind: "all-rooms" } },
    { key: "unhinted", name: "Unhinted", icon: "🧠", descriptionMd: "Clear 3 rooms without opening a single hint.", title: "the Unhinted", priority: 45, credReward: 50, rule: { kind: "no-hint-clear", n: 3 } },
    { key: "flawless", name: "Flawless", icon: "💎", descriptionMd: "Clear 3 rooms with zero wrong guesses.", title: "the Flawless", priority: 50, credReward: 50, rule: { kind: "flawless-clear", n: 3 } },
    { key: "first-light", name: "First Light", icon: "🩸", descriptionMd: "Draw first blood on any room.", title: "First Light", priority: 30, credReward: 25, rule: { kind: "first-blood", n: 1 } },
    { key: "bloodhound", name: "Bloodhound", icon: "🐺", descriptionMd: "Draw first blood on 3 rooms.", title: "the Bloodhound", priority: 65, credReward: 60, rule: { kind: "first-blood", n: 3 } },
    { key: "speed-demon", name: "Speed Demon", icon: "⚡", descriptionMd: "Crack a room within 2 minutes of it opening for you.", title: "Speed Demon", priority: 55, credReward: 40, rule: { kind: "speed", withinSec: 120 } },
    { key: "loaded", name: "Loaded", icon: "💰", descriptionMd: "Hold 400 creds at once.", credReward: 20, rule: { kind: "creds-held", amount: 400 } },
    { key: "regular", name: "The Regular", icon: "🧾", descriptionMd: "Spend 150 creds at the shop.", title: "the Regular", priority: 20, credReward: 20, rule: { kind: "big-spender", spent: 150 } },
    { key: "punctual", name: "Punctual", icon: "⏰", descriptionMd: "Clear a room that's only open on a timer.", title: "the Punctual", priority: 60, credReward: 50, rule: { kind: "time-room" } },
    { key: "night-shift", name: "Night Shift", icon: "🌙", descriptionMd: "Solve something in the final 45 minutes.", title: "Night Shift", priority: 25, credReward: 30, rule: { kind: "after", iso: "2026-09-16T17:45:00.000Z" } },
    { key: "collector", name: "The Collector", icon: "🗃️", descriptionMd: "Hold every trophy.", title: "the Collector", priority: 80, credReward: 80, hidden: true, rule: { kind: "all-trophies" } },
  ],
  npc: {
    slug: "shop",
    name: "The Shop",
    icon: "🛒",
    blurbMd:
      "`> shop.exe — the only vendor left in THE STACK.`\n\nI forge keycards from shards, I sell the odd tip, and I pay creds for junk you drag out of there. Everything's a trade. No small talk.",
    trades: [
      {
        label: "Forge a Red Keycard",
        descriptionMd: "Three **Alpha Shards** → one Red Keycard. Opens the Security Office.",
        give: { "frag-alpha": 3 },
        get: { "keycard-red": 1 },
        showIfHolds: { "frag-alpha": 1 },
      },
      {
        label: "Forge a Black Keycard",
        descriptionMd: "Three **Beta Shards** → one Black Keycard.",
        give: { "frag-beta": 3 },
        get: { "keycard-black": 1 },
        showIfHolds: { "frag-beta": 1 },
      },
      {
        label: "Open THE CORE",
        descriptionMd: "Red + Green + Black keycard. I hand them to the door, the door opens. This is the endgame — no refunds.",
        give: { "keycard-red": 1, "keycard-green": 1, "keycard-black": 1 },
        get: { "keycard-master": 1 },
        showIfHolds: { "keycard-black": 1 },
      },
      {
        label: "Buy the tunnel tip — 25 💰",
        descriptionMd: "There's a trick to the Maintenance Tunnels. I'll tell you for 25 creds.",
        give: { cred: 25 },
        revealsHintRef: "tunnels-npc",
        showIfHolds: { "keycard-green": 1 },
      },
      {
        label: "Pawn a Corroded ID Badge — +15 💰",
        give: { "loot-old-badge": 1 },
        get: { cred: 15 },
        repeatable: true,
        showIfHolds: { "loot-old-badge": 1 },
      },
      {
        label: "Sell Cold Coffee — +5 💰",
        give: { "loot-coffee": 1 },
        get: { cred: 5 },
        repeatable: true,
        showIfHolds: { "loot-coffee": 1 },
      },
    ],
  },
  modules: [
    {
      slug: "lobby",
      title: "R0 · THE LOBBY",
      theme: "green",
      blurb: "Ground floor. Everyone starts here. Small loot, good habits.",
      map: { x: 1, y: 0, zone: "entrance" },
      edges: ["reception", "server-closet"],
      clearReward: { cred: 10 },
      puzzles: [
        {
          slug: "lobby-flag",
          title: "Somebody left a note",
          basePoints: 100,
          difficulty: "easy",
          validatorConfig: { answer: "CMINUS{L00K_B3F0R3_Y0U_L3AP}", leakInSource: true },
          rewards: { cred: 20, "frag-alpha": 1 },
          promptMd:
            "First rule of THE STACK: **read the source**. Right-click → View Page Source (`Ctrl+U`). There's a comment in the HTML with a `CMINUS{...}` flag. Find it, paste it.",
        },
      ],
      hints: [{ contentMd: "`Ctrl+U`, then `Ctrl+F` and search for `CMINUS`.", rule: { kind: "free" } }],
    },
    {
      slug: "reception",
      title: "R1 · RECEPTION",
      theme: "cyan",
      blurb: "The front desk. A sticky note, badly hidden.",
      map: { x: 3, y: 0, zone: "entrance" },
      edges: ["lobby", "mailroom", "security"],
      clearReward: { cred: 15 },
      puzzles: [
        {
          slug: "reception-caesar",
          title: "The sticky note",
          basePoints: 120,
          difficulty: "easy",
          perUserFlag: true,
          validatorConfig: { perUser: true },
          rewards: { cred: 25, "keycard-blue": 1 },
          promptMd: `Whoever sat here "encrypted" their password note by nudging every letter **3 forward**. Nudge it back. Yours:

\`\`\`
{{flagCaesar3}}
\`\`\`

Lazy route: open the **toolkit**, run \`caesar "…" all\`, and read down for the \`CMINUS{...}\` line.`,
        },
      ],
      hints: [
        { contentMd: 'toolkit → `caesar "<the text>" all` → the flag is one of the 25 lines.', rule: { kind: "free" } },
        { contentMd: "Shift each letter back by 3: A→X, B→Y, C→Z, D→A… (or just use the toolkit).", rule: { kind: "auto-after-wrong", n: 3 }, puzzleSlug: "reception-caesar" },
      ],
    },
    {
      slug: "mailroom",
      title: "R2 · THE MAILROOM",
      theme: "amber",
      blurb: "A shared inbox nobody cleaned out.",
      map: { x: 5, y: 0, zone: "entrance" },
      edges: ["reception", "honeypot", "tunnels"],
      clearReward: { cred: 10, "loot-coffee": 1 },
      puzzles: [
        {
          slug: "mailroom-inbox",
          title: "Six messages",
          basePoints: 130,
          difficulty: "easy",
          validatorConfig: { answer: "CMINUS{R34D_TH3_H34D3RS}" },
          rewards: { cred: 25, "frag-alpha": 1 },
          promptMd: `Six messages sat unread. Five are addressed to \`noreply@thestack\`. **One isn't.** Read that one.

| # | To | Subject | Body |
|---|----|---------|------|
| 1 | noreply@thestack | lunch | the vending machine ate my card again |
| 2 | noreply@thestack | RE: RE: RE: tickets | please stop replying all |
| 3 | ops@thestack | key rotation tonight | flag's taped to the server room door: \`CMINUS{R34D_TH3_H34D3RS}\` |
| 4 | noreply@thestack | you won a prize | (you did not win a prize) |
| 5 | noreply@thestack | the printer | the printer is on fire. again. |
| 6 | noreply@thestack | standup | standup is now 45 minutes long |`,
        },
      ],
      hints: [{ contentMd: "Only one row has a real address in the **To** column. The rest are `noreply`.", rule: { kind: "free" } }],
    },
    {
      slug: "server-closet",
      title: "R3 · SERVER CLOSET",
      theme: "green",
      blurb: "Hot, loud, and locked. You'll need the Blue Keycard from Reception.",
      map: { x: 2, y: 2, zone: "sublevel" },
      edges: ["lobby", "broadcast-booth"],
      prereq: { "keycard-blue": 1 },
      clearReward: { cred: 15 },
      puzzles: [
        {
          slug: "closet-diff",
          title: "Spot the change",
          basePoints: 150,
          difficulty: "easy",
          validatorConfig: { answer: "CMINUS{D1FF_TH3_C0NF1G}" },
          rewards: { cred: 30, "frag-alpha": 1, "loot-old-badge": 1 },
          promptMd: `Two snapshots of the same config file, ten minutes apart. Someone changed **exactly one line**. Find it — that line is the flag.

**BEFORE**
\`\`\`
timeout=30
retries=3
region=ap-south-1
banner=welcome
debug=false
motd=nothing to see here
\`\`\`

**AFTER**
\`\`\`
timeout=30
retries=3
region=ap-south-1
banner=welcome
debug=false
motd=CMINUS{D1FF_TH3_C0NF1G}
\`\`\``,
        },
      ],
      hints: [{ contentMd: "Read the two blocks line by line. Five lines match. The sixth doesn't.", rule: { kind: "free" } }],
    },
    {
      slug: "security",
      title: "R4 · SECURITY OFFICE",
      theme: "amber",
      blurb: "CCTV and badge logs. Needs the Red Keycard — forge it at the Shop from 3 Alpha Shards.",
      map: { x: 4, y: 2, zone: "sublevel" },
      edges: ["reception", "broadcast-booth"],
      prereq: { "keycard-red": 1 },
      clearReward: { cred: 20 },
      puzzles: [
        {
          slug: "security-cctv",
          title: "Who was in the server room?",
          basePoints: 180,
          difficulty: "medium",
          validatorConfig: { answer: "CMINUS{IT_WAS_MORGAN}" },
          rewards: { cred: 35, "frag-beta": 1, "keycard-green": 1 },
          promptMd: `Four people badged in last night: **Alex, Blair, Morgan, Riley**. From the logs:

- The person who entered the server room was **not Alex**.
- Blair went straight to the canteen and nowhere else.
- Riley badged in **after** Morgan, and went to the lobby.
- Exactly one person entered the server room — and they **badged in first**.

Who was in the server room? Answer as \`CMINUS{IT_WAS_<NAME IN CAPS>}\`.`,
        },
      ],
      hints: [
        { contentMd: "Start from “badged in first”. Who *couldn't* have been first? Cross them off.", rule: { kind: "free" } },
        { contentMd: "Blair (canteen only) — out. Riley (after Morgan) — out. Alex (not the server room) — out. One name left.", rule: { kind: "buy", cost: 20 }, puzzleSlug: "security-cctv" },
      ],
    },
    {
      slug: "honeypot",
      title: "R5 · THE HONEYPOT",
      theme: "red",
      blurb: "Bait. It's covered in flags. Wrong guesses cost creds.",
      map: { x: 7, y: 0, zone: "entrance" },
      edges: ["mailroom", "supply-drop"],
      clearReward: { cred: 10 },
      puzzles: [
        {
          slug: "honeypot-real",
          title: "One of these is real",
          basePoints: 140,
          difficulty: "medium",
          validatorConfig: { answer: "CMINUS{N0T_3V3RY_FL4G_1S_R34L}", wrongCostCreds: 5 },
          rewards: { cred: 20, "frag-beta": 1, "trophy-sweettooth": 1 },
          promptMd: `⚠️ This room is a trap. Every wrong guess costs you **5 💰**. Only one of these flags is real — the rest are *shaped wrong*.

\`\`\`
CM1NUS{one_two_three}
CMINUS{th1s_0n3_1s_w4y_t00_l0ng_t0_b3_a_r34l_fl4g_surely}
CMINUS{N0T_3V3RY_FL4G_1S_R34L}
cminus{lowercase_looks_suspicious}
CMINUS{ has a space }
\`\`\``,
        },
      ],
      hints: [
        { contentMd: "A real flag is `CMINUS{...}` — capital CMINUS, curly braces, no spaces, sensible length.", rule: { kind: "buy", cost: 10 }, puzzleSlug: "honeypot-real" },
      ],
    },
    {
      slug: "tunnels",
      title: "R6 · MAINTENANCE TUNNELS",
      theme: "magenta",
      blurb: "Dark, damp, and locked. Needs the Green Keycard.",
      map: { x: 6, y: 2, zone: "sublevel" },
      edges: ["mailroom", "the-core"],
      prereq: { "keycard-green": 1 },
      clearReward: { cred: 20 },
      puzzles: [
        {
          slug: "tunnels-trail",
          title: "Follow the pipe",
          basePoints: 200,
          difficulty: "medium",
          validatorConfig: { answer: R6_TRAIL_PLAIN },
          rewards: { cred: 40, "frag-beta": 1 },
          promptMd: `A note is taped to a pipe:

> *"maintenance code is scratched into the wall by the fuse box. they wrote it backwards, the muppets."*

Scratched into the wall by the fuse box:

\`\`\`
${[...R6_TRAIL_PLAIN].reverse().join("")}
\`\`\`

Read it backwards. Toolkit: \`reverse "…"\`.`,
        },
      ],
      hints: [
        { contentMd: 'It is literally written backwards. `reverse "…"` in the toolkit, or read right-to-left.', rule: { kind: "free" } },
        {
          ref: "tunnels-npc",
          contentMd: "Copy the scratched string into the toolkit: `reverse \"}TC3NN0C…{SUNIMC\"`. Out comes the flag. That's it — I told you it was cheap.",
          rule: { kind: "npc" },
          puzzleSlug: "tunnels-trail",
        },
      ],
    },
    {
      slug: "the-core",
      title: "R7 · THE CORE",
      theme: "red",
      blurb: "The heart of THE STACK. The Shop opens it — you bring the three keycards.",
      map: { x: 6, y: 4, zone: "core" },
      edges: ["tunnels", "supply-drop", "broadcast-booth"],
      prereq: { "keycard-master": 1 },
      clearReward: { cred: 50 },
      puzzles: [
        {
          slug: "core-final",
          title: "The last string",
          basePoints: 350,
          difficulty: "boss",
          perUserFlag: true,
          validatorConfig: { perUser: true },
          rewards: { cred: 100, "trophy-root": 1 },
          promptMd: `The Shop fed the door your three keycards and it opened. The core coughs up one last string — **yours, nobody else's**:

\`\`\`
{{flagB64}}
\`\`\`

It's base64. Decode it. Toolkit: \`unbase64 "…"\`. Then paste what comes out.`,
        },
      ],
      hints: [
        { contentMd: 'toolkit → `unbase64 "<that string>"` → paste the result. Done.', rule: { kind: "free" } },
      ],
    },
    {
      slug: "broadcast-booth",
      title: "R8 · BROADCAST BOOTH",
      theme: "cyan",
      blurb: "The old PA system. It only powers up for one short window all night — check the map for the countdown.",
      map: { x: 3, y: 4, zone: "core" },
      edges: ["server-closet", "security", "the-core"],
      // one-shot window — admin editable. Default: 20:30–21:00 IST (mid-event).
      unlock: {
        windowAt: { from: "2026-09-16T15:00:00.000Z", to: "2026-09-16T15:30:00.000Z" },
      },
      clearReward: { cred: 30, "trophy-onair": 1 },
      puzzles: [
        {
          slug: "booth-morse",
          title: "On the air",
          basePoints: 220,
          difficulty: "medium",
          validatorConfig: { answer: "CMINUS{L1V3_0N_41R}" },
          rewards: { cred: 60, "frag-alpha": 1 },
          promptMd: `The booth is broadcasting one loop, in Morse:

\`\`\`
.-.. .---- ...- ...-- / ----- -. / ....- .---- .-.
\`\`\`

Decode it. Toolkit: \`unmorse "..."\` (\`/\` is a space). Then wrap the words with \`_\` between them: \`CMINUS{..._..._...}\`.`,
        },
      ],
      hints: [
        { contentMd: "toolkit → `unmorse \"<the dots and dashes>\"`. The `/` marks are spaces.", rule: { kind: "free" } },
      ],
    },
    {
      slug: "supply-drop",
      title: "R9 · SUPPLY DROP",
      theme: "green",
      blurb: "A chute that drops loot on a timer — open ~10 minutes every 30. Dash in when the map lights it up.",
      map: { x: 8, y: 2, zone: "sublevel" },
      edges: ["honeypot", "the-core"],
      unlock: { recurring: { everyMin: 30, openMin: 10 } },
      clearReward: { cred: 15 },
      puzzles: [
        {
          slug: "drop-grab",
          title: "Grab the crate",
          basePoints: 90,
          difficulty: "easy",
          validatorConfig: { answer: "CMINUS{5UPPLY_5N4TCH3D}" },
          rewards: { cred: 30, "frag-beta": 1 },
          promptMd: `A crate label, base64'd:

\`\`\`
Q01JTlVTezVVUFBMWV81TjRUQ0gzRH0=
\`\`\`

\`unbase64\` it in the toolkit and submit what comes out. Be quick — the chute closes.`,
        },
      ],
      hints: [
        { contentMd: "toolkit → `unbase64 \"Q01JTlVTezVVUFBMWV81TjRUQ0gzRH0=\"`.", rule: { kind: "free" } },
      ],
    },
  ],
};

/* ══════════════════════════════ USERS ══════════════════════════════ */

async function seedUser(o: {
  registerId: string;
  password: string;
  displayName: string;
  branch?: string;
  year?: string;
  role?: string;
  eventSlug: string;
}) {
  const event = await prisma.event.findUniqueOrThrow({ where: { slug: o.eventSlug } });
  const passwordHash = await bcrypt.hash(o.password, 10);
  await prisma.user.upsert({
    where: { registerId: o.registerId },
    update: {
      displayName: o.displayName,
      branch: o.branch ?? "",
      year: o.year ?? "",
      role: o.role ?? "participant",
      eventId: event.id,
      passwordHash,
    },
    create: {
      registerId: o.registerId,
      displayName: o.displayName,
      branch: o.branch ?? "",
      year: o.year ?? "",
      role: o.role ?? "participant",
      eventId: event.id,
      passwordHash,
    },
  });
}

async function main() {
  await seedEvent(demoEvent);
  await seedEvent(mainEvent);

  await seedUser({ registerId: "ADMIN001", password: "admin-pass-2026", displayName: "Event Control", role: "admin", eventSlug: "pseudo-breach-main" });
  await seedUser({ registerId: "PB-DEMO-01", password: "demo-pass-01", displayName: "Demo Tester", branch: "CSE", year: "1", eventSlug: "demo-session" });
  await seedUser({ registerId: "PB-MAIN-01", password: "main-pass-01", displayName: "Main Tester", branch: "CSE", year: "1", eventSlug: "pseudo-breach-main" });
  for (let i = 2; i <= 10; i++) {
    await seedUser({
      registerId: `PB-MAIN-${String(i).padStart(2, "0")}`,
      password: `main-pass-${String(i).padStart(2, "0")}`,
      displayName: `Test Player ${i}`,
      branch: ["CSE", "ECE", "MECH", "IT", "EEE"][i % 5],
      year: ["1", "2", "3", "4"][i % 4],
      eventSlug: "pseudo-breach-main",
    });
  }

  console.log("seeded:", {
    events: await prisma.event.count(),
    items: await prisma.item.count(),
    modules: await prisma.module.count(),
    puzzles: await prisma.puzzle.count(),
    hints: await prisma.hint.count(),
    trades: await prisma.npcTrade.count(),
    achievements: await prisma.achievement.count(),
    users: await prisma.user.count(),
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
