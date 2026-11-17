/**
 * Create the consignor accounts in Firestore from a CSV (made from the Consignment Tracker 2026 Summary and
 * October tabs; it holds emails, so it lives in data/, which git ignores). No Rentman calls.
 *
 * Only adds accounts that don't exist yet: an account already in Firestore is left exactly as it is, so Sam's
 * changes are never overwritten. Prints what it would do unless --write is given.
 *
 * CSV columns: id,name,xeroContact,codes,loginEmails,share,vat,method,manual
 *   codes and loginEmails separated by "|"; vat "20% (VAT on Expenses)" or "NO VAT";
 *   method self_billing | own_invoice | rentman_credit; manual true for Apollo and F&M Media.
 *
 * Run on Jamie's Mac:  node scripts/seed-accounts.ts data/consignor-accounts.csv [--write]
 */
import { readFileSync } from "node:fs";
import { ACCOUNTS, audit, db, type AccountRecord } from "../lib/store.ts";
import { VAT_RATES, type PaymentMethod, type VatSetting } from "../lib/payout.ts";

const METHODS = new Set<PaymentMethod>(["self_billing", "own_invoice", "rentman_credit"]);

export function parseAccounts(csv: string, seededAt: string): AccountRecord[] {
  const [header, ...rows] = csv.trim().split(/\r?\n/).map((r) => r.split(",").map((c) => c.trim()));
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`CSV has no "${name}" column`);
    return i;
  };
  return rows.map((r, n) => {
    const get = (name: string) => r[col(name)] ?? "";
    const vat = get("vat") as VatSetting;
    const method = get("method") as PaymentMethod;
    const share = Number(get("share"));
    if (!(vat in VAT_RATES)) throw new Error(`row ${n + 2}: VAT "${vat}" is not one of ${Object.keys(VAT_RATES).join(" / ")}`);
    if (!METHODS.has(method)) throw new Error(`row ${n + 2}: method "${method}"`);
    if (!(share >= 0 && share <= 1)) throw new Error(`row ${n + 2}: share ${get("share")} should be between 0 and 1`);
    return {
      id: get("id"),
      name: get("name"),
      xeroContact: get("xeroContact"),
      codes: get("codes").split("|").filter(Boolean),
      loginEmails: get("loginEmails").split("|").map((e) => e.toLowerCase()).filter(Boolean),
      rates: [{ from: "2026-01", share, by: "Consignment Tracker 2026", at: seededAt }],
      vat,
      method,
      active: true,
      manual: get("manual") === "true",
    };
  });
}

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.error("Usage: node scripts/seed-accounts.ts <accounts.csv> [--write]");
    process.exit(1);
  }
  const accounts = parseAccounts(readFileSync(file, "utf8"), new Date().toISOString());
  const col = db().collection(ACCOUNTS);
  let added = 0;
  for (const a of accounts) {
    const ref = col.doc(a.id);
    if ((await ref.get()).exists) {
      console.log(`  keep  ${a.id} (already there)`);
      continue;
    }
    console.log(`  add   ${a.id}: ${a.name}, ${a.codes.join("/")}, ${a.rates[0].share * 100}%, ${a.vat}, ${a.method}${a.manual ? ", manual" : ""}`);
    if (flag === "--write") {
      await ref.create(a);
      added++;
    }
  }
  if (flag === "--write") await audit("scripts/seed-accounts", "accounts seeded", { file, added });
  console.log(flag === "--write" ? `Added ${added} accounts.` : "Dry run: nothing written. Add --write to save.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("seed-accounts FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
