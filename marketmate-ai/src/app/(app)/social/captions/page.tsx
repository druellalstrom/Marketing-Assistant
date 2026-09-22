import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Captions" };

export default function Page() {
  return <ToolPage toolId="caption" path="/social/captions" />;
}
