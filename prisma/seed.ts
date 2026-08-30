/**
 * Seed — idempotent. Creates the two events (demo + main), their modules,
 * puzzles, hints and cross-module tokens, plus a handful of test accounts.
 *
 *   npm run db:seed          # apply / update
 *   npm run db:reset         # wipe + re-seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
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

type PuzzleSeed = {
  slug: string;
  title: string;
  promptMd: string;
  type: string;
  basePoints: number;
  difficulty: string;
  validatorConfig?: unknown;
  perUserFlag?: boolean;
  cooldownSec?: number;
  grantsTokenKey?: string;
};
type HintSeed = {
  contentMd: string;
  cost?: number;
  unlockRule: unknown;
  grantsTokenKey?: string;
  puzzleSlug?: string;
};
type ModuleSeed = {
  slug: string;
  title: string;
  blurb: string;
  theme?: string;
  prerequisiteTokenKeys?: string[];
  isHidden?: boolean;
  puzzles: PuzzleSeed[];
  hints?: HintSeed[];
};

async function seedEvent(opts: {
  slug: string;
  name: string;
  isDemo: boolean;
  startsAt: Date;
  endsAt: Date;
  status: string;
  modules: ModuleSeed[];
}) {
  const event = await prisma.event.upsert({
    where: { slug: opts.slug },
    update: {
      name: opts.name,
      isDemo: opts.isDemo,
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      status: opts.status,
    },
    create: {
      slug: opts.slug,
      name: opts.name,
      isDemo: opts.isDemo,
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      status: opts.status,
    },
  });

  for (let mi = 0; mi < opts.modules.length; mi++) {
    const m = opts.modules[mi]!;
    const mod = await prisma.module.upsert({
      where: { eventId_slug: { eventId: event.id, slug: m.slug } },
      update: {
        title: m.title,
        blurb: m.blurb,
        order: mi,
        theme: m.theme ?? "default",
        isHidden: m.isHidden ?? false,
        prerequisiteTokenKeys: JSON.stringify(m.prerequisiteTokenKeys ?? []),
      },
      create: {
        eventId: event.id,
        slug: m.slug,
        title: m.title,
        blurb: m.blurb,
        order: mi,
        theme: m.theme ?? "default",
        isHidden: m.isHidden ?? false,
        prerequisiteTokenKeys: JSON.stringify(m.prerequisiteTokenKeys ?? []),
      },
    });

    for (let pi = 0; pi < m.puzzles.length; pi++) {
      const p = m.puzzles[pi]!;
      await prisma.puzzle.upsert({
        where: { slug: p.slug },
        update: {
          title: p.title,
          promptMd: p.promptMd,
          type: p.type,
          basePoints: p.basePoints,
          difficulty: p.difficulty,
          order: pi,
          validatorConfig: JSON.stringify(p.validatorConfig ?? {}),
          perUserFlag: p.perUserFlag ?? false,
          cooldownSec: p.cooldownSec ?? 15,
          grantsTokenKey: p.grantsTokenKey ?? null,
          moduleId: mod.id,
        },
        create: {
          slug: p.slug,
          title: p.title,
          promptMd: p.promptMd,
          type: p.type,
          basePoints: p.basePoints,
          difficulty: p.difficulty,
          order: pi,
          validatorConfig: JSON.stringify(p.validatorConfig ?? {}),
          perUserFlag: p.perUserFlag ?? false,
          cooldownSec: p.cooldownSec ?? 15,
          grantsTokenKey: p.grantsTokenKey ?? null,
          moduleId: mod.id,
        },
      });
    }

    // hints are re-created each run (no natural key) — clear then insert
    await prisma.hint.deleteMany({ where: { moduleId: mod.id } });
    for (let hi = 0; hi < (m.hints ?? []).length; hi++) {
      const h = m.hints![hi]!;
      const puzzle = h.puzzleSlug
        ? await prisma.puzzle.findUnique({ where: { slug: h.puzzleSlug } })
        : null;
      await prisma.hint.create({
        data: {
          moduleId: mod.id,
          puzzleId: puzzle?.id ?? null,
          order: hi,
          contentMd: h.contentMd,
          cost: h.cost ?? 0,
          unlockRule: JSON.stringify(h.unlockRule),
          grantsTokenKey: h.grantsTokenKey ?? null,
        },
      });
    }
  }

  return event;
}

/* ────────────────────────────── DEMO EVENT ────────────────────────────── */

