import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_CONFIG, AppConfigService } from './app-config.service';
import { validateEnv, type AppConfig } from './env.schema';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: process.env.JEST_WORKER_ID !== undefined,
      envFilePath: ['.env', '../../.env'],
    }),
  ],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => validateEnv({ ...process.env }),
    },
    AppConfigService,
  ],
  exports: [APP_CONFIG, AppConfigService],
})
export class AppConfigModule {}
