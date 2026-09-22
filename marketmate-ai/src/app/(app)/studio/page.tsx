import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Content Creation Studio" };

export default function StudioPage() {
  return <ToolPage toolId="content" path="/studio" />;
}
