import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigService } from '../../config/app-config.service';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.nodeEnv === 'test' ? 'silent' : config.logLevel,
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.token',
              '*.password',
              '*.token',
              '*.sessionSecret',
            ],
            censor: '[Redacted]',
          },
          genReqId: (req: IncomingMessage, res: ServerResponse): string => {
            const header = req.headers['x-request-id'];
            const incoming = Array.isArray(header) ? header[0] : header;
            const requestId =
              incoming !== undefined && incoming.length > 0
                ? incoming
                : randomUUID();
            res.setHeader('x-request-id', requestId);
            return requestId;
          },
          transport:
            config.nodeEnv === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true },
                }
              : undefined,
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}
