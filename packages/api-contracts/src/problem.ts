import { z } from 'zod';

/** RFC 9457 Problem Details (docs §1). */
export const ProblemDetailsSchema = z.object({
  type: z.string().url().or(z.literal('about:blank')).default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const RateLimitProblemSchema = ProblemDetailsSchema.extend({
  retry_after: z.number().int().optional(),
});
