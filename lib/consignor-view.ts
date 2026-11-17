/**
 * What a consignor sees (spec §3), worked out from published months only. Pure, so it can be tested.
 * No job, customer or hire-date data: statements only hold item names and amounts.
 */
import type { Statement } from "./payout.ts";
import type { MonthRecord } from "./store.ts";

/** One item's share per month (pence, keyed YYYY-MM), plus the latest month, the latest year and all time. */
export type KitRow = { name: string; byMonth: Record<string, number>; monthPence: number; yearPence: number; totalPence: number };

export type ConsignorView = {
  statements: Statement[]; // newest first
  latest: Statement | null;
  /** Months with a published statement, newest first (the My kit columns). */
  months: string[];
  /** The first month with a statement ("since" in the totals), or null. */
  firstMonth: string | null;
  /** Net payout (before VAT): latest month, the latest month's calendar year, and all published months. */
  latestNet: number;
  yearNet: number;
  allNet: number;
  kit: KitRow[];
};

/**
 * The name an item is grouped under. Older tracker rows sometimes carry the consignor code in front
 * ("CC - Leica M11" vs "Leica M11"), so a leading code of 2-4 capitals and " - " is dropped.
 */
export function kitName(name: string): string {
  return name.replace(/^[A-Z]{2,4}\s+-\s+/, "").trim();
}

/**
 * What an item is matched on, so a renamed item stays one row: Rentman renames like
 * "Leica 135mm Elmarit R Series f/2.8 Lens (Leica R Mount)" -> "Leica 135mm Elmarit R Series F2.8".
 * Ignores case, anything in brackets, the word "lens", slashes and spacing. Shown under its newest name.
 */
export function kitKey(name: string): string {
  return kitName(name)
    .toLowerCase()
    .replace(/\([^)]*\)?/g, " ")
    .replace(/\.{3}|…/g, " ")
    .replace(/\blens(es)?\b/g, " ")
    .replace(/\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

  // Keyed by name (tracker months have no Rentman ids). Statements run newest first, so a row keeps its newest name.
  const kit = new Map<string, KitRow>();
  for (const s of statements) {
    for (const i of s.items) {
      const key = kitKey(i.name);
      const row = kit.get(key) ?? { name: kitName(i.name), byMonth: {}, monthPence: 0, yearPence: 0, totalPence: 0 };
      const p = itemShare(s, i.pence);
      row.byMonth[s.month] = (row.byMonth[s.month] ?? 0) + p;
      row.totalPence += p;
      if (s.month.slice(0, 4) === year) row.yearPence += p;
      if (s.month === latest?.month) row.monthPence += p;
      kit.set(key, row);
    }
  }
  return {
    statements,
    latest,
    months: statements.map((s) => s.month),
    firstMonth: statements.at(-1)?.month ?? null,
    latestNet: latest?.netPence ?? 0,
    yearNet: sum(statements.filter((s) => s.month.slice(0, 4) === year)),
    allNet: sum(statements),
    kit: [...kit.values()].sort((a, b) => b.totalPence - a.totalPence || a.name.localeCompare(b.name)),
  };
}
