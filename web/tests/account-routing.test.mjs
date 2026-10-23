import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));

function authEnvironment(t) {
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: "https://auth.example",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    CARESIGNAL_PUBLIC_ORIGIN: "",
  };
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
    process.env[key] = value;
  }
}

function load(relative, mocks = {}) {
  const file = path.resolve(directory, "../src", relative);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = new Module(file);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  const realRequire = mod.require.bind(mod);
  mod.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : realRequire(id);
  mod._compile(compiled, file);
  return mod.exports;
}

const navigation = load("lib/account-navigation.ts");
const user = (metadata = {}, extra = {}) => ({
  id: "account-a",
  created_at: "2026-10-01T12:00:00Z",
  last_sign_in_at: "2026-10-23T12:00:00Z",
  app_metadata: { provider: "google" },
  user_metadata: metadata,
  ...extra,
});

test("returning Google, email, and legacy accounts open caregiver activity, not onboarding", () => {
  for (const intent of ["google", "signin", null]) {
    assert.equal(navigation.accountDestination(user(), intent, null), "/care-circle?view=activity");
  }
});

test("new accounts and explicitly unfinished accounts keep onboarding", () => {
  const fresh = user({}, { created_at: "2026-10-23T12:00:00Z" });
  assert.equal(navigation.accountDestination(fresh, "google", null), "/onboarding");
  assert.equal(navigation.accountDestination(fresh, null, null), "/onboarding", "Site URL fallback retains new Google detection");
  assert.equal(navigation.accountDestination(user(), "signup", null), "/onboarding");
  assert.equal(navigation.accountDestination(user({ caresignal_onboarding_completed: false }), "google", null), "/onboarding");
});

test("completed caregiver and receiver roles override signup or recent account creation", () => {
  for (const role of ["caregiver", "receiver"]) {
    const account = user({ caresignal_role: role, caresignal_onboarding_completed: true });
    const resolved = navigation.completedAccountRole(account);
    assert.equal(resolved, role);
    assert.equal(navigation.accountDestination(account, "signup", resolved), role === "receiver" ? "/onboarding/my-day" : "/care-circle?view=activity");
  }
});

test("browser completion is account-scoped; generic demo setup and other accounts are ignored", () => {
  const data = new Map([
    ["caresignal-setup-v1", '{"caregiverName":"Demo User"}'],
    ["caresignal-receiver-v1", '{"completed":true}'],
    [navigation.accountSetupKey("account-a"), '"receiver"'],
  ]);
  const storage = { getItem: (key) => data.get(key) ?? null };
  assert.equal(navigation.completedAccountRole(user(), storage), "receiver");
  assert.equal(navigation.completedAccountRole(user({}, { id: "account-b" }), storage), null);
  assert.equal(navigation.completedAccountRole(user({ caresignal_role: "admin", caresignal_onboarding_completed: true })), null);
  data.set(navigation.accountSetupKey("account-a"), '"invalid-role"');
  assert.throws(() => navigation.completedAccountRole(user(), storage), /saved account role is invalid/);
  data.set(navigation.accountSetupKey("account-a"), "{");
  assert.throws(() => navigation.completedAccountRole(user(), storage), SyntaxError);
});

