export interface MailContent {
  subject: string;
  text: string;
}

export function verificationEmail(input: {
  origin: string;
  language: 'en' | 'ru';
  rawToken: string;
}): MailContent {
  const url = actionUrl(
    input.origin,
    input.language,
    'verify-email',
    input.rawToken,
  );
  if (input.language === 'ru') {
    return {
      subject: 'Подтвердите адрес электронной почты',
      text: `Подтвердите аккаунт CULTURE SPACE:\n${url}\n\nСсылка действует 24 часа.`,
    };
  }
  return {
    subject: 'Verify your email',
    text: `Confirm your CULTURE SPACE account:\n${url}\n\nThis link expires in 24 hours.`,
  };
}

export function passwordResetEmail(input: {
  origin: string;
  language: 'en' | 'ru';
  rawToken: string;
}): MailContent {
  const url = actionUrl(
    input.origin,
    input.language,
    'reset-password',
    input.rawToken,
  );
  if (input.language === 'ru') {
    return {
      subject: 'Сброс пароля',
      text: `Сбросьте пароль CULTURE SPACE:\n${url}\n\nСсылка действует 1 час.`,
    };
  }
  return {
    subject: 'Reset your password',
    text: `Reset your CULTURE SPACE password:\n${url}\n\nThis link expires in 1 hour.`,
  };
}

function actionUrl(
  origin: string,
  language: 'en' | 'ru',
  path: string,
  rawToken: string,
): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/${language}/${path}?token=${encodeURIComponent(rawToken)}`;
}
