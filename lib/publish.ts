/**
 * Publish (spec §5.4), the pure part: freeze a month once every check is cleared, and plan its Xero draft bills.
 * lib/publish-run.ts does the Firestore and Xero work around these.
 */
import { billDates, selfBillingNumber, type Account, type Statement } from "./payout.ts";
import type { BillResult, MonthRecord, Party } from "./store.ts";
import { EditRefused, openWarnings } from "./month-edits.ts";
import { monthName } from "./format.ts";
import type { DraftBill } from "./xero.ts";

/** Statements that need the consignor's Xero details: anything with money on it. */
export const needsParty = (s: Statement) => s.items.length > 0 || s.adjustments.length > 0 || s.totalPence !== 0;

export function publishMonth(record: MonthRecord, by: string, at: string, fomo: Party, parties: Record<string, Party>): MonthRecord {
  if (record.status !== "draft") throw new EditRefused("This month is already published.");
  const open = openWarnings(record);
  if (open.length) throw new EditRefused(`${open.length} check${open.length === 1 ? "" : "s"} still to clear before publishing.`);
  const missing = record.statements.filter((s) => needsParty(s) && !parties[s.accountId]).map((s) => s.accountId);
  if (missing.length) throw new EditRefused(`No Xero details for ${missing.join(", ")}.`);
  return { ...record, status: "published", publishedBy: by, publishedAt: at, fomo, parties, bills: record.bills ?? {} };
}

export type PlannedBill = { accountId: string; number: string; bill: Omit<DraftBill, "contactId"> | null; skip?: string };

/** One line per statement: the draft bill to make, or why there isn't one. */
export function planBills(record: MonthRecord, accounts: Map<string, Pick<Account, "codes" | "vat">>): PlannedBill[] {
  const { invoiceDate, dueDate } = billDates(record.month);
  return record.statements.map((s) => {
    const account = accounts.get(s.accountId);
    if (!account) return { accountId: s.accountId, number: "", bill: null, skip: "Consignor account not found." };
    const number = selfBillingNumber(account, record.month);
    if (s.netPence === 0) return { accountId: s.accountId, number, bill: null, skip: "Nothing to pay this month." };
    if (s.netPence < 0) return { accountId: s.accountId, number, bill: null, skip: "Owes FOMO this month: no bill." };
    return {
      accountId: s.accountId,
      number,
      bill: { number, date: invoiceDate, dueDate, description: `${monthName(record.month)} consignments (${number})`, netPence: s.netPence, vat: account.vat },
    };
  });
}

/** Bills still to make: never seen, or failed last time. Created and skipped ones are left alone. */
export const billsToMake = (plan: PlannedBill[], done: Record<string, BillResult> | undefined) =>
  plan.filter((p) => !done?.[p.accountId] || done[p.accountId].state === "failed");
