import BrandMark from "./BrandMark";
import styles from "./PortalHeader.module.css";

interface PortalHeaderProps {
  badge?: string;
  subtitle?: string;
  nav?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PortalHeader({
  badge = "Consignor portal",
  subtitle,
  nav,
  children,
}: PortalHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <BrandMark badge={badge} subtitle={subtitle} variant="header" />
        {nav && <div className={styles.nav}>{nav}</div>}
        {children && <div className={styles.actions}>{children}</div>}
      </div>
    </header>
  );
}
