import { Injectable, Logger } from '@nestjs/common';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfigService } from '../../config/app-config.service';
import type {
  PresignedUpload,
  StoragePort,
  StoredObject,
} from './storage.port';

const UPLOAD_TTL_SECONDS = 10 * 60;

@Injectable()
export class S3Storage implements StoragePort {
  private readonly logger = new Logger(S3Storage.name);
  private readonly client: S3Client;
  private bucketReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {
    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: config.minioEndpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.minioAccessKey,
        secretAccessKey: config.minioSecretKey,
      },
    });
  }

  async createPresignedPut(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
  }): Promise<PresignedUpload> {
    await this.ensureBucket();
    const command = new PutObjectCommand({
      Bucket: this.config.minioBucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.byteSize,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_TTL_SECONDS,
    });
    return {
      uploadUrl,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000),
    };
  }

  async statObject(objectKey: string): Promise<StoredObject | null> {
    await this.ensureBucket();
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.minioBucket,
          Key: objectKey,
        }),
      );
      return {
        contentType: result.ContentType ?? null,
        byteSize: result.ContentLength ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      this.logger.error('Object storage head request failed');
      throw error;
    }
  }

  publicUrl(objectKey: string): string {
    const base = this.config.minioPublicBaseUrl.replace(/\/$/, '');
    return `${base}/${this.config.minioBucket}/${objectKey}`;
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = this.createBucketIfNeeded().catch((error: unknown) => {
        this.bucketReady = null;
        throw error;
      });
    }
    await this.bucketReady;
  }

  private async createBucketIfNeeded(): Promise<void> {
    const bucket = this.config.minioBucket;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    const origin = new URL(this.config.appOrigin).origin;
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [origin],
              AllowedMethods: ['PUT', 'GET', 'HEAD'],
              AllowedHeaders: ['*'],
              MaxAgeSeconds: 300,
            },
          ],
        },
      }),
    );
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const name = 'name' in error ? error.name : undefined;
  const status = '$metadata' in error ? error.$metadata : undefined;
  if (name === 'NotFound' || name === 'NoSuchKey') {
    return true;
  }
  if (
    typeof status === 'object' &&
    status !== null &&
    'httpStatusCode' in status
  ) {
    return status.httpStatusCode === 404;
  }
  return false;
}
