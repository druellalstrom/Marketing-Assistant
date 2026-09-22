import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Audience analysis" };

export default function Page() {
  return <ToolPage toolId="audience_analysis" path="/strategy/audience" />;
}
