import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { accountsFor, publishedMonths } from "@/lib/access";
import { consignorView } from "@/lib/consignor-view";

/** The signed-in person's accounts and the one in the URL, or off to sign in / not found. Used by every consignor page. */
export const load = cache(async (accountId: string) => {
  const session = await auth();
  if (!session?.user) redirect("/");
  const mine = await accountsFor(session);
  const account = mine.find((a) => a.id === accountId);
  if (!account) notFound();
  const months = await publishedMonths();
  return { session, mine, account, months, view: consignorView(months, account.id) };
});
