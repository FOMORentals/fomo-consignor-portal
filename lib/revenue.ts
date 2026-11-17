/**
 * Consignor revenue per item per month, worked out the way Rentman's
 * "Report - Consignment (dont delete)" does. Pure functions: no Rentman calls here.
 *
 * Rules found by rebuilding Jan–Oct 2026 against the Consignment Tracker 2026 (17 Nov 2026):
 *  1. Only lines on subprojects whose status counts as confirmed (not Canceled, Pending,
 *     Concept or Inquiry). Option lines and groups left out of the price calculation earn nothing.
 *  2. Line value = quantity × unit_price × factor × (1 − line discount)
 *                  × (1 − subproject discount) × (1 − subproject rental discount).
 *  3. The value is spread over the line's PLAN period by elapsed time, and each month gets its
 *     share; month boundaries are midnight UK time (so the clock change matters).
 *  4. A "set" passes its value down to its contents, in proportion to each content line's
 *     unit_price × quantity (equally by quantity if none has a price). A content item that
 *     itself carries a Consigned code earns that share; untagged contents' share is FOMO's.
 *     Cases ("Kit - …" cases such as Kit - Canon C80) keep their own value.
 */

export type Line = {
  id: number;
  equipmentId: number;
  /** Consigned code of the equipment, "" if none. */
  code: string;
  equipmentType: "set" | "case" | "item";
  parentId: number | null;
  quantity: number;
  unitPrice: number;
  factor: number;
  discount: number;
  isOption: boolean;
  groupInPrice: boolean;
  planStart: string;
  planEnd: string;
  subproject: { statusName: string; discountSubproject: number; discountRental: number } | null;
};

export const EXCLUDED_STATUSES = new Set(["Canceled", "Pending", "Concept", "Inquiry"]);

const UK = "Europe/London";

export function lineValue(l: Line): number {
  const s = l.subproject;
  const sub = s ? (1 - s.discountSubproject) * (1 - s.discountRental) : 1;
  return l.quantity * l.unitPrice * l.factor * (1 - l.discount) * sub;
}

/** "YYYY-MM" of an instant, in UK time. */
export function ukMonth(t: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: UK, year: "numeric", month: "2-digit" }).formatToParts(t);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}

/** The instant of midnight UK time on the first of the month after `month` ("YYYY-MM"). */
function nextUkMonthStart(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  // Midnight UK is 00:00Z in winter and 23:00Z the day before in summer: try both.
  for (const guess of [Date.UTC(ny, nm - 1, 1, 0), Date.UTC(ny, nm - 1, 1, -1)]) {
    const d = new Date(guess);
    if (ukMonth(d) === `${ny}-${String(nm).padStart(2, "0")}` && ukMonth(new Date(guess - 1)) === month) return d;
  }
  throw new Error(`cannot find start of month after ${month}`);
}

/** Share of [start, end) falling in each UK month, by elapsed time. */
export function monthShares(start: string, end: string): Map<string, number> {
  const s = new Date(start);
  const e = new Date(end);
  const total = e.getTime() - s.getTime();
  const out = new Map<string, number>();
  if (!(total > 0)) {
    out.set(ukMonth(s), 1);
    return out;
  }
  let cur = s;
  while (cur < e) {
    const m = ukMonth(cur);
    const next = nextUkMonthStart(m);
    const stop = next < e ? next : e;
    out.set(m, (out.get(m) ?? 0) + (stop.getTime() - cur.getTime()) / total);
    cur = stop;
  }
  return out;
}

/**
 * Revenue per consigned equipment per month: Map key `${month}|${equipmentId}`.
 * `lines` must include the contents of every set line (tagged or not).
 */
export function consignorRevenue(lines: Line[]): Map<string, { month: string; equipmentId: number; code: string; revenue: number }> {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const children = new Map<number, Line[]>();
  for (const l of lines) {
    if (l.parentId == null) continue;
    const list = children.get(l.parentId) ?? [];
    list.push(l);
    children.set(l.parentId, list);
  }

  // Split a line's value down through sets; returns [line, share] for lines that keep value.
  function split(l: Line, value: number, out: Array<[Line, number]>) {
    const kids = l.equipmentType === "set" ? children.get(l.id) ?? [] : [];
    if (kids.length === 0) {
      out.push([l, value]);
      return;
    }
    let weights = kids.map((k) => k.unitPrice * k.quantity);
    if (weights.every((w) => w === 0)) weights = kids.map((k) => k.quantity);
    const total = weights.reduce((a, b) => a + b, 0);
    kids.forEach((k, i) => split(k, total ? (value * weights[i]) / total : 0, out));
  }

  const out = new Map<string, { month: string; equipmentId: number; code: string; revenue: number }>();
  for (const l of lines) {
    if (l.parentId != null && byId.has(l.parentId)) continue; // value comes from the parent line
    if (!l.subproject || EXCLUDED_STATUSES.has(l.subproject.statusName.trim())) continue;
    if (l.isOption || !l.groupInPrice) continue;
    const parts: Array<[Line, number]> = [];
    split(l, lineValue(l), parts);
    for (const [month, share] of monthShares(l.planStart, l.planEnd)) {
      for (const [owner, v] of parts) {
        const code = owner.code.trim().toUpperCase();
        if (!code || v === 0) continue;
        const key = `${month}|${owner.equipmentId}`;
        const row = out.get(key) ?? { month, equipmentId: owner.equipmentId, code, revenue: 0 };
        row.revenue += v * share;
        out.set(key, row);
      }
    }
  }
  return out;
}
