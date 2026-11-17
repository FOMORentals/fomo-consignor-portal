import { signOut } from "@/auth";
import { load } from "./data";
import PortalShell from "@/components/PortalShell";

export const dynamic = "force-dynamic";

export default async function ConsignorLayout({ children, params }: { children: React.ReactNode; params: Promise<{ account: string }> }) {
  const { account: id } = await params;
  const { session, mine, account } = await load(id);
  const staff = session.user.role === "staff";
  const base = `/c/${account.id}`;
  return (
    <PortalShell
      subtitle={account.name}
      links={[
        { href: base, label: "Overview", exact: true },
        { href: `${base}/kit`, label: "My kit" },
        { href: `${base}/statements`, label: "Statements" },
        ...(staff ? [{ href: "/admin/consignors", label: "Back to admin" }] : mine.filter((a) => a.id !== account.id).map((a) => ({ href: `/c/${a.id}`, label: `Switch to ${a.name}` }))),
      ]}
      banner={staff ? <>Viewing as {account.name} (FOMO staff)</> : undefined}
      signOut={async () => {
        "use server";
        await signOut({ redirectTo: staff ? "/admin/signin" : "/" });
      }}
    >
      {children}
    </PortalShell>
  );
}
