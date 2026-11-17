"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { addAdjustment, EditRefused, parsePounds, removeAdjustment, signOffWarning } from "@/lib/month-edits";
import { ACCOUNTS, MONTHS, audit, db, type AccountRecord, type MonthRecord } from "@/lib/store";

async function staffEmail(): Promise<string> {
  const session = await auth();
  if (session?.user?.role !== "staff" || !session.user.email) throw new Error("Not signed in as staff");
  return session.user.email;
}

/** Load the month (and an account), apply one change in a transaction, save, log it. Refusals come back as ?error=. */
async function edit(month: string, accountId: string | null, change: (m: MonthRecord, a: AccountRecord | null) => MonthRecord, log: [string, Record<string, unknown>]) {
  const by = await staffEmail();
  let error = "";
  try {
    await db().runTransaction(async (tx) => {
      const monthRef = db().collection(MONTHS).doc(month);
      const snap = await tx.get(monthRef);
      if (!snap.exists) throw new EditRefused("That month doesn't exist.");
      let account: AccountRecord | null = null;
      if (accountId) {
        const a = await tx.get(db().collection(ACCOUNTS).doc(accountId));
        if (!a.exists) throw new EditRefused("That consignor doesn't exist.");
        account = { ...(a.data() as AccountRecord), id: a.id };
      }
      tx.set(monthRef, change(snap.data() as MonthRecord, account));
    });
    await audit(by, log[0], { month, accountId, ...log[1] });
  } catch (e) {
    if (!(e instanceof EditRefused)) throw e;
    error = e.message;
  }
  revalidatePath(`/admin/months/${month}`);
  if (error) redirect(`/admin/months/${month}?error=${encodeURIComponent(error)}`);
}

export async function addAdjustmentAction(month: string, accountId: string, form: FormData) {
  const by = await staffEmail();
  const reason = String(form.get("reason") ?? "");
  let pence: number;
  try {
    pence = parsePounds(String(form.get("amount") ?? ""));
  } catch (e) {
    redirect(`/admin/months/${month}?error=${encodeURIComponent((e as Error).message)}`);
  }
  const at = new Date().toISOString();
  await edit(month, accountId, (m, a) => addAdjustment(m, a!, { pence, reason, by, at }), ["adjustment added", { pence, reason }]);
}

export async function removeAdjustmentAction(month: string, accountId: string, index: number) {
  await edit(month, accountId, (m, a) => removeAdjustment(m, a!, index), ["adjustment removed", { index }]);
}

export async function signOffAction(month: string, warningId: string, form: FormData) {
  const by = await staffEmail();
  const note = String(form.get("note") ?? "");
  await edit(month, null, (m) => signOffWarning(m, warningId, by, new Date().toISOString(), note), ["check signed off", { warningId, note }]);
}
