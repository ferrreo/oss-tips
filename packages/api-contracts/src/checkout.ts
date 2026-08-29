import { z } from 'zod';
import { IdSchema, MoneySchema, TimestampSchema } from './money.js';

export const PublicSupportOptionsSchema = z.object({
  showName: z.boolean(),
  showAmount: z.boolean(),
  showMessage: z.boolean(),
});

export const CadenceSchema = z.enum(['one_off', 'monthly', 'annual']);

export const CheckoutIntentRequestSchema = z.object({
  tierId: z.string().optional(),
  projectAmountMinor: z.number().int().positive(),
  projectCurrency: z.string().length(3),
  platformTipMinor: z.number().int().min(0),
  cadence: CadenceSchema,
  publicOptions: PublicSupportOptionsSchema,
});

export type CheckoutIntentRequest = z.infer<typeof CheckoutIntentRequestSchema>;

export const CheckoutIntentResponseSchema = z.object({
  id: IdSchema,
  client_secret: z.string().nullable(),
  checkout_url: z.string().url().nullable(),
  expires_at: TimestampSchema,
  application_fee: MoneySchema,
  customer_charge: MoneySchema,
  mode: z.enum(['payment', 'subscription']),
});

export type CheckoutIntentResponse = z.infer<typeof CheckoutIntentResponseSchema>;
