import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import { RedisService } from './redis.service';

const WINDOW_SECONDS = {
  login: 15 * 60,
  registration: 60 * 60,
  passwordReset: 60 * 60,
  graphql: 60,
} as const;

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async assertLoginAllowed(email: string, ip: string): Promise<void> {
    const emailCount = await this.guard(() =>
      this.read(this.loginEmailKey(email)),
    );
    const ipCount = await this.guard(() => this.read(this.loginIpKey(ip)));
    if (emailCount >= 5 || ipCount >= 20) {
      throw new DomainError(
        'RATE_LIMITED',
        'auth.rate_limited',
        'Too many attempts. Try again later',
      );
    }
  }

  async recordLoginFailure(email: string, ip: string): Promise<void> {
    await this.guard(() =>
      this.increment(this.loginEmailKey(email), WINDOW_SECONDS.login),
    );
    await this.guard(() =>
      this.increment(this.loginIpKey(ip), WINDOW_SECONDS.login),
    );
  }

  async assertRegistrationAllowed(ip: string): Promise<void> {
    const count = await this.guard(() =>
      this.increment(this.key(`register:${ip}`), WINDOW_SECONDS.registration),
    );
    if (count > 5) {
      throw new DomainError(
        'RATE_LIMITED',
        'auth.rate_limited',
        'Too many attempts. Try again later',
      );
    }
  }

  /**
   * Counts the request and reports whether another reset email may be sent.
   * Callers still return success when the counter is over the cap, so the
   * response does not reveal the account. A Redis failure is not a cap hit:
   * it rejects the call before an email is created.
   */
  async passwordResetAllowed(email: string): Promise<boolean> {
    const count = await this.guard(() =>
      this.increment(this.key(`reset:${email}`), WINDOW_SECONDS.passwordReset),
    );
    return count <= 3;
  }

  async consumeGraphql(ip: string): Promise<void> {
    const count = await this.increment(
      this.key(`gql:${ip}`),
      WINDOW_SECONDS.graphql,
    );
    if (count > 300) {
      throw new DomainError(
        'RATE_LIMITED',
        'auth.rate_limited',
        'Too many requests. Try again later',
      );
    }
  }

  private loginEmailKey(email: string): string {
    return this.key(`login:email:${email}`);
  }

  private loginIpKey(ip: string): string {
    return this.key(`login:ip:${ip}`);
  }

  private key(suffix: string): string {
    const prefix = process.env.RATE_LIMIT_PREFIX ?? 'rl:';
    return `${prefix}${suffix}`;
  }

  private async increment(key: string, windowSeconds: number): Promise<number> {
    await this.ensureConnected();
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, windowSeconds);
    }
    return count;
  }

  private async read(key: string): Promise<number> {
    await this.ensureConnected();
    const value = await this.redis.client.get(key);
    if (value === null) {
      return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.client.isOpen) {
      return;
    }
    try {
      await this.redis.client.connect();
    } catch (error) {
      if (this.redis.client.isOpen) {
        return;
      }
      throw error;
    }
  }

  /**
   * Login, registration, and password-reset counters are closed when Redis
   * cannot store them. The global GraphQL counter stays a raw Redis error so
   * the interceptor can keep read queries available.
   */
  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw new DomainError(
        'EXTERNAL_UNAVAILABLE',
        'auth.rate_limit_unavailable',
        'Abuse protection is temporarily unavailable',
      );
    }
  }
}
