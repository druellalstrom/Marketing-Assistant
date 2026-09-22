import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Hashtags" };

export default function Page() {
  return <ToolPage toolId="hashtags" path="/social/hashtags" />;
}
