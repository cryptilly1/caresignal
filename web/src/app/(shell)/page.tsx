import { ProductWebsite } from "@/components/ProductWebsite";
import { redirect } from "next/navigation";

export default async function WebsitePage({ searchParams }: {
  searchParams: Promise<{ signin?: string; code?: string; error?: string; intent?: string; next?: string }>;
}) {
  const query = await searchParams;
  if (query.code || query.error) {
    const callback = new URLSearchParams();
    if (query.code) callback.set("code", query.code);
    if (query.error) callback.set("error", query.error);
    if (query.intent === "google" || query.intent === "signup") callback.set("intent", query.intent);
    if (query.next === "recovery") callback.set("next", "recovery");
    redirect(`/auth/callback?${callback}`);
  }
  if (query.signin === "1") redirect("/welcome?signin=1");
  return <ProductWebsite />;
}
