import { signIn } from "@/auth";

export default async function StaffSignIn({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  const next = callbackUrl && /^\/(?![/\\])/.test(callbackUrl) ? callbackUrl : "/admin";
  return (
    <main className="signin">
      <div className="brand">FOMO Rentals</div>
      <h1>Consignor payouts</h1>
      <p className="sub">Staff sign in with your FOMO Google account.</p>
      {error && <p className="warnings">That account can&apos;t open the consignor admin. Ask Jamie if you need access.</p>}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: next });
        }}
      >
        <button type="submit">Continue with Google</button>
      </form>
    </main>
  );
}
