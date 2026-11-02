import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { SESSION_KEY_PREFIX } from '../src/infrastructure/session/session.constants';
import { RedisService } from '../src/infrastructure/redis/redis.service';

const CLOSED_POSTGRES =
  'postgresql://culturespace:culturespace@127.0.0.1:1/culturespace';
const CLOSED_REDIS = 'redis://127.0.0.1:1';

async function boot(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

describe('readiness against PostgreSQL and Redis', () => {
  let app: INestApplication | undefined;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('returns success only when PostgreSQL and Redis both respond', async () => {
    app = await boot();

    const ready = await request(app.getHttpServer()).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({
      status: 'ok',
      checks: { postgres: 'up', redis: 'up' },
    });

    const dataSource = app.get(DataSource);
    expect(dataSource.options.synchronize).toBe(false);
    expect(dataSource.isInitialized).toBe(true);

    const redis = app.get(RedisService);
    const { RedisStore } = await import('connect-redis');
    const store = new RedisStore({
      client: redis.client,
      prefix: SESSION_KEY_PREFIX,
      ttl: 30,
    });
    const sessionId = 'foundation-integration';

    await new Promise<void>((resolve, reject) => {
      store.set(sessionId, { cookie: { originalMaxAge: 30000 } }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const stored = await new Promise<unknown>((resolve, reject) => {
      store.get(sessionId, (error, session) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(session);
      });
    });
    expect(stored).toEqual(
      expect.objectContaining({ cookie: { originalMaxAge: 30000 } }),
    );

    await new Promise<void>((resolve, reject) => {
      store.destroy(sessionId, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const graphql = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ foundationHealth }' });
    expect(graphql.status).toBe(200);
    expect(graphql.body).toEqual({ data: { foundationHealth: 'ok' } });
  });

  it('returns a failure status when PostgreSQL cannot respond', async () => {
    process.env.DATABASE_URL = CLOSED_POSTGRES;
    app = await boot();

    const ready = await request(app.getHttpServer()).get('/ready');
    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({
      status: 'unavailable',
      checks: { postgres: 'down', redis: 'up' },
    });
    expect(JSON.stringify(ready.body)).not.toContain('postgresql://');
  });

  it('returns a failure status when Redis cannot respond', async () => {
    process.env.REDIS_URL = CLOSED_REDIS;
    app = await boot();

    const ready = await request(app.getHttpServer()).get('/ready');
    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({
      status: 'unavailable',
      checks: { postgres: 'up', redis: 'down' },
    });
    expect(JSON.stringify(ready.body)).not.toContain('redis://');
  });
});
