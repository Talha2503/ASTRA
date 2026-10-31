import type { Metadata } from "next";
import { Sora, Instrument_Sans } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ASTRA | Astronomical anomaly investigation",
  description:
    "A team of AI agents that investigates unusual stars in NASA light curve data and ranks what deserves a closer look.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sora.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}