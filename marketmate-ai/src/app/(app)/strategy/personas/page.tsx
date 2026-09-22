import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";

export const metadata: Metadata = { title: "Customer personas" };

export default function Page() {
  return <ToolPage toolId="personas" path="/strategy/personas" />;
}
