import type { Metadata } from "next";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaresLink - AI Recruitment",
  description: "AI-powered recruitment agent",
  icons: {
    icon: "/careslink.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
