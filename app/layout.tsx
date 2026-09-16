import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pakistan Citizen Helper",
  description:
    "Simple, clear and source-focused information about Pakistani government services.",
  keywords: [
    "Pakistan",
    "government services",
    "NADRA",
    "CNIC",
    "passport",
    "domicile",
    "scholarships",
    "FBR",
    "police services",
  ],
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
