// proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/invite/(.*)",
  "/api/webhooks/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Public routes — no auth required
  if (isPublicRoute(req)) return NextResponse.next();

  // Not signed in — redirect to auth
  if (!userId) {
    const authUrl = new URL("/auth", req.url);
    authUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(authUrl);
  }

  // All other auth checks (onboarding, role routing) happen client-side
  // because unsafeMetadata is not available in session claims by default.
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};