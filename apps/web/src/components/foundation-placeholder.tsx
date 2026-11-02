import { LanguageSwitcher, type LanguageOption } from './language-switcher';

interface FoundationPlaceholderProps {
  title: string;
  status: string;
  description: string;
  languageLabel: string;
  currentLocale: string;
  languages: readonly LanguageOption[];
}

export function FoundationPlaceholder({
  title,
  status,
  description,
  languageLabel,
  currentLocale,
  languages,
}: FoundationPlaceholderProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-8 sm:py-20">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500 sm:text-sm">
        {title}
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
        {title}
      </h1>
      <p className="mt-6 text-base leading-7 text-stone-700 sm:text-lg">
        {status}
      </p>
      <p className="mt-3 max-w-prose text-sm leading-6 text-stone-600 sm:text-base">
        {description}
      </p>
      <LanguageSwitcher
        label={languageLabel}
        currentLocale={currentLocale}
        options={languages}
      />
    </main>
  );
}
