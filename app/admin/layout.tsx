import { auth, signOut } from "@/auth";
import PortalShell from "@/components/PortalShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== "staff") return <>{children}</>;
  return (
    <PortalShell
      subtitle={session.user.email ?? "FOMO staff"}
      links={[
        { href: "/admin", label: "Months", exact: false },
        { href: "/admin/consignors", label: "Consignors" },
      ]}
      signOut={async () => {
        "use server";
        await signOut({ redirectTo: "/admin/signin" });
      }}
    >
      {children}
    </PortalShell>
  );
}
