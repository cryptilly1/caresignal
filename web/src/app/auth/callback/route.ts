import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

function callbackOrigin(request: Request): string {
  const fallback = new URL(request.url).origin;
  const configured = process.env.CARESIGNAL_PUBLIC_ORIGIN;
  if (!configured) return fallback;
  const trusted = new URL(configured);
  if (trusted.protocol !== "https:" || trusted.username || trusted.password ||
    trusted.pathname !== "/" || trusted.search || trusted.hash) {
    throw new Error("CARESIGNAL_PUBLIC_ORIGIN must be an HTTPS origin without a path or credentials.");
  }
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  return host === trusted.host || forwardedHost === trusted.host ? trusted.origin : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = callbackOrigin(request);
  const code = url.searchParams.get("code");
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const failure = () => NextResponse.redirect(new URL("/account?auth=failed", origin));
  if (!code || !project || !key || url.searchParams.has("error")) return failure();
  const { cookies } = await import("next/headers");
  const incoming = await cookies();
  const intent = url.searchParams.get("intent");
  const destination = new URL("/auth/continue", origin);
  if (intent === "google" || intent === "signup") destination.searchParams.set("intent", intent);
  const response = NextResponse.redirect(new URL(
    url.searchParams.get("next") === "recovery" ? "/account?password=update" : destination.href,
    origin,
  ));
  response.headers.set("Cache-Control", "no-store");
  const supabase = createServerClient(project, key, {
    cookies: {
      getAll: () => incoming.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Account code exchange failed", { code: error.code, status: error.status });
      return failure();
    }
    return response;
  } catch {
    console.error("Account code exchange could not be completed.");
    return failure();
  }
}
