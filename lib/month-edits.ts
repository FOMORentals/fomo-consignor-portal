/**
 * Sam's changes to a draft month, as pure functions on the month record (spec §4–5). The server actions in
 * app/admin/months/[month]/actions.ts load the record, apply one of these in a transaction and save it.
 */
import { buildStatement, type Account, type Adjustment } from "./payout.ts";
import type { MonthRecord } from "./store.ts";

export class EditRefused extends Error {}

function draft(record: MonthRecord): void {
  if (record.status !== "draft") throw new EditRefused("This month is published: its figures are fixed.");
}

/** "£-12.50", "-12.5", "100" -> pence. Throws on anything else. */
export function parsePounds(input: string): number {
  const clean = input.replace(/[£,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) throw new EditRefused(`"${input}" isn't an amount in pounds, e.g. -120.00 or 75.`);
  const [whole, frac = ""] = clean.replace("-", "").split(".");
  const pence = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return clean.startsWith("-") ? -pence : pence;
}

function restate(record: MonthRecord, account: Account): MonthRecord {
  const adjustments = record.adjustments[account.id] ?? [];
  const old = record.statements.find((s) => s.accountId === account.id);
  const statement = buildStatement(account, record.month, old?.items ?? [], adjustments);
  const statements = old ? record.statements.map((s) => (s.accountId === account.id ? statement : s)) : [...record.statements, statement];
  return { ...record, statements };
}

export function addAdjustment(record: MonthRecord, account: Account, adjustment: Adjustment): MonthRecord {
  draft(record);
  if (adjustment.pence === 0) throw new EditRefused("An adjustment of £0 changes nothing.");
  if (!adjustment.reason.trim()) throw new EditRefused("Give a reason: the consignor sees it on their statement.");
  const list = [...(record.adjustments[account.id] ?? []), { ...adjustment, reason: adjustment.reason.trim() }];
  return restate({ ...record, adjustments: { ...record.adjustments, [account.id]: list } }, account);
}

export function removeAdjustment(record: MonthRecord, account: Account, index: number): MonthRecord {
  draft(record);
  const list = [...(record.adjustments[account.id] ?? [])];
  if (!(index >= 0 && index < list.length)) throw new EditRefused("That adjustment has already gone.");
  list.splice(index, 1);
  return restate({ ...record, adjustments: { ...record.adjustments, [account.id]: list } }, account);
}

export function signOffWarning(record: MonthRecord, warningId: string, by: string, at: string, note: string): MonthRecord {
  draft(record);
  if (!record.warnings.some((w) => w.id === warningId)) throw new EditRefused("That check is no longer showing.");
  if (!note.trim()) throw new EditRefused("Say why it's OK: it's kept with the month.");
  return { ...record, signOffs: { ...record.signOffs, [warningId]: { by, at, note: note.trim() } } };
}

/** Checks still to clear before Publish. */
export const openWarnings = (record: MonthRecord) => record.warnings.filter((w) => !record.signOffs[w.id]);
