import PortalHeader from "./PortalHeader";
import NavLinks from "./NavLinks";
import headerStyles from "./PortalHeader.module.css";
import styles from "./PortalShell.module.css";

interface PortalShellProps {
  subtitle: string;
  links: { href: string; label: string; exact?: boolean }[];
  /** A server action that signs out. */
  signOut: () => Promise<void>;
  /** Shown under the header, e.g. "You're seeing X's pages as FOMO staff". */
  banner?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/** The client portal's shell: sticky header (wordmark, badge, name | nav | sign out), page column below. */
export default function PortalShell({ subtitle, links, signOut, banner, extra, children }: PortalShellProps) {
  return (
    <div className={styles.shell}>
      {banner && <div className="viewAsBanner">{banner}</div>}
      <PortalHeader badge="Consignor portal" subtitle={subtitle} nav={<NavLinks links={links} />}>
        {extra}
        <form action={signOut}>
          <button className={headerStyles.signOut} type="submit">
            Sign out
          </button>
        </form>
      </PortalHeader>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
