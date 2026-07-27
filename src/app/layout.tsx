import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CC-Quality — QA Scorecard",
  description: "Call Center Quality Scoring System",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
