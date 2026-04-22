import { NextRequest, NextResponse } from "next/server";

function withCors(res: NextResponse, origin: string | null) {
  // Flutter dev-server ports are random; mirror whatever origin the browser
  // sent. In prod (Railway) lock this down to the known Flutter origin via env.
  const allow =
    process.env.ALLOWED_ORIGIN || origin || "*";
  res.headers.set("Access-Control-Allow-Origin", allow);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Requested-With"
  );
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin");

  if (pathname.startsWith("/api/")) {
    // CORS preflight — Next's middleware can short-circuit OPTIONS.
    if (req.method === "OPTIONS") {
      return withCors(new NextResponse(null, { status: 204 }), origin);
    }
    return withCors(NextResponse.next(), origin);
  }

  return new NextResponse("Not Found", { status: 404 });
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|careslink.png|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|mov)).*)",
  ],
};
