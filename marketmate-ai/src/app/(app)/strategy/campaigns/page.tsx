import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Campaign ideas" };

export default function Page() {
  return <ToolPage toolId="campaigns" path="/strategy/campaigns" />;
}
