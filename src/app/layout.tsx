import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
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
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
    >
      <html lang="en">
        <body className="min-h-screen bg-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
