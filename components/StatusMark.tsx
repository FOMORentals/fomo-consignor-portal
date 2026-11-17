import styles from "./StatusMark.module.css";

export type StatusTone = "done" | "pending" | "alert";

/** The portal's one status mark: filled green = done, hollow grey = not yet, hollow red = needs attention. */
export default function StatusMark({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return <span className={`${styles.mark} ${styles[tone]}`}>{children}</span>;
}
