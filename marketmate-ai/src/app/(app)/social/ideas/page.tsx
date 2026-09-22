import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Content ideas" };

export default function Page() {
  return <ToolPage toolId="content_ideas" path="/social/ideas" />;
}
