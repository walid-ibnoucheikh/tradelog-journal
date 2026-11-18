import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, authStatus, verifySessionToken } from "@/lib/auth/auth-core"
import { isSyncRoute } from "@/lib/sync/sync-token"

/** Every page and Server Action goes through here: without a valid session, only /login is reachable. */
export async function proxy(request: NextRequest) {
  const status = authStatus(process.env)
  if (status.mode === "disabled") return NextResponse.next()
  if (status.mode === "misconfigured") {
    return new NextResponse(`Authentication is not configured: ${status.reason}`, { status: 503 })
  }

  const { pathname, search } = request.nextUrl
  // The cloud sync run has no session: its routes check the SYNC_TOKEN themselves.
  if (isSyncRoute(pathname)) return NextResponse.next()
  const authenticated = await verifySessionToken(
    status.secret,
    request.cookies.get(SESSION_COOKIE)?.value
  )
  const isRead = request.method === "GET" || request.method === "HEAD"

  if (pathname === "/login") {
    return authenticated && isRead
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next()
  }
  if (authenticated) return NextResponse.next()

  if (!isRead) return new NextResponse("Unauthorized", { status: 401 })
  const login = new URL("/login", request.url)
  if (pathname !== "/") login.searchParams.set("next", pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  // Everything except Next's own static files and the app's icons and manifest (a phone fetches them without the session).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|apple-icon.png|icon-192.png|icon-512.png).*)",
  ],
}
