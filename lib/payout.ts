/**
 * A consignor's monthly statement, from their items' revenue (lib/revenue.ts) and their account settings.
 * Pure: no database or Rentman calls. Spec: docs/SPEC.md §4.
 *
 * Money is held in pence (integers) so totals always add up on the statement and in Xero.
 */

export type VatSetting = "20% (VAT on Expenses)" | "NO VAT";
export type PaymentMethod = "self_billing" | "own_invoice" | "rentman_credit";

/** A share that applies from a month onwards ("YYYY-MM"). Earlier months are untouched by later changes. */
export type RateChange = { from: string; share: number; by: string; at: string };

export type Account = {
  id: string;
  name: string;
  /** Rentman Consigned codes this account owns, e.g. ["JM"]. */
  codes: string[];
  rates: RateChange[];
  vat: VatSetting;
  method: PaymentMethod;
};

/** Sam's lines at sign-off: a deduction (money owed to FOMO) is negative, a manual credit positive. */
export type Adjustment = { pence: number; reason: string; by: string; at: string };

export type ItemRevenue = { equipmentId: number; name: string; pence: number };

export type Statement = {
  accountId: string;
  month: string;
  items: ItemRevenue[];
  revenuePence: number;
  share: number;
  grossPence: number;
  adjustments: Adjustment[];
  netPence: number;
  vatRate: number;
  vatPence: number;
  totalPence: number;
  method: PaymentMethod;
};

export const VAT_RATES: Record<VatSetting, number> = { "20% (VAT on Expenses)": 0.2, "NO VAT": 0 };

export const DEFAULT_SHARE = 0.5;

/** Pounds to pence, rounding half away from zero (as a sheet's ROUND does). */
export function toPence(pounds: number): number {
  const p = Math.round(Math.abs(pounds) * 100 + 1e-9);
  return pounds < 0 ? -p : p;
}

export function shareFor(account: Pick<Account, "rates">, month: string): number {
  const applicable = account.rates.filter((r) => r.from <= month).sort((a, b) => a.from.localeCompare(b.from) || a.at.localeCompare(b.at));
  return applicable.length ? applicable[applicable.length - 1].share : DEFAULT_SHARE;
}

export function buildStatement(account: Account, month: string, items: ItemRevenue[], adjustments: Adjustment[] = []): Statement {
  const revenuePence = items.reduce((a, i) => a + i.pence, 0);
  const share = shareFor(account, month);
  const grossPence = toPence((revenuePence * share) / 100);
  const netPence = grossPence + adjustments.reduce((a, x) => a + x.pence, 0);
  const vatRate = VAT_RATES[account.vat];
  const vatPence = toPence((netPence * vatRate) / 100);
  return {
    accountId: account.id,
    month,
    items: [...items].sort((a, b) => b.pence - a.pence || a.name.localeCompare(b.name)),
    revenuePence,
    share,
    grossPence,
    adjustments,
    netPence,
    vatRate,
    vatPence,
    totalPence: netPence + vatPence,
    method: account.method,
  };
}

/** Self-billing invoice number that never repeats for an account and month, e.g. CONS-JM-2026-10. */
export function selfBillingNumber(account: Pick<Account, "codes">, month: string): string {
  return `CONS-${account.codes[0]}-${month}`;
}

/** Due at the end of the month after the statement month is billed (as the tracker's Xero import does). */
export function billDates(month: string): { invoiceDate: string; dueDate: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { invoiceDate: lastDay(y, m), dueDate: lastDay(ny, nm) };
}
