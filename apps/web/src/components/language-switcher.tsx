export interface LanguageOption {
  code: string;
  href: string;
  label: string;
}

interface LanguageSwitcherProps {
  label: string;
  currentLocale: string;
  options: readonly LanguageOption[];
}

export function LanguageSwitcher({
  label,
  currentLocale,
  options,
}: LanguageSwitcherProps) {
  return (
    <nav
      aria-label={label}
      className="mt-10 flex w-full flex-col gap-3 sm:flex-row"
    >
      {options.map((option) => {
        const current = option.code === currentLocale;
        return (
          <a
            key={option.code}
            href={option.href}
            hrefLang={option.code}
            aria-current={current ? 'page' : undefined}
            className={
              current
                ? 'inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50'
                : 'inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800'
            }
          >
            {option.label}
          </a>
        );
      })}
    </nav>
  );
}
