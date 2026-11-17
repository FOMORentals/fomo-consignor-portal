import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});
const silverspoon = localFont({
  src: [
    {
      path: "./fonts/Silverspoon-Regular.woff",
      weight: "400",
      style: "normal",
    },
    { path: "./fonts/Silverspoon-Regular.otf", weight: "400", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FOMO Rentals | Consignors",
  description:
    "What your kit earned at FOMO Rentals, and your monthly statements",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${jetbrainsMono.variable} ${silverspoon.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
