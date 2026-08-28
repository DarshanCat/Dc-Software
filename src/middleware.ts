import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes, static files, auth endpoints, icons, and public QR scans
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/activate") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/qr") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Unauthenticated users -> redirect to /login
  if (!token || !token.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If mustChangePassword is true, enforce redirect to /change-password on all protected routes
  const mustChangePassword = Boolean(token.mustChangePassword);
  if (mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  const roleKeys = (token.roleKeys as string[]) || [];
  const isAdmin = roleKeys.includes("ADMIN");

  // Server-side Route-Level RBAC Enforcement
  if (pathname.startsWith("/admin") && !isAdmin) {
    return new NextResponse("403 Forbidden: Admin access required", { status: 403 });
  }

  if (pathname.startsWith("/security") && !isAdmin && !roleKeys.includes("SECURITY")) {
    return new NextResponse("403 Forbidden: Security access required", { status: 403 });
  }

  if (pathname.startsWith("/accounts") && !isAdmin && !roleKeys.includes("ACCOUNTS")) {
    return new NextResponse("403 Forbidden: Accounts access required", { status: 403 });
  }

  if (pathname.startsWith("/management") && !isAdmin && !roleKeys.includes("MANAGEMENT")) {
    return new NextResponse("403 Forbidden: Management access required", { status: 403 });
  }

  if (pathname.startsWith("/stores") && !isAdmin && !roleKeys.includes("STORES")) {
    return new NextResponse("403 Forbidden: Stores access required", { status: 403 });
  }

  if (pathname.startsWith("/production") && !isAdmin && !roleKeys.includes("PRODUCTION")) {
    return new NextResponse("403 Forbidden: Production access required", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
