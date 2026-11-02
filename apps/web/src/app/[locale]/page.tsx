import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FoundationPlaceholder } from '@/components/foundation-placeholder';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'foundation' });

  return (
    <FoundationPlaceholder
      title={t('title')}
      status={t('status')}
      description={t('description')}
      languageLabel={t('language')}
      currentLocale={locale}
      languages={routing.locales.map((code) => ({
        code,
        href: getPathname({ href: '/', locale: code }),
        label: t(`locales.${code}`),
      }))}
    />
  );
}
