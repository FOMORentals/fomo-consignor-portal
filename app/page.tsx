import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { accountsFor, hasLogin } from "@/lib/access";
import { createLink, linksSentSince, PER_EMAIL_PER_HOUR, removeLink } from "@/lib/signin-links";
import { sendEmail, signInLinkEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Ask for a sign-in link. Same reply whatever happened, so the form can't be used to find out who has a login. */
async function requestLink(form: FormData) {
  "use server";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/?sent=bad");
  if (await hasLogin(email)) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    if ((await linksSentSince(email, since)) < PER_EMAIL_PER_HOUR) {
      const token = await createLink(email);
      try {
        await sendEmail({ to: email, ...signInLinkEmail(token) });
      } catch (e) {
        await removeLink(token);
        console.error("sign-in link email failed:", (e as Error).message);
        redirect("/?sent=failed");
      }
    } else {
      console.warn("sign-in link: hourly limit reached for one email, none sent");
    }
  }
  redirect("/?sent=1");
}

export default async function Home({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const session = await auth();
  if (session?.user?.role === "staff") redirect("/admin");
  if (session?.user?.role === "consignor") {
    const mine = await accountsFor(session);
    if (mine.length) redirect(`/c/${mine[0].id}`);
  }
  const { sent, error } = await searchParams;
  return (
    <main className="signin">
      <div className="brand">FOMO Rentals</div>
      <h1>Consignors</h1>
      {sent === "1" ? (
        <p className="sub">If that email has a consignor account, a sign-in link is on its way. It works once, for 30 minutes.</p>
      ) : (
        <>
          <p className="sub">See what your kit earned and download your statements. Enter your email and we&apos;ll send you a sign-in link.</p>
          {sent === "bad" && <p className="warnings">That email doesn&apos;t look right. Check for a typo.</p>}
          {sent === "failed" && <p className="warnings">We couldn&apos;t send the email just now. Try again in a minute.</p>}
          {error && <p className="warnings">That sign-in link has expired or was already used. Ask for a new one.</p>}
          <form action={requestLink} className="stack">
            <input type="email" name="email" required placeholder="you@example.com" autoComplete="email" />
            <button type="submit">Email me a sign-in link</button>
          </form>
        </>
      )}
      <p className="note">FOMO staff: <a href="/admin/signin">sign in here</a>.</p>
    </main>
  );
}
