/**
 * What a consignor sees (spec §3), worked out from published months only. Pure, so it can be tested.
 * No job, customer or hire-date data: statements only hold item names and amounts.
 */
import type { Statement } from "./payout.ts";
import type { MonthRecord } from "./store.ts";

export type KitRow = { name: string; monthPence: number; yearPence: number; totalPence: number };

export type ConsignorView = {
  statements: Statement[]; // newest first
  latest: Statement | null;
  /** Net payout (before VAT): latest month, the latest month's calendar year, and since January 2026. */
  latestNet: number;
  yearNet: number;
  allNet: number;
  kit: KitRow[];
};

/** The consignor's share of an item's revenue in a statement, in pence. */
const itemShare = (s: Statement, pence: number) => Math.round(pence * s.share);

export function consignorView(months: MonthRecord[], accountId: string): ConsignorView {
  const statements = months
    .filter((m) => m.status === "published")
    .map((m) => m.statements.find((s) => s.accountId === accountId))
    .filter((s): s is Statement => !!s)
    .sort((a, b) => b.month.localeCompare(a.month));
  const latest = statements[0] ?? null;
  const year = latest?.month.slice(0, 4);
  const sum = (list: Statement[]) => list.reduce((a, s) => a + s.netPence, 0);

  // Keyed by name: tracker months (before the portal) have no Rentman ids, and identical items read as one line.
  const kit = new Map<string, KitRow>();
  for (const s of statements) {
    for (const i of s.items) {
      const row = kit.get(i.name) ?? { name: i.name, monthPence: 0, yearPence: 0, totalPence: 0 };
      const p = itemShare(s, i.pence);
      row.totalPence += p;
      if (s.month.slice(0, 4) === year) row.yearPence += p;
      if (s.month === latest?.month) row.monthPence += p;
      kit.set(i.name, row);
    }
  }
  return {
    statements,
    latest,
    latestNet: latest?.netPence ?? 0,
    yearNet: sum(statements.filter((s) => s.month.slice(0, 4) === year)),
    allNet: sum(statements),
    kit: [...kit.values()].sort((a, b) => b.yearPence - a.yearPence || a.name.localeCompare(b.name)),
  };
}
