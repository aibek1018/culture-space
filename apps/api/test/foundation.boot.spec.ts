import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { DataSource } from 'typeorm';

const requiredKeys = [
  'NODE_ENV',
  'API_PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'SESSION_SECRET',
  'APP_ORIGIN',
  'LOG_LEVEL',
] as const;

const closedPortEnv: Record<(typeof requiredKeys)[number], string> = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  DATABASE_URL:
    'postgresql://culturespace:culturespace@127.0.0.1:1/culturespace',
  REDIS_URL: 'redis://127.0.0.1:1',
  SESSION_SECRET: 'test-session-secret-with-enough-length',
  APP_ORIGIN: 'http://localhost:3000',
  LOG_LEVEL: 'info',
};

async function boot(env: Record<string, string>): Promise<INestApplication> {
  for (const key of requiredKeys) {
    const value = env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

describe('NestJS foundation boot', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('refuses to start when required variables are missing', async () => {
    for (const key of requiredKeys) {
      delete process.env[key];
    }

    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).rejects.toThrow(/Invalid environment/);
  });

  it('starts with a valid configuration and serves liveness without dependencies', async () => {
    app = await boot(closedPortEnv);

    const health = await request(app.getHttpServer()).get('/health');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
    expect(JSON.stringify(health.body)).not.toContain('postgresql://');

    const dataSource = app.get(DataSource);
    expect(dataSource.options.synchronize).toBe(false);
  });

  it('reports readiness failure when PostgreSQL and Redis cannot respond', async () => {
    app = await boot(closedPortEnv);

    const ready = await request(app.getHttpServer()).get('/ready');
    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({
      status: 'unavailable',
      checks: { postgres: 'down', redis: 'down' },
    });
    const serialized = JSON.stringify(ready.body);
    expect(serialized).not.toContain('postgresql://');
    expect(serialized).not.toContain('redis://');
    expect(serialized).not.toContain('culturespace:');
  });

  it('initializes the GraphQL schema and answers the temporary health query', async () => {
    app = await boot(closedPortEnv);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ foundationHealth }' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { foundationHealth: 'ok' } });
    expect(JSON.stringify(response.body)).not.toContain('cs.sid');
  });

  it('rejects public auth mutations when Redis cannot store abuse counters', async () => {
    app = await boot(closedPortEnv);
    const server = request(app.getHttpServer());

    const health = await server.post('/graphql').send({
      query: '{ foundationHealth }',
    });
    expect(health.body).toEqual({ data: { foundationHealth: 'ok' } });

    const login = await server
      .post('/graphql')
      .set('Origin', 'http://localhost:3000')
      .set('x-culturespace-client', 'web')
      .send({
        query: 'mutation($input: LoginInput!) { login(input: $input) { id } }',
        variables: {
          input: { email: 'person@example.com', password: 'correct-horse' },
        },
      });
    expect(login.status).toBe(200);
    expect(login.body.data?.login ?? null).toBeNull();
    expect(login.body.errors?.[0]?.extensions).toEqual({
      code: 'EXTERNAL_UNAVAILABLE',
      i18nKey: 'auth.rate_limit_unavailable',
    });

    const registration = await server
      .post('/graphql')
      .set('Origin', 'http://localhost:3000')
      .set('x-culturespace-client', 'web')
      .send({
        query:
          'mutation($input: RegisterInput!) { register(input: $input) { id } }',
        variables: {
          input: {
            username: 'reader_one',
            fullName: 'Reader One',
            email: 'person@example.com',
            password: 'correct-horse',
            preferredLanguage: 'EN',
          },
        },
      });
    expect(registration.body.data?.register ?? null).toBeNull();
    expect(registration.body.errors?.[0]?.extensions?.code).toBe(
      'EXTERNAL_UNAVAILABLE',
    );

    const reset = await server
      .post('/graphql')
      .set('Origin', 'http://localhost:3000')
      .set('x-culturespace-client', 'web')
      .send({
        query:
          'mutation($email: String!) { requestPasswordReset(email: $email) }',
        variables: { email: 'person@example.com' },
      });
    expect(reset.body.data?.requestPasswordReset ?? null).toBeNull();
    expect(reset.body.errors?.[0]?.extensions?.code).toBe(
      'EXTERNAL_UNAVAILABLE',
    );
    expect(JSON.stringify(reset.body)).not.toContain('person@example.com');
  }, 40000);
});
