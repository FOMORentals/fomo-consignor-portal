/**
 * Months paid before the portal (Consignment Tracker 2026), loaded as consignors were actually paid, not as
 * Rentman works them out today (spec §3: statements from January 2026; 9 consignor-months differ, see memory).
 * Pure: give it the tracker's row for a consignor and month, get back the statement.
 */
import { VAT_RATES, toPence, type Account, type Adjustment, type Statement } from "./payout.ts";
import type { MonthRecord } from "./store.ts";

/** One consignor's line on a tracker month tab, in pounds as the sheet holds them. */
export type TrackerRow = { code: string; revenue: number; split: number; debt: number | null; net: number; total: number };
export type TrackerItem = { name: string; revenue: number; code: string };

export const HISTORY_BY = "Consignment Tracker 2026";
export const OTHER_REVENUE = "Other revenue agreed with FOMO";

const tidyName = (n: string) => n.replace(/^Kit\s*-\s*/i, "").trim();

export function historyStatement(account: Account, month: string, row: TrackerRow, items: TrackerItem[]): Statement {
  const revenuePence = toPence(row.revenue);
  const grossPence = toPence(row.revenue * row.split);
  const netPence = toPence(row.net);
  const totalPence = toPence(row.total);
  const adjustments: Adjustment[] = [];
  if (row.debt) adjustments.push({ pence: toPence(row.debt), reason: "Outstanding debt", by: HISTORY_BY, at: month });
  const rest = netPence - grossPence - adjustments.reduce((a, x) => a + x.pence, 0);
  if (rest) adjustments.push({ pence: rest, reason: "Adjustment", by: HISTORY_BY, at: month });
  const codes = new Set(account.codes.map((c) => c.toUpperCase()));
  const lines = items
    .filter((i) => codes.has(i.code.trim().toUpperCase()) && toPence(i.revenue) !== 0)
    .map((i, n) => ({ equipmentId: -(n + 1), name: tidyName(i.name), pence: toPence(i.revenue) }));
  // Agreed flat amounts (Apollo, F&M) and hand edits in the sheet aren't per item: one line keeps the statement adding up.
  const other = revenuePence - lines.reduce((a, i) => a + i.pence, 0);
  if (other) lines.push({ equipmentId: 0, name: OTHER_REVENUE, pence: other });
  return {
    accountId: account.id,
    month,
    items: lines.sort((a, b) => b.pence - a.pence || a.name.localeCompare(b.name)),
    revenuePence,
    share: row.split,
    grossPence,
    adjustments,
    netPence,
    vatRate: VAT_RATES[account.vat],
    vatPence: totalPence - netPence,
    totalPence,
    method: account.method,
  };
}

/** The whole month, published, marked as history. Accounts are matched by code; unmatched codes come back to report. */
export function historyMonth(
  month: string,
  rows: TrackerRow[],
  items: TrackerItem[],
  accounts: (Account & { oldCodes?: string[] })[],
  at: string,
): { record: MonthRecord; unmatched: string[] } {
  const byCode = new Map<string, Account>();
  for (const a of accounts) for (const c of a.codes) byCode.set(c.toUpperCase(), a);
  const unmatched: string[] = [];
  const statements: Statement[] = [];
  for (const r of rows) {
    const a = byCode.get(r.code.trim().toUpperCase());
    if (!a) {
      if (toPence(r.total) !== 0) unmatched.push(r.code);
      continue;
    }
    statements.push(historyStatement(a, month, r, items));
  }
  return {
    unmatched,
    record: {
      month,
      status: "published",
      history: true,
      builtAt: at,
      rentmanTotalPence: statements.reduce((a, s) => a + s.revenuePence, 0),
      statements,
      warnings: [],
      signOffs: {},
      adjustments: {},
      publishedBy: HISTORY_BY,
      publishedAt: at,
    },
  };
}
