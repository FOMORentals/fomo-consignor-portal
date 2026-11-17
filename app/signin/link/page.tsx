import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/**
 * Where the emailed link lands. Signing in needs a press of the button, so an email scanner opening the link
 * doesn't use it up.
 */
export default async function LinkSignIn({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  async function go() {
    "use server";
    try {
      await signIn("link", { token, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) redirect("/?error=link");
      throw e;
    }
  }
  return (
    <main className="signin">
      <div className="brand">FOMO Rentals</div>
      <h1>Consignors</h1>
      <p className="sub">Sign in to see your statements.</p>
      <form action={go}>
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
