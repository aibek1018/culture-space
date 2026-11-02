import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  const config = app.get(AppConfigService);
  await app.listen(config.apiPort);
}

bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Application failed to start';
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
