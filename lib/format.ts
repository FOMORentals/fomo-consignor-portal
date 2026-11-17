export const pounds = (pence: number) =>
  `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" -> "October 2026" */
export const monthName = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export const METHOD_LABEL = { self_billing: "Self billing", own_invoice: "Their own invoice", rentman_credit: "Rentman credit" } as const;
