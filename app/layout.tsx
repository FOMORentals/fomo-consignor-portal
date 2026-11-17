import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const silverspoon = localFont({ src: "./fonts/Silverspoon-Regular.woff", variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "FOMO Rentals | Consignors",
  description: "What your kit earned at FOMO Rentals, and your monthly statements",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${silverspoon.variable}`}>
      <body>{children}</body>
    </html>
  );
}
