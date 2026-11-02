import { randomBytes } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { assertPasswordPolicy } from '../../common/security/password-policy';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(
      randomBytes(32).toString('base64url'),
      ARGON2_OPTIONS,
    );
  }

  async hash(password: string): Promise<string> {
    assertPasswordPolicy(password);
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  /**
   * Missing accounts still pay for one Argon2 verification so the response
   * time does not show whether the email exists.
   */
  async verify(hash: string | null, password: string): Promise<boolean> {
    if (hash === null) {
      await argon2.verify(this.dummyHash, password);
      return false;
    }
    return argon2.verify(hash, password);
  }
}
