import { redirect } from "next/navigation";

/** Legacy check-in route → tablet / Show recipient cards */
export default function HomeRedirect() {
  redirect("/recipient");
}
