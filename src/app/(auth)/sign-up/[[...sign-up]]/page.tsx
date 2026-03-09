import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left sidebar - video */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-[#eef6fb] p-12 relative overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="max-w-full h-auto max-h-[80vh] rounded-2xl object-cover"
        >
          <source src="/nursing.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="relative flex w-full lg:w-1/2 flex-col items-center justify-center p-8">
        <Link
          href="/"
          className="absolute top-8 left-8 inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
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
