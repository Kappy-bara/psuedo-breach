/**
 * Bulk-create participant accounts and write a distributable CSV.
 *
 *   npm run accounts -- --count 120 --event pseudo-breach-main
 *   npm run accounts -- --roster people.csv --event pseudo-breach-main
 *
 * --count N            create N generic accounts (PB-XXXX-01 …)
 * --roster file.csv    create one account per row; columns: name,branch,year
 * --event slug         which event to attach them to (required)
 * --prefix PB          register-id prefix (default PB)
 * --out accounts.csv   output path (default accounts.csv)
 *
 * Re-runnable: existing register IDs are skipped, not overwritten.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const WORDS = "atlas,delta,ember,flux,ghost,hydra,ion,jinx,kilo,lynx,mono,nova,onyx,pulse,quartz,rune,sigil,tango,umbra,vault,wisp,xenon,yara,zephyr".split(",");
function password(): string {
  return `${WORDS[randomInt(WORDS.length)]}-${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 9999)}`;
}
function code4(): string {
  return String(randomInt(1000, 9999));
}

async function main() {
  const eventSlug = arg("event");
  if (!eventSlug) {
    console.error("--event <slug> is required");
    process.exit(1);
  }
  const event = await prisma.event.findUnique({ where: { slug: eventSlug } });
  if (!event) {
    console.error(`no event with slug "${eventSlug}"`);
    process.exit(1);
  }

  const prefix = arg("prefix", "PB")!;
  const out = arg("out", "accounts.csv")!;
  const roster = arg("roster");
  const count = arg("count") ? Number(arg("count")) : undefined;

  type Row = { name: string; branch: string; year: string };
  let rows: Row[] = [];

  if (roster) {
    const lines = readFileSync(roster, "utf8").trim().split(/\r?\n/);
    const header = lines[0]!.toLowerCase().split(",").map((s) => s.trim());
    const iName = header.indexOf("name");
    const iBranch = header.indexOf("branch");
    const iYear = header.indexOf("year");
    rows = lines.slice(1).map((l) => {
      const c = l.split(",").map((s) => s.trim());
      return {
        name: c[iName] ?? "Operator",
        branch: iBranch >= 0 ? (c[iBranch] ?? "") : "",
        year: iYear >= 0 ? (c[iYear] ?? "") : "",
      };
    });
  } else if (count) {
    rows = Array.from({ length: count }, (_, i) => ({
      name: `Operator ${String(i + 1).padStart(3, "0")}`,
      branch: "",
      year: "",
    }));
  } else {
    console.error("pass --count N or --roster file.csv");
    process.exit(1);
  }

  const existing = new Set(
    (await prisma.user.findMany({ select: { registerId: true } })).map((u) => u.registerId),
  );

  const created: { registerId: string; password: string; name: string }[] = [];
  let n = 1;
  for (const r of rows) {
    let registerId = "";
    do {
      registerId = `${prefix}-${code4()}-${String(n).padStart(2, "0")}`;
    } while (existing.has(registerId));
    existing.add(registerId);
    n++;

    const pw = password();
    await prisma.user.create({
      data: {
        registerId,
        displayName: r.name,
        branch: r.branch,
        year: r.year,
        role: "participant",
        eventId: event.id,
        passwordHash: await bcrypt.hash(pw, 10),
      },
    });
    created.push({ registerId, password: pw, name: r.name });
  }

  const csv = [
    "registerId,password,name,branch,year,event",
    ...created.map(
      (c, i) =>
        `${c.registerId},${c.password},"${c.name}",${rows[i]!.branch},${rows[i]!.year},${eventSlug}`,
    ),
  ].join("\n");
  writeFileSync(out, csv + "\n");

  console.log(`created ${created.length} accounts for "${eventSlug}" → ${out}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
