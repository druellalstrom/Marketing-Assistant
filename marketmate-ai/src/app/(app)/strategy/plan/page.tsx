import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Marketing plan" };

export default function Page() {
  return <ToolPage toolId="marketing_plan" path="/strategy/plan" />;
}
