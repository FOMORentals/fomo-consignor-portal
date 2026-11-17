/**
 * Who can see which consignor's pages (spec §2): a consignor's login emails see that account (one email can see
 * several); staff see every account. Checked on every page load against Firestore, so removing an email cuts it off.
 */
import type { Session } from "next-auth";
import { listAccounts, listMonthIds, getMonth, type AccountRecord, type MonthRecord } from "./store.ts";

export async function accountsFor(session: Session | null): Promise<AccountRecord[]> {
  const email = session?.user?.email?.toLowerCase();
  if (!email) return [];
  const all = await listAccounts();
  if (session?.user?.role === "staff") return all;
  if (session?.user?.role !== "consignor") return [];
  return all.filter((a) => a.loginEmails.includes(email));
}

export async function hasLogin(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  return (await listAccounts()).some((a) => a.active && a.loginEmails.includes(e));
}

/** Published months only, oldest first. A draft is never shown to a consignor. */
export async function publishedMonths(): Promise<MonthRecord[]> {
  const ids = (await listMonthIds()).filter((m) => m >= "2026-01");
  const months = await Promise.all(ids.map(getMonth));
  return months.filter((m): m is MonthRecord => m?.status === "published").sort((a, b) => a.month.localeCompare(b.month));
}
