import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import * as rootParams from 'next/root-params';
import { notFound } from 'next/navigation';
import en from './messages/en.json';
import ru from './messages/ru.json';
import { routing, type AppLocale } from './routing';

const catalogs: Record<AppLocale, typeof en> = {
  en,
  ru,
};

export default getRequestConfig(async ({ locale }) => {
  let resolvedLocale = locale;

  if (!resolvedLocale) {
    const paramValue = await rootParams.locale();
    if (hasLocale(routing.locales, paramValue)) {
      resolvedLocale = paramValue;
    } else {
      notFound();
    }
  }

  if (!hasLocale(routing.locales, resolvedLocale)) {
    notFound();
  }

  return {
    locale: resolvedLocale,
    messages: catalogs[resolvedLocale],
  };
});
