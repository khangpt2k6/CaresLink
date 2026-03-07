import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaresLink - AI Recruitment",
  description: "AI-powered recruitment agent",
  icons: {
    icon: "/careslink_logo.jpg",
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
        {children}
      </body>
    </html>
  );
}
