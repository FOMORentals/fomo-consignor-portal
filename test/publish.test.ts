import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { billsToMake, planBills, publishMonth } from "../lib/publish.ts";
import { billBody, partyFrom } from "../lib/xero.ts";
import { HMRC_VAT_WORDING, pdfFacts, pdfFilename, pdfTitle, statementPdf } from "../lib/statement-pdf.ts";
import { buildStatement, type Account } from "../lib/payout.ts";
import { EditRefused } from "../lib/month-edits.ts";
import type { MonthRecord, Party } from "../lib/store.ts";

const fkf: Account = { id: "fkf", name: "FKF One Ltd", codes: ["JM"], rates: [], vat: "20% (VAT on Expenses)", method: "self_billing" };
const wr: Account = { id: "wr", name: "William Royal", codes: ["WR"], rates: [], vat: "NO VAT", method: "self_billing" };
const og: Account = { id: "og", name: "One Giant Ltd", codes: ["OG"], rates: [], vat: "20% (VAT on Expenses)", method: "own_invoice" };
const owes = buildStatement(og, "2026-10", [{ equipmentId: 3, name: "Lens", pence: 1000 }], [{ pence: -5000, reason: "Repair", by: "sam", at: "" }]);
const month = (): MonthRecord => ({
  month: "2026-10",
  status: "draft",
  builtAt: "",
  rentmanTotalPence: 0,
  statements: [buildStatement(fkf, "2026-10", [{ equipmentId: 1, name: "Ronin 4D", pence: 100000 }]), buildStatement(wr, "2026-10", []), owes],
  warnings: [{ id: "totals", kind: "totals", message: "x" }],
  signOffs: { totals: { by: "sam", at: "", note: "ok" } },
  adjustments: {},
});
const party = (name: string): Party => ({ name, address: ["1 High St", "London"], vatNumber: "GB123", xeroContactId: "c-" + name });
const fomo: Party = { name: "FOMO Studios Ltd", address: ["Unit 1"], vatNumber: "GB999" };

test("publish needs every check cleared and Xero details for anyone with money on their statement", () => {
  const m = month();
  m.signOffs = {};
  assert.throws(() => publishMonth(m, "sam", "t", fomo, {}), EditRefused);
  assert.throws(() => publishMonth(month(), "sam", "t", fomo, { fkf: party("FKF") }), /og/);
  const p = publishMonth(month(), "sam", "t", fomo, { fkf: party("FKF"), og: party("OG") });
  assert.equal(p.status, "published");
  assert.throws(() => publishMonth(p, "sam", "t", fomo, {}), /already published/);
});

test("bills: CONS number, end-of-month dates, nothing for £0 or money owed", () => {
  const plan = planBills(month(), new Map([fkf, wr, og].map((a) => [a.id, a])));
  const [a, b, c] = plan;
  assert.deepEqual(a.bill, { number: "CONS-JM-2026-10", date: "2026-10-31", dueDate: "2026-11-30", description: "October 2026 consignments (CONS-JM-2026-10)", netPence: 50000, vat: "20% (VAT on Expenses)" });
  assert.equal(b.bill, null);
  assert.match(c.skip!, /Owes FOMO/);
  const body = billBody({ ...a.bill!, contactId: "x" }).Invoices[0];
  assert.equal(body.Status, "DRAFT");
  assert.equal(body.Type, "ACCPAY");
  assert.deepEqual(body.LineItems[0], { Description: "October 2026 consignments (CONS-JM-2026-10)", Quantity: 1, UnitAmount: 500, AccountCode: "327", TaxType: "INPUT2" });
  assert.equal(billBody({ ...a.bill!, vat: "NO VAT", contactId: "x" }).Invoices[0].LineItems[0].TaxType, "NONE");
});

test("retry only makes bills that failed or were never reached", () => {
  const plan = planBills(month(), new Map([fkf, wr, og].map((a) => [a.id, a])));
  const todo = billsToMake(plan, {
    fkf: { state: "created", number: "CONS-JM-2026-10", invoiceId: "i", at: "", attached: true },
    wr: { state: "failed", number: "CONS-WR-2026-10", error: "x", at: "" },
  });
  assert.deepEqual(todo.map((t) => t.accountId), ["wr", "og"]);
});

test("Xero address: postal address first, blanks dropped", () => {
  const p = partyFrom("FKF One Ltd", " GB 123 ", [
    { AddressType: "STREET", AddressLine1: "Street 1" },
    { AddressType: "POBOX", AddressLine1: "PO 1", AddressLine2: "", City: "London", PostalCode: "E8 1AA" },
  ]);
  assert.deepEqual(p, { name: "FKF One Ltd", address: ["PO 1", "London", "E8 1AA"], vatNumber: "GB 123" });
  assert.deepEqual(partyFrom("X", undefined, undefined).address, []);
});

test("self-billed invoice carries the HMRC wording only when the consignor charges VAT", async () => {
  const s = month().statements[0];
  const input = { account: fkf, statement: s, consignor: party("FKF One Ltd"), fomo };
  assert.equal(pdfTitle(input), "Self-billed invoice");
  assert.equal(pdfFilename(input), "CONS-JM-2026-10.pdf");
  assert.deepEqual(pdfFacts(input).map((f) => f.label), ["Invoice number", "Date", "Tax point", "Period"]);
  const pdf = await statementPdf(input);
  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), 1);
  assert.match(doc.getTitle() ?? "", /CONS-JM-2026-10/);
  assert.equal(pdfTitle({ ...input, account: og }), "Consignment statement");
  assert.ok(HMRC_VAT_WORDING.includes("output tax due to HMRC"));
  // Names outside the standard font's letters print as "?" instead of failing.
  await statementPdf({ ...input, statement: { ...s, items: [{ equipmentId: 1, name: "Łódź 🎥 lens", pence: 1 }] } });
});
