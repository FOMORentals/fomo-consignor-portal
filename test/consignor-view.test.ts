import { test } from "node:test";
import assert from "node:assert/strict";
import { consignorView } from "../lib/consignor-view.ts";
import { buildStatement, type Account } from "../lib/payout.ts";
import type { MonthRecord } from "../lib/store.ts";

const jm: Account = { id: "fkf", name: "FKF", codes: ["JM"], rates: [], vat: "20% (VAT on Expenses)", method: "self_billing" };
const other: Account = { ...jm, id: "other", codes: ["XX"] };
const m = (month: string, status: "draft" | "published", pence: number): MonthRecord => ({
  month,
  status,
  builtAt: "",
  rentmanTotalPence: 0,
  statements: [buildStatement(jm, month, [{ equipmentId: 1, name: "Ronin 4D", pence }, { equipmentId: 2, name: "Lens", pence: 1000 }]), buildStatement(other, month, [{ equipmentId: 9, name: "Secret", pence: 99999 }])],
  warnings: [],
  signOffs: {},
  adjustments: {},
});

test("a consignor sees only published months and only their own kit", () => {
  const v = consignorView([m("2026-09", "published", 10000), m("2026-10", "published", 20000), m("2026-11", "draft", 50000)], "fkf");
  assert.deepEqual(v.statements.map((s) => s.month), ["2026-10", "2026-09"]);
  assert.equal(v.latestNet, 10500);
  assert.equal(v.yearNet, 10500 + 5500);
  assert.equal(v.allNet, 16000);
  assert.deepEqual(v.kit.map((k) => [k.name, k.monthPence, k.yearPence]), [["Ronin 4D", 10000, 15000], ["Lens", 500, 1000]]);
  assert.ok(!v.kit.some((k) => k.name === "Secret"));
});

test("nothing published yet", () => {
  const v = consignorView([m("2026-11", "draft", 1)], "fkf");
  assert.equal(v.latest, null);
  assert.deepEqual([v.latestNet, v.yearNet, v.allNet, v.kit.length], [0, 0, 0, 0]);
});
