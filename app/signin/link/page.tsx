import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import AuthShell, { authStyles } from "@/components/AuthShell";

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
    <AuthShell>
      <h1 className={authStyles.title}>Sign in</h1>
      <p className={authStyles.subtitle}>Press the button to sign in and see your statements.</p>
      <form action={go}>
        <button className={authStyles.button} type="submit">
          Sign in
        </button>
      </form>
    </AuthShell>
  );
}
