import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/login", "/register", "/book", "/api/auth", "/api/booking"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If logged in but no role, redirect to role selection
  if (isLoggedIn && !role && pathname !== "/role-select") {
    return NextResponse.redirect(new URL("/role-select", req.url));
  }

  // If already has role and tries to go to role-select, redirect to home
  if (isLoggedIn && role && pathname === "/role-select") {
    if (role === "CANDIDATE") {
      return NextResponse.redirect(new URL("/book", req.url));
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // If logged in and on login/register, redirect to dashboard
  if (isLoggedIn && role && (pathname === "/login" || pathname === "/register")) {
    if (role === "CANDIDATE") {
      return NextResponse.redirect(new URL("/book", req.url));
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)"],
};
