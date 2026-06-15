import { redirect } from "next/navigation";

// The product is the unified platform shell at /demo. The root just enters it, so a single shared
// link lands on the platform with the live demo embedded.
export default function Home() {
  redirect("/demo");
}
