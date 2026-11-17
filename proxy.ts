import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/signin") return;
  if (pathname.startsWith("/admin") && req.auth?.user?.role !== "staff") {
    const url = new URL("/admin/signin", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
