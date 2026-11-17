import styles from "./BrandMark.module.css";

interface BrandMarkProps {
  badge?: string;
  subtitle?: string;
  variant?: "auth" | "header" | "compact";
}

export default function BrandMark({
  badge = "Consignor portal",
  subtitle,
  variant = "auth",
}: BrandMarkProps) {
  const logoWidth = variant === "auth" ? 132 : 108;

  return (
    <div className={`${styles.mark} ${styles[variant]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.logo}
        src="/brand/fomo-logo.png"
        alt="FOMO"
        width={logoWidth}
        height={Math.round(logoWidth * (238 / 960))}
      />
      {(badge || subtitle) && (
        <div className={styles.meta}>
          {badge && <span className={styles.badge}>{badge}</span>}
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
