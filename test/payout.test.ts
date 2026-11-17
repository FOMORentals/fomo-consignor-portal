import { test } from "node:test";
import assert from "node:assert/strict";
import { billDates, buildStatement, selfBillingNumber, shareFor, toPence, type Account } from "../lib/payout.ts";
import { runChecks, type ConsignedItem } from "../lib/checks.ts";

const account = (p: Partial<Account> = {}): Account => ({
  id: "fkf-one",
  name: "FKF One Ltd",
  codes: ["JM"],
  rates: [],
  vat: "20% (VAT on Expenses)",
  method: "self_billing",
  ...p,
});
const items = (...pounds: number[]) => pounds.map((p, i) => ({ equipmentId: i + 1, name: `Item ${i + 1}`, pence: toPence(p) }));

test("October 2026 FKF One matches the tracker: £18,204.06 at 50% = £9,102.03 + VAT £1,820.41", () => {
  const s = buildStatement(account(), "2026-10", items(18204.06));
  assert.equal(s.grossPence, 910203);
  assert.equal(s.vatPence, 182041);
  assert.equal(s.totalPence, 1092244);
});

test("half pence round up, like the tracker's Xero amounts", () => {
  // Dark Chamber, Oct 2026: £1,642.91 at 50% = £821.455 in the sheet
  assert.equal(buildStatement(account({ id: "dc", codes: ["DC"] }), "2026-10", items(1642.91)).grossPence, 82146);
});

test("no VAT accounts pay net only", () => {
  // James Lee Photography (CON), Oct 2026: £600 at 50% = £300, no VAT
  const s = buildStatement(account({ id: "con", codes: ["CON"], vat: "NO VAT" }), "2026-10", items(600));
  assert.deepEqual([s.netPence, s.vatPence, s.totalPence], [30000, 0, 30000]);
});

test("a rate change applies from its month onwards and leaves earlier months alone", () => {
  const a = account({ rates: [{ from: "2026-12", share: 0.7, by: "sam@fomorentals.co.uk", at: "2026-11-20T10:00:00Z" }] });
  assert.equal(shareFor(a, "2026-11"), 0.5);
  assert.equal(shareFor(a, "2026-12"), 0.7);
  assert.equal(shareFor(a, "2027-03"), 0.7);
});

test("deductions come off before VAT and show on the statement", () => {
  const s = buildStatement(account(), "2026-10", items(1000), [{ pence: -10000, reason: "Lens repair owed to FOMO", by: "sam", at: "x" }]);
  assert.equal(s.netPence, 40000);
  assert.equal(s.vatPence, 8000);
  assert.equal(s.adjustments[0].reason, "Lens repair owed to FOMO");
});

test("self-billing numbers and Xero dates", () => {
  assert.equal(selfBillingNumber(account(), "2026-10"), "CONS-JM-2026-10");
  assert.deepEqual(billDates("2026-09"), { invoiceDate: "2026-09-30", dueDate: "2026-10-31" });
  assert.deepEqual(billDates("2026-12"), { invoiceDate: "2026-12-31", dueDate: "2027-01-31" });
});

test("safety checks: totals, unknown and lower-case codes, idle kit, big swings", () => {
  const kit: ConsignedItem[] = [
    { equipmentId: 1, name: "Kit - Canon C80", code: "JM", archived: false },
    { equipmentId: 2, name: "Leica R lens", code: "cc", archived: false },
    { equipmentId: 3, name: "Test record", code: "TEST", archived: false },
    { equipmentId: 4, name: "Old tripod", code: "JM", archived: false },
  ];
  const itemRevenue = new Map([[1, 31227], [2, 6400], [3, 999]]);
  const jm = buildStatement(account(), "2026-10", [{ equipmentId: 1, name: "Kit - Canon C80", pence: 31227 }]);
  const prev = buildStatement(account(), "2026-09", items(100));
  const warnings = runChecks({
    month: "2026-10",
    items: kit,
    itemRevenue,
    statements: [jm],
    accountNames: new Map([["fkf-one", "FKF One Ltd"]]),
    previous: new Map([["fkf-one", prev]]),
    idleItemIds: new Set([4]),
    knownCodes: new Set(["JM", "CC"]),
  });
  assert.deepEqual(warnings.map((w) => w.id).sort(), ["big-swing:fkf-one", "idle-kit:4", "totals", "unknown-code:cc"]);
  assert.match(warnings.find((w) => w.kind === "unknown-code")!.message, /did you mean CC\?/);
});

test("a clean month has no warnings", () => {
  const s = buildStatement(account(), "2026-10", [{ equipmentId: 1, name: "Kit", pence: 1000 }]);
  const warnings = runChecks({
    month: "2026-10",
    items: [{ equipmentId: 1, name: "Kit", code: "JM", archived: false }],
    itemRevenue: new Map([[1, 1000]]),
    statements: [s],
    accountNames: new Map(),
    previous: new Map([["fkf-one", s]]),
    idleItemIds: new Set(),
    knownCodes: new Set(["JM"]),
  });
  assert.deepEqual(warnings, []);
});