const DEMO_D1_PLAIN = "CMINUS{ROT_ROT_ROT}";
const DEMO_D2_ANSWER = "CMINUS{RELAY_COMPLETE}";

const demoModules: ModuleSeed[] = [
  {
    slug: "hello-breacher",
    title: "D0 · HELLO BREACHER",
    theme: "green",
    blurb: "Your first hack. It is barely a hack. That's the point.",
    puzzles: [
      {
        slug: "hello-breacher",
        title: "The note that isn't for you",
        type: "static",
        basePoints: 50,
        difficulty: "easy",
        validatorConfig: { answer: "CMINUS{W3LC0M3_BR34CH3R}", leakInSource: true },
        promptMd: `Somewhere on this page there is a comment that was left in by mistake.

**Right-click → View Page Source** (or open DevTools). Find the line that starts with \`<!--\`.
It contains a flag shaped like \`CMINUS{...}\`. Paste it below.`,
      },
    ],
    hints: [
      {
        contentMd: "`Ctrl+U` opens the page source in most browsers. Then `Ctrl+F` for `CMINUS`.",
        unlockRule: { kind: "free" },
      },
    ],
  },
  {
    slug: "tiny-cipher",
    title: "D1 · TINY CIPHER",
    theme: "cyan",
    blurb: "Meet the terminal. It does the boring parts for you.",
    puzzles: [
      {
        slug: "tiny-cipher",
        title: "Three letters to the right",
        type: "static",
        basePoints: 75,
        difficulty: "easy",
        grantsTokenKey: "demo-relay",
        validatorConfig: { answer: DEMO_D1_PLAIN },
        promptMd: `Every letter below has been pushed **3 places forward** in the alphabet (a Caesar shift).

\`\`\`
${caesar(DEMO_D1_PLAIN, 3)}
\`\`\`

Shift it back. You can do it by hand, or open **/terminal** and run:

\`\`\`
yell caesar("${caesar(DEMO_D1_PLAIN, 3)}", -3);
\`\`\``,
      },
    ],
    hints: [
      {
        contentMd: "In the terminal: `caesar(text, -3)`. The minus means *backwards*.",
        unlockRule: { kind: "free" },
      },
      {
        contentMd: `The answer is \`${DEMO_D1_PLAIN}\`. (You still get points — this is practice.)`,
        unlockRule: { kind: "auto-after-wrong", n: 3 },
      },
    ],
  },
  {
    slug: "pass-the-token",
    title: "D2 · PASS THE TOKEN",
    theme: "magenta",
    blurb: "Modules talk to each other. Solving one can open a door in another.",
    prerequisiteTokenKeys: ["demo-relay"],
    puzzles: [
      {
        slug: "pass-the-token",
        title: "The relay",
        type: "static",
        basePoints: 75,
        difficulty: "easy",
        validatorConfig: { answer: DEMO_D2_ANSWER },
        promptMd: `This module was **locked** until you solved TINY CIPHER — that gave you the \`demo-relay\` token.

Now unlock the hint below (it's free and token-gated) and it will hand you the answer.
That's the whole lesson: **hints and keys cross between modules.**`,
      },
    ],
    hints: [
      {
        contentMd: `You made it through. The flag is \`${DEMO_D2_ANSWER}\`.`,
        unlockRule: { kind: "token", key: "demo-relay" },
      },
    ],
  },
];

/* ────────────────────────────── MAIN EVENT ────────────────────────────── */

const FRONT_DOOR_ANSWER = `CMINUS{${b64('{"user":"guest","admin":true}')}}`;
const DOM_ANSWER = "CMINUS{D0M_1S_N0T_S3CUR1TY}";
const DOM_ANSWER_B64 = b64(DOM_ANSWER);

const fizzbuzz = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  if (n % 15 === 0) return "fizzbuzz";
  if (n % 3 === 0) return "fizz";
  if (n % 5 === 0) return "buzz";
  return String(n);
}).join("\n");

