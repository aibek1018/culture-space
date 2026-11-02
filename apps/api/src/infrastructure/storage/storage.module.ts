import { Module } from '@nestjs/common';
import { STORAGE_PORT } from './storage.port';
import { S3Storage } from './s3-storage';

@Module({
  providers: [S3Storage, { provide: STORAGE_PORT, useExisting: S3Storage }],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
