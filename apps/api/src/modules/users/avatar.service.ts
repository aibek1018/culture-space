import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import {
  STORAGE_PORT,
  type StoragePort,
} from '../../infrastructure/storage/storage.port';
import type { AccountView } from './profile.service';
import { ProfileService } from './profile.service';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadIntentView {
  uploadUrl: string;
  objectKey: string;
  expiresAt: Date;
}

@Injectable()
export class AvatarService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly profiles: ProfileService,
  ) {}

  async requestUpload(
    userId: string,
    input: { contentType: string; byteSize: number },
  ): Promise<UploadIntentView> {
    this.assertUpload(input.contentType, input.byteSize);
    const objectKey = `${userId}/${randomUUID()}`;
    try {
      const presigned = await this.storage.createPresignedPut({
        objectKey,
        contentType: input.contentType,
        byteSize: input.byteSize,
      });
      return {
        uploadUrl: presigned.uploadUrl,
        objectKey,
        expiresAt: presigned.expiresAt,
      };
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw new DomainError(
        'EXTERNAL_UNAVAILABLE',
        'storage.unavailable',
        'File storage is unavailable',
      );
    }
  }

  async confirmUpload(userId: string, objectKey: string): Promise<AccountView> {
    if (!objectKey.startsWith(`${userId}/`) || objectKey.includes('..')) {
      throw new DomainError(
        'FORBIDDEN',
        'storage.invalid_upload',
        'That upload does not belong to this account',
      );
    }
    let stat: { contentType: string | null; byteSize: number | null } | null;
    try {
      stat = await this.storage.statObject(objectKey);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw new DomainError(
        'EXTERNAL_UNAVAILABLE',
        'storage.unavailable',
        'File storage is unavailable',
      );
    }
    if (!stat) {
      throw new DomainError(
        'NOT_FOUND',
        'storage.not_uploaded',
        'The uploaded file was not found',
      );
    }
    if (stat.contentType === null || !ALLOWED_TYPES.has(stat.contentType)) {
      throw new DomainError(
        'VALIDATION',
        'storage.invalid_upload',
        'Avatar files must be JPEG, PNG, or WebP',
      );
    }
    if (
      stat.byteSize === null ||
      stat.byteSize < 1 ||
      stat.byteSize > MAX_AVATAR_BYTES
    ) {
      throw new DomainError(
        'VALIDATION',
        'storage.invalid_upload',
        'Avatar files must be 2 MB or smaller',
      );
    }
    return this.profiles.setAvatarUrl(
      userId,
      this.storage.publicUrl(objectKey),
    );
  }

  private assertUpload(contentType: string, byteSize: number): void {
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new DomainError(
        'VALIDATION',
        'storage.invalid_upload',
        'Avatar files must be JPEG, PNG, or WebP',
      );
    }
    if (
      !Number.isInteger(byteSize) ||
      byteSize < 1 ||
      byteSize > MAX_AVATAR_BYTES
    ) {
      throw new DomainError(
        'VALIDATION',
        'storage.invalid_upload',
        'Avatar files must be 2 MB or smaller',
      );
    }
  }
}
