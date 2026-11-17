import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { role?: "staff" | "consignor" } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "staff" | "consignor";
  }
}

export {};
