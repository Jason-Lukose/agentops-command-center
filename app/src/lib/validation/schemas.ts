import { z } from "zod";

// Reusable JSON value schema (mirrors JsonValue in types.ts).
export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

export const stepTypeSchema = z.enum(["llm_prompt", "tool_api", "transform", "approval", "eval"]);

export const workflowStepInputSchema = z.object({
  type: stepTypeSchema,
  name: z.string().min(1, "step name is required"),
  config: jsonValueSchema.default({}),
});

export const workflowCreateSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  steps: z.array(workflowStepInputSchema).min(1, "at least one step is required"),
});

export const workflowUpdateSchema = workflowCreateSchema;

export const runCreateSchema = z.object({
  workflowId: z.string().min(1),
  input: jsonValueSchema.optional().default({}),
});

export const runListQuerySchema = z.object({
  workflowId: z.string().optional(),
  status: z.enum(["queued", "running", "awaiting_approval", "succeeded", "failed", "canceled"]).optional(),
  // API_SPEC.md documents limit as "default 50, max 200" — clamp rather than
  // reject out-of-range values (min 1, max 200) so callers passing an
  // oversized limit still get a bounded, useful response.
  limit: z.coerce
    .number()
    .int()
    .optional()
    .default(50)
    .transform((n) => Math.min(200, Math.max(1, n))),
});

export const approvalActionSchema = z.object({
  note: z.string().optional(),
});

export const evaluationListQuerySchema = z.object({
  workflowId: z.string().optional(),
  runId: z.string().optional(),
  evaluatorType: z.enum(["deterministic", "rubric", "llm_judge"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export const dashboardQuerySchema = z.object({
  workflowId: z.string().optional(),
});
