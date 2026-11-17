/**
 * Safety checks Sam must tick off or explain before a month can be published (docs/SPEC.md §5.2).
 * Pure: give it the month's figures, get back the warnings.
 */
import type { Statement } from "./payout.ts";

export type Warning = {
  /** Stable id so a sign-off can be stored against it, e.g. "unknown-code:XYZ". */
  id: string;
  kind: "totals" | "unknown-code" | "idle-kit" | "big-swing";
  message: string;
};

export type ConsignedItem = { equipmentId: number; name: string; code: string; archived: boolean };

/** Codes on kit that are known not to be consignors (test records, cross-hires, units). */
export const NOT_CONSIGNOR_CODES = new Set(["TEST", "UNIT", "XHIRE"]);

const pounds = (p: number) => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * @param itemRevenue   pence earned this month by every item carrying a Consigned code (Rentman's total)
 * @param statements    this month's draft statements
 * @param previous      last month's statements, by account id
 * @param idleMonths    item ids with no revenue in each of the last 3 months (this one included)
 * @param knownCodes    codes some account owns (active or old); `oldCodes` are accounts that have left
 */
export function runChecks(input: {
  month: string;
  items: ConsignedItem[];
  itemRevenue: Map<number, number>;
  statements: Statement[];
  accountNames: Map<string, string>;
  previous: Map<string, Statement>;
  idleItemIds: Set<number>;
  knownCodes: Set<string>;
}): Warning[] {
  const out: Warning[] = [];
  const norm = (c: string) => c.trim().toUpperCase();

  // 1. Totals: everything Rentman says consigned kit earned should land on some statement.
  const rentmanTotal = [...input.itemRevenue.values()].reduce((a, b) => a + b, 0);
  const excluded = input.items.filter((i) => NOT_CONSIGNOR_CODES.has(norm(i.code))).reduce((a, i) => a + (input.itemRevenue.get(i.equipmentId) ?? 0), 0);
  const onStatements = input.statements.reduce((a, s) => a + s.revenuePence, 0);
  if (rentmanTotal - excluded !== onStatements) {
    out.push({
      id: "totals",
      kind: "totals",
      message: `Statements add up to ${pounds(onStatements)} of revenue, but Rentman has ${pounds(rentmanTotal - excluded)} for consigned kit this month.`,
    });
  }

  // 2. Kit tagged with a code no account owns (typo, lower case, or a new consignor not set up).
  const byCode = new Map<string, ConsignedItem[]>();
  for (const i of input.items) {
    const c = i.code.trim();
    if (NOT_CONSIGNOR_CODES.has(norm(c)) || input.knownCodes.has(c)) continue;
    byCode.set(c, [...(byCode.get(c) ?? []), i]);
  }
  for (const [code, items] of byCode) {
    const earned = items.reduce((a, i) => a + (input.itemRevenue.get(i.equipmentId) ?? 0), 0);
    const hint = input.knownCodes.has(norm(code)) ? ` (did you mean ${norm(code)}?)` : "";
    out.push({
      id: `unknown-code:${code}`,
      kind: "unknown-code",
      message: `${items.length} item${items.length === 1 ? "" : "s"} tagged "${code}"${hint} belong to no consignor, earning ${pounds(earned)} this month.`,
    });
  }

  // 3. Consignor kit (not archived) that has earned nothing for 3 months.
  for (const i of input.items) {
    if (i.archived || NOT_CONSIGNOR_CODES.has(norm(i.code)) || !input.idleItemIds.has(i.equipmentId)) continue;
    out.push({ id: `idle-kit:${i.equipmentId}`, kind: "idle-kit", message: `${i.name} (${i.code}) has earned nothing for 3 months.` });
  }

  // 4. Payout moved more than 50% from last month.
  for (const s of input.statements) {
    const prev = input.previous.get(s.accountId);
    if (!prev || prev.netPence <= 0) continue;
    const change = (s.netPence - prev.netPence) / prev.netPence;
    if (Math.abs(change) > 0.5) {
      out.push({
        id: `big-swing:${s.accountId}`,
        kind: "big-swing",
        message: `${input.accountNames.get(s.accountId) ?? s.accountId}: payout ${pounds(s.netPence)}, ${change > 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 100)}% on last month (${pounds(prev.netPence)}).`,
      });
    }
  }
  return out;
}
