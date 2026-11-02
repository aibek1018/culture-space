export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface PresignedUpload {
  uploadUrl: string;
  expiresAt: Date;
}

export interface StoredObject {
  contentType: string | null;
  byteSize: number | null;
}

export interface StoragePort {
  createPresignedPut(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
  }): Promise<PresignedUpload>;
  statObject(objectKey: string): Promise<StoredObject | null>;
  publicUrl(objectKey: string): string;
}
