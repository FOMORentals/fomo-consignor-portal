import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { role?: "staff" } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "staff";
  }
}

export {};
