import type { Locale } from '../locales.js';
import { publicMessagesDe } from './public.de.js';
import { publicMessagesEn } from './public.en.js';
import { publicMessagesEs } from './public.es.js';
import { publicMessagesFr } from './public.fr.js';
import { publicMessagesPtBr } from './public.pt-BR.js';

export const publicMessages = {
  'en-GB': publicMessagesEn,
  de: publicMessagesDe,
  fr: publicMessagesFr,
  es: publicMessagesEs,
  'pt-BR': publicMessagesPtBr,
} as const satisfies Record<Locale, Record<string, string>>;
