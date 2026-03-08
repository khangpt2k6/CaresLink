import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-[#eef6fb] p-12 relative overflow-hidden">
        <img
          src="/nursing.gif"
          alt="CaresLink"
          className="max-w-full h-auto rounded-2xl"
        />
      </div>
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8">
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
        <SignIn
          appearance={{
            variables: { colorPrimary: "#0090d9" },
            elements: {
              rootBox: "mx-auto",
            },
          }}
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/role-select"
        />
      </div>
    </div>
  );
}
