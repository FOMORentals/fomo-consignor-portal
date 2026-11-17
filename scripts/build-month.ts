/**
 * Build (or refresh) a month's DRAFT in Firestore from a saved Rentman pull (scripts/rebuild-pull.ts output).
 * Makes no Rentman calls: call budget 0. The nightly job will do the same from a live read later.
 *
 * Keeps Sam's adjustments and sign-offs; refuses to touch a published month.
 *
 * Run on Jamie's Mac (gcloud application-default credentials):
 *   node scripts/build-month.ts data/rebuild-pull-<timestamp>.json 2026-10
 */
import { readFileSync } from "node:fs";
import { consignorRevenue, type Line } from "../lib/revenue.ts";
import { buildStatement, toPence, type ItemRevenue } from "../lib/payout.ts";
import { runChecks, type ConsignedItem } from "../lib/checks.ts";
import { MONTHS, db, listAccounts, getMonth, audit, type MonthRecord } from "../lib/store.ts";

type Row = Record<string, unknown> & { id: number };
const idOf = (link: unknown): number | null => (typeof link === "string" ? Number(link.split("/").pop()) || null : null);

function prevMonth(month: string, back = 1): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return d.toISOString().slice(0, 7);
}

export function linesFromPull(pull: { statuses: Row[]; equipment: Row[]; subprojects: Row[]; groups: Row[]; lines: Row[] }): Line[] {
  const status = new Map(pull.statuses.map((s) => [s.id, String(s.name)]));
  const equipment = new Map(pull.equipment.map((e) => [e.id, e]));
  const subs = new Map(pull.subprojects.map((s) => [s.id, s]));
  const groups = new Map(pull.groups.map((g) => [g.id, g]));
  return pull.lines.map((l) => {
    const eq = equipment.get(idOf(l.equipment) ?? -1);
    const group = groups.get(idOf(l.equipment_group) ?? -1);
    const sub = group ? subs.get(idOf(group.subproject) ?? -1) : undefined;
    return {
      id: l.id,
      equipmentId: idOf(l.equipment) ?? 0,
      code: String(eq?.consigned ?? ""),
      equipmentType: (eq?.type as Line["equipmentType"]) ?? "item",
      parentId: idOf(l.parent),
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unit_price) || 0,
      factor: Number(l.factor) || 0,
      discount: Number(l.discount) || 0,
      isOption: l.is_option === true,
      groupInPrice: group ? group.in_price_calculation !== false : true,
      planStart: String(l.planperiod_start),
      planEnd: String(l.planperiod_end),
      subproject: sub
        ? {
            statusName: status.get(idOf(sub.status) ?? -1) ?? "",
            discountSubproject: Number(sub.discount_subproject) || 0,
            discountRental: Number(sub.discount_rental) || 0,
          }
        : null,
    };
  });
}

async function main() {
  const [file, month] = process.argv.slice(2);
  if (!file || !/^\d{4}-\d{2}$/.test(month ?? "")) {
    console.error("Usage: node scripts/build-month.ts <pull.json> <YYYY-MM>");
    process.exit(1);
  }
  const existing = await getMonth(month);
  if (existing?.status === "published") {
    console.error(`${month} is published; its figures are fixed. Nothing changed.`);
    process.exit(2);
  }

  const pull = JSON.parse(readFileSync(file, "utf8"));
  if (!pull.subprojects.some((s: Row) => "discount_subproject" in s)) {
    console.error("This pull has no subproject discounts (made before 17 Nov). Run npm run rebuild:pull again.");
    process.exit(1);
  }
  const revenue = consignorRevenue(linesFromPull(pull));
  const equipment = new Map<number, Row>(pull.equipment.map((e: Row) => [e.id, e]));
  const accounts = (await listAccounts()).filter((a) => a.active);

  const pence = (m: string) => {
    const out = new Map<number, number>();
    for (const r of revenue.values()) if (r.month === m) out.set(r.equipmentId, (out.get(r.equipmentId) ?? 0) + toPence(r.revenue));
    return out;
  };
  const itemRevenue = pence(month);
  const quiet = [pence(prevMonth(month, 1)), pence(prevMonth(month, 2))];

  const items: ConsignedItem[] = pull.equipment.map((e: Row) => ({
    equipmentId: e.id,
    name: String(e.name),
    code: String(e.consigned),
    archived: e.in_archive === true,
  }));
  const owner = new Map<string, string>();
  for (const a of accounts) for (const c of a.codes) owner.set(c, a.id);
  // Manual accounts' kit earns them nothing automatically (Sam enters the agreed amount), so leave it out of the checks.
  const manualCodes = new Set(accounts.filter((a) => a.manual).flatMap((a) => a.codes));
  const checkedItems = items.filter((i) => !manualCodes.has(i.code.trim()));
  const checkedRevenue = new Map([...itemRevenue].filter(([id]) => !manualCodes.has(String(equipment.get(id)?.consigned ?? "").trim())));

  const adjustments = existing?.adjustments ?? {};
  const statements = accounts.map((a) => {
    const mine: ItemRevenue[] = [];
    for (const [id, p] of itemRevenue) {
      const code = String(equipment.get(id)?.consigned ?? "").trim();
      if (!a.manual && owner.get(code) === a.id && p !== 0) mine.push({ equipmentId: id, name: String(equipment.get(id)?.name), pence: p });
    }
    return buildStatement(a, month, mine, adjustments[a.id] ?? []);
  });

  const previousDoc = await getMonth(prevMonth(month));
  const knownCodes = new Set((await listAccounts()).flatMap((a) => [...a.codes, ...(a.oldCodes ?? [])]));
  const warnings = runChecks({
    month,
    items: checkedItems,
    itemRevenue: checkedRevenue,
    statements,
    accountNames: new Map(accounts.map((a) => [a.id, a.name])),
    previous: new Map((previousDoc?.statements ?? []).map((s) => [s.accountId, s])),
    idleItemIds: new Set(checkedItems.filter((i) => !itemRevenue.get(i.equipmentId) && !quiet[0].get(i.equipmentId) && !quiet[1].get(i.equipmentId)).map((i) => i.equipmentId)),
    knownCodes,
  });

  const record: MonthRecord = {
    month,
    status: "draft",
    builtAt: String(pull.startedAt),
    rentmanTotalPence: [...itemRevenue.values()].reduce((a, b) => a + b, 0),
    statements,
    warnings,
    signOffs: existing?.signOffs ?? {},
    adjustments,
  };
  await db().collection(MONTHS).doc(month).set(record);
  await audit("scripts/build-month", existing ? "month refreshed" : "month drafted", { month, pull: file, warnings: warnings.length });
  const net = statements.reduce((a, s) => a + s.netPence, 0);
  console.log(`${month}: ${statements.length} statements, net £${(net / 100).toFixed(2)}, ${warnings.length} warnings. Saved as a draft.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("build-month FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
