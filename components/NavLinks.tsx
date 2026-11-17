"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./PortalShell.module.css";

/** Header nav, the client portal's pattern: the active section keeps a 1px underline, the others draw one on hover. */
export default function NavLinks({ links }: { links: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className={styles.nav} aria-label="Portal sections">
      {links.map((l) => {
        const active = l.exact ? path === l.href : path === l.href || path.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} className={active ? styles.linkActive : styles.link} aria-current={active ? "page" : undefined}>
            <span className={styles.label}>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
