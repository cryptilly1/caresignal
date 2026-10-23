import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const failure = () => NextResponse.redirect(new URL("/account?auth=failed", url.origin));
  if (!code || !project || !key || url.searchParams.has("error")) return failure();
  const { cookies } = await import("next/headers");
  const incoming = await cookies();
  const response = NextResponse.redirect(new URL(
    url.searchParams.get("next") === "recovery" ? "/account?password=update" : "/account",
    url.origin,
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
    if (error) return failure();
    return response;
  } catch {
    return failure();
  }
}