const mainModules: ModuleSeed[] = [
  {
    slug: "orientation",
    title: "M0 · ORIENTATION",
    theme: "green",
    blurb: "Warm-up. Everyone starts here. Points are small; habits are not.",
    puzzles: [
      {
        slug: "recon-headers",
        title: "It's in the page",
        type: "static",
        basePoints: 100,
        difficulty: "easy",
        validatorConfig: { answer: "CMINUS{V13W_S0URC3_FTW}", leakInSource: true },
        promptMd: `Two habits win CTFs: **read the source** and **read the response**.

There is a flag hidden in this page's HTML source *and* echoed in a custom response
header (\`X-Breach-Note\`) on this route. Either one works. Find it.`,
      },
    ],
    hints: [
      {
        contentMd: "DevTools → Network tab → click the document request → Headers. Or just `Ctrl+U`.",
        unlockRule: { kind: "free" },
      },
    ],
  },
  {
    slug: "front-door",
    title: "M1 · THE FRONT DOOR",
    theme: "amber",
    blurb: "A login token that trusts the client. Classic mistake. Walk in.",
    puzzles: [
      {
        slug: "forge-token",
        title: "Flip the bit that matters",
        type: "static",
        basePoints: 200,
        difficulty: "medium",
        validatorConfig: { answer: FRONT_DOOR_ANSWER },
        promptMd: `A demo service issues this "session token":

\`\`\`
${b64('{"user":"guest","admin":false}')}
\`\`\`

That's base64. Decode it, change your access level, re-encode it, and wrap the whole
base64 string as \`CMINUS{...}\`.

In the terminal: \`b64d("...")\` and \`b64e("...")\`.`,
      },
    ],
    hints: [
      {
        contentMd: "Decoded it says `{\"user\":\"guest\",\"admin\":false}`. You want `true`. Keep the JSON exactly otherwise.",
        unlockRule: { kind: "auto-after-wrong", n: 3 },
      },
    ],
  },
  {
    slug: "caesars-ghost",
    title: "M2 · CAESAR'S GHOST",
    theme: "cyan",
    blurb: "A cipher wearing a cipher. Peel the outside first.",
    puzzles: [
      {
        slug: "ghost-chain",
        title: "GHOST is the key",
        type: "static",
        perUserFlag: true,
        basePoints: 200,
        difficulty: "medium",
        grantsTokenKey: "ghost-key",
        validatorConfig: { perUser: true },
        promptMd: `Your personal ciphertext:

\`\`\`
{{flagGhostChain}}
\`\`\`

It's **base64** on the outside. Inside is a **Vigenère** cipher. The key is not subtle.

Terminal: \`b64d(...)\` then \`vigenere(text, "GHOST", yes)\` — the \`yes\` means *decrypt*.`,
      },
    ],
    hints: [
      { contentMd: "GHOST is watching. GHOST is also the key. Literally the word `GHOST`.", unlockRule: { kind: "free" } },
      {
        contentMd: "Order: `b64d` first (outer layer), *then* Vigenère-decrypt with key `GHOST`.",
        unlockRule: { kind: "auto-after-wrong", n: 3 },
      },
      {
        contentMd: "Solving this module hands you the **ghost-key** token — you'll need it for SIGNAL & NOISE and THE VAULT.",
        unlockRule: { kind: "free" },
      },
    ],
  },
  {
    slug: "boot-camp",
    title: "M3 · c- BOOT CAMP",
    theme: "green",
    blurb: "Write actual c-. Two puzzles: one you print, one you crack.",
    puzzles: [
      {
        slug: "fizzbuzz",
        title: "FizzBuzz, c- style",
        type: "cminus-output",
        basePoints: 150,
        difficulty: "easy",
        validatorConfig: { expectedStdout: fizzbuzz },
        promptMd: `Write a c- program that prints **1 to 20**, one per line, except:

- multiples of 3 → \`fizz\`
- multiples of 5 → \`buzz\`
- multiples of both → \`fizzbuzz\`

Run it in the terminal, then paste **the program's output** below.

\`\`\`
meh n = 1;
whyle n <= 20 {
  ?? your logic here
  n = n + 1;
}
\`\`\``,
      },
      {
        slug: "xor-decode",
        title: "Undo the xor",
        type: "static",
        perUserFlag: true,
        basePoints: 250,
        difficulty: "medium",
        grantsTokenKey: "compiler-pass",
        validatorConfig: { perUser: true },
        promptMd: `Your flag was XORed with the key \`cminus\` and printed as hex:

\`\`\`
{{flagXorHex}}
\`\`\`

Recover it. Terminal: \`xor(hexd("..."), "cminus")\`.`,
      },
    ],
    hints: [
      {
        contentMd: "`iff n % 15 == 0 { ... } elz iff n % 3 == 0 { ... }` — check 15 **first**.",
        unlockRule: { kind: "free" },
        puzzleSlug: "fizzbuzz",
      },
      {
        contentMd: "`hexd` turns hex text back into raw bytes. Then `xor` those bytes with `\"cminus\"`. XOR is its own inverse.",
        unlockRule: { kind: "free" },
        puzzleSlug: "xor-decode",
      },
      {
        contentMd: "Cracking `xor-decode` gives you the **compiler-pass** token → needed for THE COMPILER'S CURSE and THE VAULT.",
        unlockRule: { kind: "free" },
      },
    ],
  },
  {
    slug: "dom-dimension",
    title: "M4 · THE DOM DIMENSION",
    theme: "magenta",
    blurb: "The client is not your friend. Everything it hides, it hides in plain sight.",
    puzzles: [
      {
        slug: "hidden-state",
        title: "Ask the DOM nicely",
        type: "static",
        basePoints: 200,
        difficulty: "medium",
        validatorConfig: { answer: DOM_ANSWER, domFlagB64: DOM_ANSWER_B64 },
        promptMd: `This module's page has an element that is \`hidden\`, carrying a \`data-vault\`
attribute. Its value is base64. There is also an inline script with a very trusting
\`if (user.isAdmin)\` check.

Open the **Elements** panel, find the node, decode the attribute.`,
      },
    ],
    hints: [
      {
        contentMd: "In DevTools console: `document.querySelector('[data-vault]').dataset.vault` then `atob(that)`.",
        unlockRule: { kind: "free" },
      },
    ],
  },
  {
    slug: "signal-noise",
    title: "M5 · SIGNAL & NOISE",
    theme: "cyan",
    blurb: "The answer only comes through the terminal. And it's not plaintext.",
    prerequisiteTokenKeys: ["ghost-key"],
    puzzles: [
      {
        slug: "stego-lines",
        title: "Find the signal",
        type: "static",
        perUserFlag: true,
        basePoints: 300,
        difficulty: "hard",
        grantsTokenKey: "siren-key",
        validatorConfig: { perUser: true },
        promptMd: `This module is **locked to the terminal**. Run:

\`\`\`
probe("signal-noise");
\`\`\`

You'll get lines of noise with one \`sig:\` line. That signal was **reversed**, then
**base64'd**. Undo both.

Terminal: \`reverse(b64d("..."))\`.`,
      },
    ],
    hints: [
      {
        contentMd: "You needed the **ghost-key** token to even open this module. Now: `probe` → take the `sig:` value → `b64d` → `reverse`.",
        unlockRule: { kind: "token", key: "ghost-key" },
      },
      {
        contentMd: "Solving this grants the **siren-key** token. Three tokens open THE VAULT.",
        unlockRule: { kind: "free" },
      },
    ],
  },
  {
    slug: "compilers-curse",
    title: "M6 · THE COMPILER'S CURSE",
    theme: "amber",
    blurb: "A c- program that eats a secret and prints garbage. Run it backwards.",
    prerequisiteTokenKeys: ["compiler-pass"],
    puzzles: [
      {
        slug: "read-the-program",
        title: "Reverse the pipeline",
        type: "static",
        perUserFlag: true,
        basePoints: 350,
        difficulty: "hard",
        validatorConfig: { perUser: true },
        promptMd: `The program that ran on this module:

\`\`\`
yell b64e(xor(reverse(SECRET), "curse"));
\`\`\`

For you, it printed:

\`\`\`
{{flagCurseChain}}
\`\`\`

\`SECRET\` is your flag. Undo the pipeline: last operation first.
\`reverse(xor(b64d("..."), "curse"))\`.`,
      },
    ],
    hints: [
      {
        contentMd: "Undo order is reverse of do order: `b64d` → `xor(..., \"curse\")` → `reverse`.",
        unlockRule: { kind: "free" },
      },
      {
        contentMd: "You can also `probe(\"compilers-curse\")` in the terminal to get the blob without copy-pasting.",
        unlockRule: { kind: "free" },
      },
    ],
  },
  {
    slug: "the-vault",
    title: "M7 · THE VAULT",
    theme: "red",
    blurb: "The boss. Three module tokens. One knock. Highest points on the board.",
    prerequisiteTokenKeys: ["ghost-key", "compiler-pass", "siren-key"],
    puzzles: [
      {
        slug: "assemble-master",
        title: "Open it",
        type: "static",
        perUserFlag: true,
        basePoints: 500,
        difficulty: "boss",
        validatorConfig: { perUser: true },
        promptMd: `You hold **ghost-key**, **compiler-pass** and **siren-key** (or this module
wouldn't have opened).

In the terminal:

\`\`\`
knock("the-vault", "open");
\`\`\`

If you really hold all three, the vault returns your flag. Submit it here.`,
      },
    ],
    hints: [
      {
        contentMd: "There's no clever trick left. `knock(\"the-vault\", \"open\")`. The work was getting the three tokens.",
        unlockRule: {
          kind: "terminal",
          knockKey: "open",
          requireTokens: ["ghost-key", "compiler-pass", "siren-key"],
          revealFlagFor: "assemble-master",
        },
      },
    ],
  },
];