test("callback exchanges cookies, preserves recovery, rejects arbitrary destinations, and reports failures", async (t) => {
  authEnvironment(t);
  let exchangeFails = false;
  let exchanges = 0;
  const callback = load("app/auth/callback/route.ts", {
    "next/headers": { cookies: async () => ({ getAll: () => [] }) },
    "@supabase/ssr": {
      createServerClient: (_url, _key, options) => ({
        auth: {
          exchangeCodeForSession: async () => {
            exchanges++;
            if (exchangeFails) return { error: { code: "expired", status: 400 } };
            options.cookies.setAll([{ name: "test-session", value: "test-value", options: { path: "/", httpOnly: true } }]);
            return { error: null };
          },
        },
      }),
    },
  });
  for (const origin of ["http://localhost:3000", "https://app.example", "https://test.trycloudflare.com"]) {
    for (const intent of ["", "&intent=google", "&intent=signup", "&intent=https://evil.example"]) {
      const response = await callback.GET(new Request(`${origin}/auth/callback?code=test${intent}`));
      const expected = intent === "&intent=google" || intent === "&intent=signup" ? `?${intent.slice(1)}` : "";
      assert.equal(response.headers.get("location"), `${origin}/auth/continue${expected}`);
      assert.match(response.headers.get("set-cookie"), /test-session=/);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
  const recovery = await callback.GET(new Request("http://localhost:3000/auth/callback?code=test&next=recovery&intent=google"));
  assert.equal(recovery.headers.get("location"), "http://localhost:3000/account?password=update");
  const external = await callback.GET(new Request("http://localhost:3000/auth/callback?code=test&next=https://evil.example"));
  assert.equal(external.headers.get("location"), "http://localhost:3000/auth/continue");
  const before = exchanges;
  for (const query of ["", "?code=test&error=access_denied"]) {
    const response = await callback.GET(new Request(`http://localhost:3000/auth/callback${query}`));
    assert.equal(response.headers.get("location"), "http://localhost:3000/account?auth=failed");
  }
  assert.equal(exchanges, before);
  exchangeFails = true;
  t.mock.method(console, "error", () => {});
  const failed = await callback.GET(new Request("http://localhost:3000/auth/callback?code=test"));
  assert.equal(failed.headers.get("location"), "http://localhost:3000/account?auth=failed");
  assert.equal(failed.headers.get("set-cookie"), null);
});

test("marketing root forwards callback codes and errors before rendering the website", async () => {
  const root = load("app/(shell)/page.tsx", {
    "@/components/ProductWebsite": { ProductWebsite: () => null },
    "next/navigation": { redirect: (href) => { throw new Error(href); } },
  }).default;
  const expectRedirect = (query, expected) => assert.rejects(root({ searchParams: Promise.resolve(query) }), { message: expected });
  await expectRedirect({ code: "a+b/c=", signin: "1" }, "/auth/callback?code=a%2Bb%2Fc%3D");
  await expectRedirect({ error: "access_denied" }, "/auth/callback?error=access_denied");
  await expectRedirect({ code: "abc", next: "recovery" }, "/auth/callback?code=abc&next=recovery");
  await expectRedirect({ code: "abc", intent: "google", next: "https://evil.example" }, "/auth/callback?code=abc&intent=google");
  await expectRedirect({ signin: "1" }, "/welcome?signin=1");
  assert.ok(await root({ searchParams: Promise.resolve({}) }));
});

test("finishing setup persists only routing flags, without granting household permissions", async (t) => {
  authEnvironment(t);
  const saved = new Map();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: (key, value) => saved.set(key, value) } });
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  });
  let session = { user: user() };
  let updates = [];
  let updateError = null;
  const profile = load("lib/account-profile.ts", {
    "./account-navigation": navigation,
    "./supabase-browser": {
      supabaseBrowser: () => ({
        auth: {
          getSession: async () => ({ data: { session }, error: null }),
          updateUser: async (value) => { updates.push(value); return { error: updateError }; },
        },
      }),
    },
  });
  await profile.completeAccountOnboarding("receiver");
  assert.equal(saved.get(navigation.accountSetupKey("account-a")), '"receiver"');
  assert.deepEqual(updates, [{ data: { caresignal_role: "receiver", caresignal_onboarding_completed: true } }]);
  updateError = new Error("Account service unavailable");
  await assert.rejects(profile.completeAccountOnboarding("caregiver"), /Account service unavailable/);
  updates = [];
  session = null;
  await profile.completeAccountOnboarding("caregiver");
  assert.deepEqual(updates, [], "Unauthenticated demo setup does not mutate an account");
});
