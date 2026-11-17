/**
 * Publish, the part that talks to Firestore and Xero. Called from Sam's month page.
 *
 *   publish(month, by):    read FOMO's and consignors' details from Xero, freeze the month, then make the bills.
 *   makeBills(month, by):  make any Xero draft bill not yet made (first run, or Retry after a failure).
 *
 * A bill is looked up by its number before it is made, so running this twice never makes two bills.
 * Every bill's outcome is saved on the month and shown to Sam; nothing fails silently.
 */
import { MONTHS, audit, db, getMonth, listAccounts, type AccountRecord, type BillResult, type MonthRecord, type Party } from "./store.ts";
import { billsToMake, needsParty, planBills, publishMonth } from "./publish.ts";
import { attachPdf, connect, contactByName, createDraftBill, findBill, organisation, type XeroSession } from "./xero.ts";
import { pdfFilename, statementPdf } from "./statement-pdf.ts";
import { EditRefused } from "./month-edits.ts";

export async function publish(month: string, by: string): Promise<void> {
  const record = await getMonth(month);
  if (!record) throw new EditRefused("That month doesn't exist.");
  if (record.status !== "draft") throw new EditRefused("This month is already published.");
  const accounts = new Map((await listAccounts()).map((a) => [a.id, a]));

  let x: XeroSession;
  try {
    x = await connect();
  } catch (e) {
    throw new EditRefused(`Couldn't reach Xero, so nothing was published: ${(e as Error).message}`);
  }
  const fomo = await organisation(x);
  const parties: Record<string, Party> = {};
  const problems: string[] = [];
  for (const s of record.statements) {
    if (!needsParty(s)) continue;
    const a = accounts.get(s.accountId);
    try {
      if (!a) throw new Error("account missing");
      const c = await contactByName(x, a.xeroContact);
      parties[s.accountId] = { ...c.party, xeroContactId: c.id };
    } catch (e) {
      problems.push(`${a?.name ?? s.accountId}: ${(e as Error).message}`);
    }
  }
  if (problems.length) throw new EditRefused(`Nothing was published. Xero details missing: ${problems.join(" · ")}`);

  await db().runTransaction(async (tx) => {
    const ref = db().collection(MONTHS).doc(month);
    const snap = await tx.get(ref);
    tx.set(ref, publishMonth(snap.data() as MonthRecord, by, new Date().toISOString(), fomo, parties));
  });
  await audit(by, "month published", { month });
  await makeBills(month, by, x);
}

export async function makeBills(month: string, by: string, session?: XeroSession): Promise<{ created: number; failed: number }> {
  const record = await getMonth(month);
  if (!record || record.status !== "published") throw new EditRefused("Bills are only made for a published month.");
  const accounts = new Map<string, AccountRecord>((await listAccounts()).map((a) => [a.id, a]));
  const todo = billsToMake(planBills(record, accounts), record.bills);
  if (!todo.length) return { created: 0, failed: 0 };
  const ref = db().collection(MONTHS).doc(month);
  const save = (accountId: string, r: BillResult) => ref.update({ [`bills.${accountId}`]: r });

  let x = session;
  if (!x) {
    try {
      x = await connect();
    } catch (e) {
      throw new EditRefused(`Couldn't reach Xero: ${(e as Error).message}`);
    }
  }
  let created = 0;
  let failed = 0;
  for (const p of todo) {
    const at = new Date().toISOString();
    if (!p.bill) {
      await save(p.accountId, { state: "skipped", number: p.number, reason: p.skip ?? "", at });
      continue;
    }
    try {
      const party = record.parties?.[p.accountId];
      const account = accounts.get(p.accountId)!;
      const statement = record.statements.find((s) => s.accountId === p.accountId)!;
      if (!party?.xeroContactId) throw new Error("No Xero contact saved at Publish.");
      const existing = await findBill(x, p.number);
      if (existing && (existing.status === "DELETED" || existing.status === "VOIDED")) {
        await save(p.accountId, { state: "skipped", number: p.number, reason: `A bill ${p.number} was ${existing.status.toLowerCase()} in Xero, so no new one was made.`, at });
        continue;
      }
      const id = existing?.id ?? (await createDraftBill(x, { ...p.bill, contactId: party.xeroContactId })).id;
      const input = { account, statement, consignor: party, fomo: record.fomo! };
      // A bill found already in Xero came from an earlier run that stopped part-way: Sam checks its PDF there.
      let attached = true;
      if (!existing) {
        try {
          await attachPdf(x, id, pdfFilename(input), await statementPdf(input));
        } catch (e) {
          attached = false;
          console.error(`consignor publish: attach failed for ${p.number}:`, (e as Error).message);
        }
      }
      await save(p.accountId, { state: "created", number: p.number, invoiceId: id, at, attached: !existing && attached });
      created++;
    } catch (e) {
      failed++;
      console.error(`consignor publish: bill ${p.number} failed:`, (e as Error).message);
      await save(p.accountId, { state: "failed", number: p.number, error: (e as Error).message.slice(0, 300), at });
    }
  }
  await audit(by, "xero draft bills", { month, created, failed });
  return { created, failed };
}
