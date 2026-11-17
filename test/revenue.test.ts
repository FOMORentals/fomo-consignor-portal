import { test } from "node:test";
import assert from "node:assert/strict";
import { consignorRevenue, lineValue, monthShares, type Line } from "../lib/revenue.ts";

const sub = (statusName = "Execution done", discountSubproject = 0) => ({ statusName, discountSubproject, discountRental: 0 });
const line = (p: Partial<Line> & Pick<Line, "id">): Line => ({
  equipmentId: 1,
  code: "JM",
  equipmentType: "case",
  parentId: null,
  quantity: 1,
  unitPrice: 100,
  factor: 1,
  discount: 0,
  isOption: false,
  groupInPrice: true,
  planStart: "2026-10-05T09:00:00+01:00",
  planEnd: "2026-10-06T17:00:00+01:00",
  subproject: sub(),
  ...p,
});
const rev = (lines: Line[], key: string) => Math.round((consignorRevenue(lines).get(key)?.revenue ?? 0) * 100) / 100;

test("line value applies line and subproject discounts", () => {
  // Ronin 4D 6K, Oct 2026: £365, subproject discount 55% -> £164.25 in the report
  const pence = (n: number) => Math.round(n * 100) / 100;
  assert.equal(pence(lineValue(line({ id: 1, unitPrice: 365, subproject: sub("Execution done", 0.55) }))), 164.25);
  assert.equal(pence(lineValue(line({ id: 1, unitPrice: 130, factor: 2, discount: 0.3 }))), 182);
});

test("value is spread over the plan period by elapsed time, months in UK time", () => {
  // 27 Mar 13:00 GMT -> 2 Apr 11:00 BST is 141 real hours; 106 of them are in March (clock change on 29 Mar)
  const s = monthShares("2026-03-27T13:00:00+00:00", "2026-04-02T11:00:00+01:00");
  assert.equal(Math.round(s.get("2026-03")! * 141), 106);
  assert.equal(Math.round(s.get("2026-04")! * 141), 35);
  // Canon FD Lens Set, March 2026: £286.89 line -> £215.68 in the March report
  assert.equal(Math.round(286.89 * s.get("2026-03")! * 100) / 100, 215.68);
});

test("cancelled, pending, option and not-in-price lines earn nothing", () => {
  const lines = [
    line({ id: 1, subproject: sub("Canceled") }),
    line({ id: 2, subproject: sub("Pending") }),
    line({ id: 3, isOption: true }),
    line({ id: 4, groupInPrice: false }),
  ];
  assert.equal(consignorRevenue(lines).size, 0);
});

test("a set passes its value to its contents by their prices; untagged contents' share is not consignor revenue", () => {
  // Kit - Prosup Tango Slider and Manfrotto (set, £120): slider £100 (JM), tripod £20 (untagged)
  const lines = [
    line({ id: 10, equipmentId: 100, equipmentType: "set", unitPrice: 120 }),
    line({ id: 11, equipmentId: 101, parentId: 10, unitPrice: 100, factor: 0 }),
    line({ id: 12, equipmentId: 102, parentId: 10, code: "", unitPrice: 20, factor: 0 }),
  ];
  assert.equal(rev(lines, "2026-10|101"), 100);
  assert.equal(rev(lines, "2026-10|100"), 0);
  assert.equal(consignorRevenue(lines).has("2026-10|102"), false);
});

test("a set whose contents have no prices splits equally by quantity", () => {
  // Kit - Cooke SP3 Lens Set (E), £600: six lenses (qty 1) and an E mount (qty 6) -> £50 a unit
  const lines = [line({ id: 20, equipmentId: 200, code: "CON", equipmentType: "set", unitPrice: 600 })];
  for (let i = 0; i < 6; i++) lines.push(line({ id: 21 + i, equipmentId: 201 + i, code: "CON", parentId: 20, unitPrice: 0, factor: 0 }));
  lines.push(line({ id: 30, equipmentId: 300, code: "CON", parentId: 20, quantity: 6, unitPrice: 0, factor: 0 }));
  assert.equal(rev(lines, "2026-10|201"), 50);
  assert.equal(rev(lines, "2026-10|300"), 300);
});

test("a case keeps its own value", () => {
  // Kit - Canon C80 is a case: contents stay blank and the kit earns the line value
  const lines = [
    line({ id: 40, equipmentId: 9830, unitPrice: 130, discount: 0.3 }),
    line({ id: 41, equipmentId: 9831, parentId: 40, code: "", unitPrice: 10, factor: 0 }),
  ];
  assert.equal(rev(lines, "2026-10|9830"), 91);
});
