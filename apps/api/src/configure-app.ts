import type { INestApplication, ValidationError } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppConfigService } from './config/app-config.service';
import { DomainError } from './common/errors/domain-error';

export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.appOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-culturespace-client', 'x-request-id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
      exceptionFactory: (errors: ValidationError[]) =>
        new DomainError(
          'VALIDATION',
          'validation.invalid',
          firstValidationMessage(errors),
        ),
    }),
  );
}

function firstValidationMessage(errors: ValidationError[]): string {
  const messages: string[] = [];
  const walk = (items: ValidationError[]): void => {
    for (const item of items) {
      if (item.constraints) {
        messages.push(...Object.values(item.constraints));
      }
      if (item.children !== undefined && item.children.length > 0) {
        walk(item.children);
      }
    }
  };
  walk(errors);
  return messages[0] ?? 'Invalid input';
}
