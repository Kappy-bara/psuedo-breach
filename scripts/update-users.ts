/**
 * Bulk-update participant accounts from a CSV file.
 *
 * Usage:
 *   npm run update-users -- --file data.csv
 *
 * The CSV must have a `registerId` column.
 * Other optional columns: `name`, `branch`, `year`, `role`.
 * (Note: Does not support commas inside values unless quotes are handled properly, but basic quotes are stripped).
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const file = arg("file");
  if (!file) {
    console.error("--file <csv_path> is required");
    process.exit(1);
  }

  const lines = readFileSync(file, "utf8").trim().split(/\r?\n/);
  if (lines.length < 2) {
    console.error("CSV must have a header row and at least one data row.");
    process.exit(1);
  }

  const header = lines[0]!.toLowerCase().split(",").map((s) => s.trim());
  const iRegId = header.indexOf("registerid");

  if (iRegId < 0) {
    console.error("CSV must contain a 'registerId' column.");
    process.exit(1);
  }

  const iName = header.indexOf("name");
  const iBranch = header.indexOf("branch");
  const iYear = header.indexOf("year");
  const iRole = header.indexOf("role");

  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    // Simple CSV split: splits on comma and removes any surrounding quotes.
    const c = l.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));

    const registerId = c[iRegId];
    if (!registerId) continue;

    // Build the data object with only the fields provided in the CSV
    const dataToUpdate: Record<string, string> = {};

    if (iName >= 0 && c[iName] !== undefined) dataToUpdate.displayName = c[iName];
    if (iBranch >= 0 && c[iBranch] !== undefined) dataToUpdate.branch = c[iBranch];
    if (iYear >= 0 && c[iYear] !== undefined) dataToUpdate.year = c[iYear];
    if (iRole >= 0 && c[iRole] !== undefined) dataToUpdate.role = c[iRole];

    if (Object.keys(dataToUpdate).length === 0) {
      continue; // Nothing to update for this user
    }

    try {
      await prisma.user.update({
        where: { registerId },
        data: dataToUpdate,
      });
      console.log(`Updated user: ${registerId}`);
      updatedCount++;
    } catch (e: any) {
      if (e.code === 'P2025') {
        console.warn(`Skipped ${registerId}: User not found in database.`);
      } else {
        console.warn(`Failed to update ${registerId}:`, e.message);
      }
      skippedCount++;
    }
  }

  console.log(`\nDone. Updated ${updatedCount} users. Skipped/Failed: ${skippedCount}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
