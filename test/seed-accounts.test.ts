import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAccounts } from "../scripts/seed-accounts.ts";

const CSV = `id,name,xeroContact,codes,loginEmails,share,vat,method,manual
fkf-one,FKF One,FKF One Ltd,JM,Someone@example.com,0.5,20% (VAT on Expenses),self_billing,false
apollo,Apollo,Apollo,AP,a@example.com|b@example.com,1,20% (VAT on Expenses),own_invoice,true`;

test("accounts CSV becomes accounts with a starting rate from January 2026", () => {
  const [fkf, apollo] = parseAccounts(CSV, "2026-11-17T10:00:00Z");
  assert.deepEqual(fkf.codes, ["JM"]);
  assert.deepEqual(fkf.loginEmails, ["someone@example.com"]);
  assert.deepEqual(fkf.rates, [{ from: "2026-01", share: 0.5, by: "Consignment Tracker 2026", at: "2026-11-17T10:00:00Z" }]);
  assert.equal(fkf.manual, false);
  assert.deepEqual(apollo.loginEmails, ["a@example.com", "b@example.com"]);
  assert.equal(apollo.manual, true);
});

test("a typo in VAT, method or share stops the import", () => {
  assert.throws(() => parseAccounts(CSV.replace("0.5,20%", "50,20%"), "x"), /share 50/);
  assert.throws(() => parseAccounts(CSV.replace("self_billing", "invoice"), "x"), /method "invoice"/);
  assert.throws(() => parseAccounts(CSV.replace("20% (VAT on Expenses),self", "20%,self"), "x"), /VAT "20%"/);
});
