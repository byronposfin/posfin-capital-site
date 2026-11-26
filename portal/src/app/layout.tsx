import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Borrower portal",
  description: "Your live deal home with Posfin Capital, a credit broker.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07111f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
