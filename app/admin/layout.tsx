import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== "staff") return <>{children}</>;
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">Consignor payouts</div>
        <nav>
          <Link href="/admin">Months</Link>
          <Link href="/admin/consignors">Consignors</Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/signin" });
            }}
          >
            <button type="submit" style={{ padding: "2px 10px", fontSize: 13 }}>
              Sign out {session.user.email}
            </button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
