import { test } from "node:test";
import assert from "node:assert/strict";
import { historyMonth, historyStatement } from "../lib/history.ts";
import type { Account } from "../lib/payout.ts";

const ct: Account = { id: "ct", name: "Christoph Trestler", codes: ["CT"], rates: [], vat: "NO VAT", method: "rentman_credit" };
const rg: Account = { id: "rg", name: "Rhys Grey", codes: ["RG"], rates: [], vat: "20% (VAT on Expenses)", method: "own_invoice" };

test("a tracker month comes in exactly as paid (CT September matches the Xero bill, £282.24)", () => {
  const s = historyStatement(ct, "2026-09", { code: "CT", revenue: 564.47, split: 0.5, debt: null, net: 282.235, total: 282.235 }, [
    { name: "Kit - Catta Ace", revenue: 564.47, code: "CT" },
    { name: "Kit - Other", revenue: 10, code: "JM" },
  ]);
  assert.equal(s.totalPence, 28224);
  assert.deepEqual(s.items.map((i) => i.name), ["Catta Ace"]);
  assert.equal(s.adjustments.length, 0);
});

test("debts and hand edits become adjustment lines so the statement adds up", () => {
  const s = historyStatement(rg, "2026-02", { code: "RG", revenue: 1000, split: 0.5, debt: -50, net: 650, total: 780 }, []);
  assert.deepEqual(s.adjustments.map((a) => [a.reason, a.pence]), [["Outstanding debt", -5000], ["Adjustment", 20000]]);
  assert.equal(s.grossPence + s.adjustments.reduce((a, x) => a + x.pence, 0), s.netPence);
  assert.equal(s.vatPence, 13000);
  assert.deepEqual(s.items, [{ equipmentId: 0, name: "Other revenue agreed with FOMO", pence: 100000 }]);
});

test("codes with no account are reported, not dropped silently", () => {
  const { record, unmatched } = historyMonth("2026-01", [{ code: "ct", revenue: 2, split: 0.5, debt: null, net: 1, total: 1 }, { code: "JE", revenue: 100, split: 0.5, debt: null, net: 50, total: 50 }], [], [ct], "t");
  assert.deepEqual(unmatched, ["JE"]);
  assert.equal(record.status, "published");
  assert.equal(record.history, true);
  assert.equal(record.statements.length, 1);
});
