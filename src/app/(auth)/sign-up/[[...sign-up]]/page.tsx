import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen">
      {/* Full-page video background */}
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/nursing.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/30" />
      </div>
      <div className="relative z-10 flex w-full flex-col items-center justify-center p-8">
        <Link
          href="/"
          className="absolute top-8 left-8 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/90 px-4 py-2 text-sm text-gray-700 hover:bg-white transition-colors backdrop-blur-sm"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <Image
            src="/careslink.png"
            alt="CaresLink"
            width={44}
            height={44}
            className="rounded-lg"
          />
          <span className="text-2xl font-bold text-[#0090d9]">CaresLink</span>
        </div>
        <SignUp
          appearance={{
            variables: { colorPrimary: "#0090d9" },
            elements: {
              rootBox: "mx-auto",
            },
          }}
          signInUrl="/sign-in"
          fallbackRedirectUrl="/role-select"
        />
      </div>
    </div>
  );
}
