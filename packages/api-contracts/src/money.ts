import { z } from 'zod';
import { isSupportedCurrency } from '@oss-tips/domain/money';

/** Lowercase currency accepted for new payment/project inputs. */
export const SupportedCurrencySchema = z
  .string()
  .regex(/^[a-z]{3}$/)
  .refine((value) => isSupportedCurrency(value), 'Unsupported currency');

/** Money as string minor units (docs §1). */
export const MoneySchema = z.object({
  amount: z.string().regex(/^\d+$/).describe('Minor units as integer string'),
  currency: z
    .string()
    .regex(/^[a-z]{3}$/)
    .describe('ISO 4217 lowercase currency code'),
});

export type Money = z.infer<typeof MoneySchema>;

export const TimestampSchema = z.string().datetime({ offset: true });

export const IdSchema = z.string().min(1).describe('Stable opaque ID');

export const CursorPageSchema = z.object({
  data: z.array(z.unknown()),
  next_cursor: z.string().nullable(),
});
