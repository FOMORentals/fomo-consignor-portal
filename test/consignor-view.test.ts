import { test } from "node:test";
import assert from "node:assert/strict";
import { consignorView, kitKey, kitName } from "../lib/consignor-view.ts";
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

test("My kit has a column per published month, newest first, and a lifetime total", () => {
  const v = consignorView([m("2025-12", "published", 4000), m("2026-10", "published", 20000), m("2026-11", "draft", 50000)], "fkf");
  assert.deepEqual(v.months, ["2026-10", "2025-12"]);
  assert.equal(v.firstMonth, "2025-12");
  const ronin = v.kit.find((k) => k.name === "Ronin 4D")!;
  assert.deepEqual(ronin.byMonth, { "2026-10": 10000, "2025-12": 2000 });
  assert.equal(ronin.totalPence, 12000);
  assert.equal(ronin.yearPence, 10000);
});

test("an item renamed with the consignor code in front is one row", () => {
  assert.equal(kitName("CC - Leica M11 Monochrom"), "Leica M11 Monochrom");
  assert.equal(kitName("Leica M11 Monochrom"), "Leica M11 Monochrom");
  assert.equal(kitName("ARRI - Alexa Mini"), "Alexa Mini");
  assert.equal(kitName("Kit - Canon C80"), "Kit - Canon C80");
});

test("an item renamed in Rentman is one row, under its newest name", () => {
  assert.equal(kitKey("Leica 135mm Elmarit R Series f/2.8 Lens (Leica R Mount)"), kitKey("Leica 135mm Elmarit R Series F2.8"));
  assert.equal(kitKey("Leica 35mm Summicron R Series f/1.4 Lens"), kitKey("Leica 35mm Summicron R Series F1.4"));
  assert.notEqual(kitKey("Leica 35mm Summicron R Series F1.4"), kitKey("Leica 50mm Summicron R Series F1.4"));
  const mk = (month: string, name: string, pence: number): MonthRecord => ({ ...m(month, "published", 0), statements: [buildStatement(jm, month, [{ equipmentId: 1, name, pence }])] });
  const v = consignorView([mk("2026-03", "Leica 135mm Elmarit R Series f/2.8 Lens (Leica R Mount)", 2000), mk("2026-06", "Leica 135mm Elmarit R Series F2.8", 4000)], "fkf");
  assert.deepEqual(v.kit.map((k) => [k.name, k.totalPence]), [["Leica 135mm Elmarit R Series F2.8", 3000]]);
});
