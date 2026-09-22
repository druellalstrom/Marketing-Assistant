import { z } from "zod";
import { getTool, isToolId, type ToolDefinition, type ToolId } from "./tool-definitions";

/** Hard cap for any free-text field, even if a definition forgets maxLength. */
const DEFAULT_MAX_LENGTH = 4000;

/** Builds a strict zod schema from a tool's field definitions. */
export function schemaForTool(tool: ToolDefinition) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of tool.fields) {
    let s: z.ZodType;
    if (field.type === "select" && field.options) {
      s = z.enum(field.options as unknown as [string, ...string[]], `Choose a valid ${field.label.toLowerCase()}.`);
    } else if (field.type === "checkboxes" && field.options) {
      // Sent as a comma-separated list; every item must be one of the options.
      const allowed = new Set(field.options);
      s = z
        .string()
        .max(1000)
        .refine(
          (v) => v.split(",").map((x) => x.trim()).filter(Boolean).every((x) => allowed.has(x)),
          `${field.label} contains an invalid choice.`,
        );
      if (field.required) {
        s = s.refine((v) => (v as string).trim() !== "", `Choose at least one option for ${field.label.toLowerCase()}.`);
      }
    } else {
      const max = field.maxLength ?? DEFAULT_MAX_LENGTH;
      s = z.string().trim().max(max, `${field.label} must be ${max} characters or fewer.`);
      if (field.required) {
        s = (s as z.ZodString).min(1, `${field.label} is required.`);
      }
    }
    shape[field.name] = field.required ? s : s.optional().or(z.literal(""));
  }
  return z.object(shape).strict();
}

const requestSchema = z.object({
  tool: z.string(),
  input: z.record(z.string(), z.unknown()),
});

export type ValidatedRequest =
  | { ok: true; toolId: ToolId; input: Record<string, string> }
  | { ok: false; error: string };

/** Validates an /api/ai/generate request body. Unknown tools and fields are rejected. */
export function validateGenerateRequest(body: unknown): ValidatedRequest {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Request must include `tool` and `input`." };
  if (!isToolId(parsed.data.tool)) return { ok: false, error: `Unknown tool "${parsed.data.tool}".` };

  const toolId = parsed.data.tool;
  const result = schemaForTool(getTool(toolId)).safeParse(parsed.data.input);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => i.message).join(" ") };
  }
  const input: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.data)) {
    if (typeof v === "string" && v !== "") input[k] = v;
  }
  return { ok: true, toolId, input };
}
