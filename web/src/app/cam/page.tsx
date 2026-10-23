import { redirect } from "next/navigation";

/** Instant static camera page — no React hydration hang on mobile tunnels. */
export default function CamPage() {
  redirect("/phone-cam.html");
}
