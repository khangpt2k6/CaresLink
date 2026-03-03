import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaresLink - AI Recruitment",
  description: "AI-powered recruitment agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Sidebar />
        <main className="pl-56">
          {children}
        </main>
      </body>
    </html>
  );
}
