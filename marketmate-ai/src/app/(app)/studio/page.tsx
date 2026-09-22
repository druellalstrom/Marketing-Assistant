import type { Metadata } from "next";
import Link from "next/link";
import { ToolPage } from "@/components/tool-page";
import { TOOL_DEFINITIONS, type ToolId } from "@/lib/ai/tool-definitions";

export const metadata: Metadata = { title: "Content studio" };

const STUDIO_TOOLS = ["product_description", "email", "blog_post", "ad_copy", "video_script"] as const satisfies readonly ToolId[];
type StudioTool = (typeof STUDIO_TOOLS)[number];

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const { tool } = await searchParams;
  const active: StudioTool = STUDIO_TOOLS.includes(tool as StudioTool) ? (tool as StudioTool) : "product_description";

  return (
    <ToolPage toolId={active} path="/studio">
      <nav className="-mt-2 mb-6 flex flex-wrap gap-2" aria-label="Content type">
        {STUDIO_TOOLS.map((id) => (
          <Link
            key={id}
            href={`/studio?tool=${id}`}
            aria-current={id === active ? "page" : undefined}
            className={id === active ? "btn-primary" : "btn-secondary"}
          >
            {TOOL_DEFINITIONS[id].title}
          </Link>
        ))}
      </nav>
    </ToolPage>
  );
}
