import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Repurpose content" };

export default function Page() {
  return <ToolPage toolId="repurpose" path="/social/repurpose" />;
}
