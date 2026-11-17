import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isStaffEmail } from "@/lib/staff";

const WORKSPACE_DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN || "fomorentals.co.uk";

/**
 * Staff sign in with their FOMO Google account; only the people in lib/staff.ts get in (Sam and Jamie, spec §2).
 * Consignor magic-link sign-in comes in a later change.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google({ authorization: { params: { hd: WORKSPACE_DOMAIN, prompt: "select_account" } } })],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/admin/signin", error: "/admin/signin" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      return !!profile?.email_verified && profile?.hd === WORKSPACE_DOMAIN && isStaffEmail(profile.email);
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google") {
        token.role = "staff";
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.role = token.role === "staff" ? "staff" : undefined;
      return session;
    },
  },
});
