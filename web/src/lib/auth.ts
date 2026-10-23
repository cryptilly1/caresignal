import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "caresignal_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const MIN_SECRET_LENGTH = 32;

type AuthConfig = {
  password: string | null;
  configured: boolean;
  required: boolean;
  error?: string;
};

function isLocalDevelopmentRequest(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const loopbackHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  return !!host && loopbackHost.test(host) &&
    loopbackHost.test(new URL(request.url).host) &&
    (!forwardedHost || loopbackHost.test(forwardedHost)) &&
    !request.headers.has("forwarded") &&
    !request.headers.has("cf-ray") &&
    !request.headers.has("cf-connecting-ip");
}

function appAuthConfig(request?: Request): AuthConfig {
  if (request && isLocalDevelopmentRequest(request)) {
    return { password: null, configured: true, required: false };
  }
  const password = process.env.CARESIGNAL_APP_PASSWORD?.trim() || null;
  if (password && password.length >= MIN_SECRET_LENGTH) {
    return { password, configured: true, required: true };
  }
  return {
    password: null,
    configured: false,
    required: true,
    error: password
      ? `CARESIGNAL_APP_PASSWORD must be at least ${MIN_SECRET_LENGTH} characters.`
      : "Set CARESIGNAL_APP_PASSWORD to enable caregiver access.",
  };
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function sessionSignature(password: string, expiresAt: string, nonce: string) {
  return createHmac("sha256", password)
    .update(`caresignal-session-v1.${expiresAt}.${nonce}`)
    .digest("base64url");
}

function cookieValue(request: Request): string | null {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  const cookie = cookies.find((part) => part.trim().startsWith(`${SESSION_COOKIE}=`));
  return cookie
    ? cookie.trim().slice(SESSION_COOKIE.length + 1)
    : null;
}

export function isCaregiverSessionValid(request: Request): boolean {
  const config = appAuthConfig(request);
  if (!config.required) return true;
  if (!config.password) return false;

  const value = cookieValue(request);
  if (!value) return false;
  const [expiresAt, nonce, signature, ...extra] = value.split(".");
  if (!expiresAt || !nonce || !signature || extra.length) return false;
  const expiry = Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now()) return false;

  return safeEqual(
    signature,
    sessionSignature(config.password, expiresAt, nonce),
  );
}

export function caregiverAuthStatus(request: Request) {
  const config = appAuthConfig(request);
  return {
    authenticated: config.configured && isCaregiverSessionValid(request),
    required: config.required,
    configured: config.configured,
    error: config.error,
  };
}

export function createCaregiverSessionResponse() {
  const config = appAuthConfig();
  if (!config.configured || !config.password) {
    return NextResponse.json(
      { error: config.error ?? "Caregiver authentication is not configured." },
      { status: 503 },
    );
  }

  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const nonce = randomBytes(16).toString("base64url");
  const signature = sessionSignature(config.password, expiresAt, nonce);
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(
    SESSION_COOKIE,
    `${expiresAt}.${nonce}.${signature}`,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  );
  return response;
}

export function caregiverLoginResponse(password: unknown) {
  const config = appAuthConfig();
  if (!config.configured || !config.password) {
    return NextResponse.json(
      { error: config.error ?? "Caregiver authentication is not configured." },
      { status: 503 },
    );
  }
  if (typeof password !== "string" || password.length > 256) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }
  if (!safeEqual(password, config.password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  return createCaregiverSessionResponse();
}

export function clearCaregiverSessionResponse() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function requireCaregiverSession(request: Request): NextResponse | null {
  const config = appAuthConfig(request);
  if (!config.configured) {
    return NextResponse.json(
      { error: config.error ?? "Caregiver authentication is not configured." },
      { status: 503 },
    );
  }
  if (!isCaregiverSessionValid(request)) {
    return NextResponse.json(
      { error: "Caregiver authentication required." },
      { status: 401 },
    );
  }
  return null;
}

export function requireMcpToken(request: Request): NextResponse | null {
  const token = process.env.CARESIGNAL_MCP_TOKEN?.trim();
  if (!token && isLocalDevelopmentRequest(request)) return null;
  if (!token || token.length < MIN_SECRET_LENGTH) {
    return NextResponse.json(
      {
        error: `Set CARESIGNAL_MCP_TOKEN to a secret of at least ${MIN_SECRET_LENGTH} characters.`,
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !safeEqual(match[1], token)) {
    return NextResponse.json({ error: "MCP bearer token required." }, { status: 401 });
  }
  return null;
}
