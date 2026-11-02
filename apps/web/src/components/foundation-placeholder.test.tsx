/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import en from '../i18n/messages/en.json';
import ru from '../i18n/messages/ru.json';
import { FoundationPlaceholder } from './foundation-placeholder';

function languages() {
  return [
    { code: 'en', href: '/en', label: 'English' },
    { code: 'ru', href: '/ru', label: 'Русский' },
  ] as const;
}

describe('FoundationPlaceholder', () => {
  it('identifies CULTURE SPACE in English and links both languages', () => {
    render(
      <FoundationPlaceholder
        title={en.foundation.title}
        status={en.foundation.status}
        description={en.foundation.description}
        languageLabel={en.foundation.language}
        currentLocale="en"
        languages={languages()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'CULTURE SPACE' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The application foundation is running.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute(
      'href',
      '/en',
    );
    expect(screen.getByRole('link', { name: 'Русский' })).toHaveAttribute(
      'href',
      '/ru',
    );
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('renders the Russian foundation status', () => {
    render(
      <FoundationPlaceholder
        title={ru.foundation.title}
        status={ru.foundation.status}
        description={ru.foundation.description}
        languageLabel={ru.foundation.language}
        currentLocale="ru"
        languages={languages()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'CULTURE SPACE' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Фундамент приложения запущен.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Язык' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Русский' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
