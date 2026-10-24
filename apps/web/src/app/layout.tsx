
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MINX — Good Stuff. Better Prices.",
  description:
    "Discover pre-loved products, find better deals, and give great things a second life with MINX, your resale marketplace.",
  applicationName: "MINX",
  keywords: [
    "MINX",
    "resale marketplace",
    "second-hand products",
    "used mobiles",
    "pre-loved products",
    "buy and sell",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0b0c0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
