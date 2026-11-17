/**
 * Load months paid before the portal from the Consignment Tracker 2026, as they were paid (lib/history.ts).
 * No Rentman calls (call budget 0), no Xero writes. Prints what it would do unless --write is given.
 *
 * Input: data/tracker-history.json (booking data, git-ignored) = { "2026-01": { rows: TrackerRow[], items: TrackerItem[] }, ... }
 * Never overwrites a month the portal built itself; re-running replaces only earlier history.
 *
 * Run on Jamie's Mac:  node scripts/import-history.ts data/tracker-history.json 2026-01..2026-09 [--write]
 */
import { readFileSync } from "node:fs";
import { historyMonth, type TrackerItem, type TrackerRow } from "../lib/history.ts";
import { MONTHS, audit, db, getMonth, listAccounts } from "../lib/store.ts";

function monthRange(spec: string): string[] {
  const [from, to = from] = spec.split("..");
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) throw new Error(`"${spec}" should look like 2026-01..2026-09`);
  const out: string[] = [];
  for (let [y, m] = from.split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= to; m === 12 ? ((m = 1), y++) : m++) out.push(`${y}-${String(m).padStart(2, "0")}`);
  return out;
}

async function main() {
  const [file, range, flag] = process.argv.slice(2);
  if (!file || !range) {
    console.error("Usage: node scripts/import-history.ts <tracker-history.json> <YYYY-MM..YYYY-MM> [--write]");
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, { rows: TrackerRow[]; items: TrackerItem[] }>;
  const accounts = await listAccounts();
  const at = new Date().toISOString();
  let written = 0;
  for (const month of monthRange(range)) {
    if (!data[month]) {
      console.log(`  ${month}: not in the file, skipped`);
      continue;
    }
    const existing = await getMonth(month);
    if (existing && !existing.history) {
      console.log(`  ${month}: the portal already has this month (${existing.status}), left alone`);
      continue;
    }
    const { record, unmatched } = historyMonth(month, data[month].rows, data[month].items, accounts, at);
    const total = record.statements.reduce((a, s) => a + s.totalPence, 0);
    console.log(`  ${month}: ${record.statements.length} statements, total paid £${(total / 100).toFixed(2)}${unmatched.length ? `; no account for ${unmatched.join(", ")}` : ""}`);
    if (flag === "--write") {
      await db().collection(MONTHS).doc(month).set(record);
      written++;
    }
  }
  if (flag === "--write") await audit("scripts/import-history", "history loaded", { file, range, written });
  console.log(flag === "--write" ? `Wrote ${written} months.` : "Dry run: nothing written. Add --write to save.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("import-history FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
