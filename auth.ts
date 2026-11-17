import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { isStaffEmail } from "@/lib/staff";
import { claimLink } from "@/lib/signin-links";
import { hasLogin } from "@/lib/access";

const WORKSPACE_DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN || "fomorentals.co.uk";

/**
 * Staff sign in with their FOMO Google account; only the people in lib/staff.ts get in (Sam and Jamie, spec §2).
 * Consignors sign in with a one-time emailed link (lib/signin-links.ts); which accounts they see is checked on
 * every page (lib/access.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({ authorization: { params: { hd: WORKSPACE_DOMAIN, prompt: "select_account" } } }),
    Credentials({
      id: "link",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        const email = await claimLink(String(credentials?.token ?? ""));
        if (!email || !(await hasLogin(email))) return null;
        return { id: email, email };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/admin/signin", error: "/admin/signin" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "link") return true;
      if (account?.provider !== "google") return false;
      return !!profile?.email_verified && profile?.hd === WORKSPACE_DOMAIN && isStaffEmail(profile.email);
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google") {
        token.role = "staff";
        token.email = user.email;
      }
      if (user && account?.provider === "link") {
        token.role = "consignor";
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.role = token.role === "staff" || token.role === "consignor" ? token.role : undefined;
      return session;
    },
  },
});
