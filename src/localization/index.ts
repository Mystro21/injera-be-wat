import { en, TranslationKey } from './en';
export type Locale = 'en' | 'am';
const dictionaries = { en, am: en };
export const t = (key: TranslationKey, locale: Locale = 'en') => dictionaries[locale][key];
