import { z } from 'zod';
import { IdSchema, MoneySchema, SupportedCurrencySchema, TimestampSchema } from './money.js';

export const PublicSupportOptionsSchema = z
  .object({
    showName: z.boolean(),
    showAmount: z.boolean(),
    showMessage: z.boolean(),
    displayName: z.string().trim().min(1).max(120).optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.showName && value.displayName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['displayName'],
        message: 'Display name requires showName',
      });
    }
    if (!value.showMessage && value.message) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['message'],
        message: 'Message requires showMessage',
      });
    }
    if (value.message && /(?:https?|ftp|javascript|data):|www\./i.test(value.message)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['message'],
        message: 'Message must not contain links',
      });
    }
  });

export const CadenceSchema = z.enum(['one_off', 'monthly', 'annual']);

export const CheckoutIntentRequestSchema = z
  .object({
    tierId: z.string().min(1).optional(),
    projectAmountMinor: z.number().int().safe().positive(),
    projectCurrency: SupportedCurrencySchema,
    platformTipMinor: z.number().int().safe().min(0),
    cadence: CadenceSchema,
    publicOptions: PublicSupportOptionsSchema,
    receiptEmail: z.string().trim().email().max(320).optional(),
  })
  .strict();

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