/* ──────────────────────────────── USERS ──────────────────────────────── */

async function seedUser(opts: {
  registerId: string;
  password: string;
  displayName: string;
  branch?: string;
  year?: string;
  role?: string;
  eventSlug: string;
}) {
  const event = await prisma.event.findUniqueOrThrow({ where: { slug: opts.eventSlug } });
  const passwordHash = await bcrypt.hash(opts.password, 10);
  await prisma.user.upsert({
    where: { registerId: opts.registerId },
    update: {
      displayName: opts.displayName,
      branch: opts.branch ?? "",
      year: opts.year ?? "",
      role: opts.role ?? "participant",
      eventId: event.id,
      passwordHash,
    },
    create: {
      registerId: opts.registerId,
      displayName: opts.displayName,
      branch: opts.branch ?? "",
      year: opts.year ?? "",
      role: opts.role ?? "participant",
      eventId: event.id,
      passwordHash,
    },
  });
}

async function main() {
  const now = new Date();
  const hr = 3600_000;

  await seedEvent({
    slug: "demo-session",
    name: "PSEUDO-BREACH · Demo Session",
    isDemo: true,
    startsAt: new Date(now.getTime() - hr),
    endsAt: new Date(now.getTime() + 30 * 24 * hr),
    status: "live",
    modules: demoModules,
  });

  await seedEvent({
    slug: "pseudo-breach-main",
    name: "PSEUDO-BREACH",
    isDemo: false,
    // 2026-09-16 18:00 to 23:59 IST (UTC+5:30)
    startsAt: new Date("2026-09-16T12:30:00.000Z"),
    endsAt: new Date("2026-09-16T18:29:00.000Z"),
    status: "draft",
    modules: mainModules,
  });

  await seedUser({
    registerId: "ADMIN001",
    password: "admin-pass-2026",
    displayName: "Event Control",
    role: "admin",
    eventSlug: "pseudo-breach-main",
  });
  await seedUser({
    registerId: "PB-DEMO-01",
    password: "demo-pass-01",
    displayName: "Demo Tester",
    branch: "CSE",
    year: "3",
    eventSlug: "demo-session",
  });
  await seedUser({
    registerId: "PB-MAIN-01",
    password: "main-pass-01",
    displayName: "Main Tester",
    branch: "CSE",
    year: "3",
    eventSlug: "pseudo-breach-main",
  });
  for (let i = 2; i <= 6; i++) {
    await seedUser({
      registerId: `PB-MAIN-${String(i).padStart(2, "0")}`,
      password: `main-pass-${String(i).padStart(2, "0")}`,
      displayName: `Test Player ${i}`,
      branch: ["CSE", "ECE", "MECH", "IT", "EEE"][i % 5],
      year: String((i % 4) + 1),
      eventSlug: "pseudo-breach-main",
    });
  }

  const counts = {
    events: await prisma.event.count(),
    modules: await prisma.module.count(),
    puzzles: await prisma.puzzle.count(),
    hints: await prisma.hint.count(),
    users: await prisma.user.count(),
  };
  console.log("seeded:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
