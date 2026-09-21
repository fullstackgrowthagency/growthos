import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrowthOS",
  description: "Agency Intelligence for HighLevel — one screen for your whole client portfolio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
