import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { getPrimaryBusiness } from "@/lib/data/business";
import { requireAuth } from "@/lib/supabase/server";
import { AssistantChat } from "./chat";

export const metadata: Metadata = { title: "AI Marketing Assistant" };

export default async function AssistantPage() {
  const { supabase } = await requireAuth("/assistant");
  const [{ data }, business] = await Promise.all([
    supabase.from("assistant_messages").select("id, role, content").order("created_at", { ascending: true }).limit(200),
    getPrimaryBusiness(supabase),
  ]);

  return (
    <>
      <PageHeader
        title="AI Marketing Assistant"
        description="Your marketing department on call: pricing, strategy, captions, promotions, personas and campaign plans — with your business in mind."
      />
      <AssistantChat
        initial={(data ?? []) as { id: string; role: "user" | "assistant"; content: string }[]}
        aiConfigured={isAnthropicConfigured()}
        businessName={business?.name ?? null}
      />
    </>
  );
}
