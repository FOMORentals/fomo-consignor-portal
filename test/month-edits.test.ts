import { test } from "node:test";
import assert from "node:assert/strict";
import { addAdjustment, EditRefused, openWarnings, parsePounds, removeAdjustment, signOffWarning } from "../lib/month-edits.ts";
import { buildStatement, type Account } from "../lib/payout.ts";
import type { MonthRecord } from "../lib/store.ts";

const account: Account = { id: "fkf-one-ltd", name: "FKF One Ltd", codes: ["JM"], rates: [], vat: "20% (VAT on Expenses)", method: "self_billing" };
const apollo: Account = { id: "apollo", name: "Apollo", codes: ["AP"], rates: [{ from: "2026-01", share: 1, by: "", at: "" }], vat: "20% (VAT on Expenses)", method: "own_invoice" };
const month = (): MonthRecord => ({
  month: "2026-10",
  status: "draft",
  builtAt: "2026-11-17T10:00:00Z",
  rentmanTotalPence: 100000,
  statements: [buildStatement(account, "2026-10", [{ equipmentId: 1, name: "Kit", pence: 100000 }]), buildStatement(apollo, "2026-10", [])],
  warnings: [{ id: "totals", kind: "totals", message: "x" }],
  signOffs: {},
  adjustments: {},
});
const adj = (pence: number, reason = "Lens repair") => ({ pence, reason, by: "sam@fomorentals.co.uk", at: "2026-12-02T09:00:00Z" });

test("amounts in pounds", () => {
  assert.equal(parsePounds("-120.50"), -12050);
  assert.equal(parsePounds("£1,250"), 125000);
  assert.equal(parsePounds("75.5"), 7550);
  assert.throws(() => parsePounds("12.345"), EditRefused);
  assert.throws(() => parsePounds("abc"), EditRefused);
});

test("a deduction restates that consignor's statement, VAT included", () => {
  const r = addAdjustment(month(), account, adj(-10000));
  const s = r.statements.find((x) => x.accountId === "fkf-one-ltd")!;
  assert.deepEqual([s.grossPence, s.netPence, s.vatPence, s.totalPence], [50000, 40000, 8000, 48000]);
  assert.equal(r.adjustments["fkf-one-ltd"].length, 1);
});

test("Apollo's agreed amount goes in as a manual line", () => {
  const r = addAdjustment(month(), apollo, adj(70000, "October flat fee"));
  assert.equal(r.statements.find((x) => x.accountId === "apollo")!.totalPence, 84000);
});

test("removing an adjustment puts the statement back", () => {
  const r = removeAdjustment(addAdjustment(month(), account, adj(-10000)), account, 0);
  assert.equal(r.statements.find((x) => x.accountId === "fkf-one-ltd")!.netPence, 50000);
});

test("no reason, £0, or a published month are refused", () => {
  assert.throws(() => addAdjustment(month(), account, adj(-100, "  ")), /reason/);
  assert.throws(() => addAdjustment(month(), account, adj(0)), /£0/);
  assert.throws(() => addAdjustment({ ...month(), status: "published" }, account, adj(-100)), /published/);
});

test("signing off a check needs a note and clears it", () => {
  const m = month();
  assert.equal(openWarnings(m).length, 1);
  assert.throws(() => signOffWarning(m, "totals", "sam", "t", ""), /why/);
  assert.equal(openWarnings(signOffWarning(m, "totals", "sam", "t", "Apollo paid by hand")).length, 0);
});
