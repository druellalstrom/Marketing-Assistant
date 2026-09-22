import type { Metadata } from "next";
import { SectionHub } from "@/components/section-hub";
import { TOOL_DEFINITIONS as T } from "@/lib/ai/tool-definitions";

export const metadata: Metadata = { title: "Marketing Strategy" };

export default function StrategyHub() {
  return (
    <SectionHub
      title="Marketing Strategy"
      description="Understand your customers and plan how to reach them."
      links={[
        { href: "/strategy/audience", title: T.audience_analysis.title, description: T.audience_analysis.description },
        { href: "/strategy/personas", title: T.personas.title, description: T.personas.description },
        { href: "/strategy/plan", title: T.marketing_plan.title, description: T.marketing_plan.description },
        { href: "/strategy/campaigns", title: T.campaigns.title, description: T.campaigns.description },
      ]}
    />
  );
}
