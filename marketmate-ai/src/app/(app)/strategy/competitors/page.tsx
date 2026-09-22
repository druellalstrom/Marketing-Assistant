import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Competitor analysis" };

export default function Page() {
  return <ToolPage toolId="competitor_analysis" path="/strategy/competitors" />;
}
