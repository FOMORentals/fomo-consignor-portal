import Link from "next/link";
import { signIn } from "@/auth";
import AuthShell, { authStyles, GoogleIcon } from "@/components/AuthShell";

export default async function StaffSignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  const next = callbackUrl && /^\/(?![/\\])/.test(callbackUrl) ? callbackUrl : "/admin";
  return (
    <AuthShell badge="Consignor portal · Staff">
      <h1 className={authStyles.title}>Staff sign in</h1>
      <p className={authStyles.subtitle}>Sign in with your FOMO Google account to check and publish consignor payouts.</p>
      {error && <div className={authStyles.error}>That account can&apos;t open the consignor admin. Use your fomorentals.co.uk account, or ask Jamie for access.</div>}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: next });
        }}
      >
        <div className={authStyles.oauth}>
          <button type="submit" className={authStyles.buttonSecondary}>
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </form>
      <div className={authStyles.links}>
        <Link href="/">Consignor sign in</Link>
      </div>
    </AuthShell>
  );
}
