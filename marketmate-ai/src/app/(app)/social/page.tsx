import type { Metadata } from "next";
import { SectionHub } from "@/components/section-hub";
import { TOOL_DEFINITIONS as T } from "@/lib/ai/tool-definitions";

export const metadata: Metadata = { title: "Social Media Center" };

export default function SocialHub() {
  return (
    <SectionHub
      title="Social Media Center"
      description="Everything you need to plan and write social posts."
      links={[
        { href: "/social/captions", title: T.caption.title, description: T.caption.description },
        { href: "/social/hashtags", title: T.hashtags.title, description: T.hashtags.description },
        { href: "/social/ideas", title: T.content_ideas.title, description: T.content_ideas.description },
        { href: "/social/repurpose", title: T.repurpose.title, description: T.repurpose.description },
        { href: "/social/calendar", title: "Content calendar", description: "Plan what goes out, where, and when." },
      ]}
    />
  );
}
