import { ProductWebsite } from "@/components/ProductWebsite";
import { redirect } from "next/navigation";

export default async function WebsitePage({ searchParams }: {
  searchParams: Promise<{ signin?: string }>;
}) {
  if ((await searchParams).signin === "1") redirect("/welcome?signin=1");
  return <ProductWebsite />;
}
