import Link from "next/link";
import { signOut } from "@/auth";
import { load } from "./data";

export const dynamic = "force-dynamic";

export default async function ConsignorLayout({ children, params }: { children: React.ReactNode; params: Promise<{ account: string }> }) {
  const { account: id } = await params;
  const { session, mine, account } = await load(id);
  const staff = session.user.role === "staff";
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">{account.name}</div>
        <nav>
          <Link href={`/c/${account.id}`}>Overview</Link>
          <Link href={`/c/${account.id}/kit`}>My kit</Link>
          <Link href={`/c/${account.id}/statements`}>Statements</Link>
          {!staff &&
            mine
              .filter((a) => a.id !== account.id)
              .map((a) => (
                <Link key={a.id} href={`/c/${a.id}`} className="switch">
                  Switch to {a.name}
                </Link>
              ))}
          {staff && <Link href="/admin/consignors">Back to admin</Link>}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="quiet">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      {staff && <p className="note">You&apos;re seeing {account.name}&apos;s pages as FOMO staff.</p>}
      {children}
    </div>
  );
}
