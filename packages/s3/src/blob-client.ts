import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  type GetObjectCommandOutput,
  type HeadObjectCommandOutput,
  type ListObjectsV2CommandOutput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { AppError, ErrorCode, getLogger } from "@repo/core";

export type ArtifactType = "zips" | "backups" | "logs" | "builds" | "assets";

export interface MultiTenantStorageConfig {
  s3Client: S3Client;
  defaultBucketPrefix?: string;
  autoCreateBuckets?: boolean;
  /** Whole-request timeout. Defaults to 60 seconds. */
  requestTimeoutMs?: number;
}

export interface StorageObjectMetadata {
  tenantId: string;
  artifactType: ArtifactType;
  path: string;
  contentType?: string;
  size?: number;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export class BlobStorageClient {
  private s3: S3Client;
  private defaultBucketPrefix: string;
  private autoCreateBuckets: boolean;
  private requestTimeoutMs: number;
  private knownBuckets = new Map<string, number>();
  private pendingBucketChecks = new Map<string, Promise<void>>();

  constructor(config: MultiTenantStorageConfig) {
    this.s3 = config.s3Client;
    this.defaultBucketPrefix = config.defaultBucketPrefix || "devion";
    this.autoCreateBuckets = config.autoCreateBuckets ?? true;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 60_000;
  }

  private getLogger() {
    try {
      return getLogger();
    } catch {
      return null;
    }
  }

  public getBucketName(tenantId: string, artifactType: ArtifactType): string {
    // Lossy normalization previously aliased distinct tenant IDs (A/a, a_b/a-b).
    // Preserve existing canonical bucket names; ambiguous IDs need an explicit
    // storage migration rather than silently opening another tenant's bucket.
    const bucket = `${this.defaultBucketPrefix}-${tenantId}-${artifactType}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantId) ||
        !["zips", "backups", "logs", "builds", "assets"].includes(artifactType) ||
        !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
      throw new AppError("Storage requires an unambiguous canonical tenant ID and bucket name", ErrorCode.VALIDATION_ERROR, 400);
    }
    return bucket;
  }

  /** Always contacts storage; provisioning cache must not mask an outage. */
  public async checkBucket(bucket: string): Promise<void> {
    await this.send(new HeadBucketCommand({ Bucket: bucket }));
  }

  public async ensureBucketExists(bucket: string): Promise<void> {
    if ((this.knownBuckets.get(bucket) ?? 0) > Date.now()) return;
    const pending = this.pendingBucketChecks.get(bucket);
    if (pending) return pending;

    const ensure = this.ensureBucketExistsUncached(bucket);
    this.pendingBucketChecks.set(bucket, ensure);
    try {
      await ensure;
      if (this.knownBuckets.size >= 1000) this.knownBuckets.delete(this.knownBuckets.keys().next().value!);
      this.knownBuckets.set(bucket, Date.now() + 60_000);
    } finally {
      this.pendingBucketChecks.delete(bucket);
    }
  }

  private async ensureBucketExistsUncached(bucket: string): Promise<void> {
    try {
      await this.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        if (!this.autoCreateBuckets) {
          throw new AppError(
            `Bucket '${bucket}' does not exist on Blob storage`,
            ErrorCode.NOT_FOUND,
            404
          );
        }
        this.getLogger()?.info({ bucket }, `Creating Blob bucket: ${bucket}`);
        try {
          await this.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch (createErr) {
          // A second API worker may have created the bucket between HEAD and
          // CREATE. Confirm its existence instead of treating that race as a
          // failed upload; do not mask unrelated create failures.
          if (isBucketConflict(createErr)) {
            await this.send(new HeadBucketCommand({ Bucket: bucket }));
            return;
          }
          throw new AppError(
            `Failed to create Blob bucket '${bucket}'`,
            ErrorCode.SERVICE_UNAVAILABLE,
            503,
            { cause: createErr, details: { bucket } }
          );
        }
      } else {
        throw new AppError(
          `Failed to check Blob bucket status: ${bucket}`,
          ErrorCode.SERVICE_UNAVAILABLE,
          503,
          { cause: err }
        );
      }
    }
  }

  // The AWS SDK command overloads are intentionally operation-specific and
  // cannot be represented as one generic command union without losing their
  // output type. Keep that SDK boundary local to this adapter.
  private send<T = void>(command: unknown): Promise<T> {
    return this.s3.send(command as never, {
      abortSignal: AbortSignal.timeout(this.requestTimeoutMs),
    }) as Promise<T>;
  }

  public async upload(
    tenantId: string,
    artifactType: ArtifactType,
    filePath: string,
    data: Buffer | ReadableStream | Readable | string,
    options: UploadOptions = {}
  ): Promise<{ bucket: string; key: string; size?: number }> {
    const bucket = this.getBucketName(tenantId, artifactType);
    await this.ensureBucketExists(bucket);

    let body: any = data;
    if (typeof data === "string") {
      body = Buffer.from(data);
    }

    const commandInput: PutObjectCommandInput = {
      Bucket: bucket,
      Key: filePath,
      Body: body,
      ContentType: options.contentType || this.detectContentType(filePath, artifactType),
      Metadata: {
        ...options.metadata,
        tenantId,
        artifactType,
        uploadedAt: new Date().toISOString(),
      },
    };

    try {
      await this.send(new PutObjectCommand(commandInput));
      this.getLogger()?.info({ tenantId, artifactType, filePath, bucket }, `Uploaded artifact to Blob storage`);
      return { bucket, key: filePath };
    } catch (err) {
      this.knownBuckets.delete(bucket);
      throw new AppError(
        `Failed to upload object '${filePath}' for tenant '${tenantId}' to Blob storage`,
        ErrorCode.INTERNAL_ERROR,
        500,
        { cause: err, details: { tenantId, artifactType, filePath, bucket } }
      );
    }
  }

  public async get(
    tenantId: string,
    artifactType: ArtifactType,
    filePath: string
  ): Promise<{ body: ReadableStream | Readable | Blob; contentType?: string; contentLength?: number }> {
    const bucket = this.getBucketName(tenantId, artifactType);

    try {
      const response = await this.send<GetObjectCommandOutput>(
        new GetObjectCommand({
          Bucket: bucket,
          Key: filePath,
        })
      );

      if (!response.Body) {
        throw new AppError(
          `Artifact Body is empty for key '${filePath}'`,
          ErrorCode.NOT_FOUND,
          404
        );
      }

      return {
        body: response.Body as any,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        throw new AppError(
          `Artifact '${filePath}' not found for tenant '${tenantId}'`,
          ErrorCode.NOT_FOUND,
          404,
          { cause: err }
        );
      }
      throw new AppError(
        `Failed to retrieve artifact '${filePath}' from Blob storage`,
        ErrorCode.INTERNAL_ERROR,
        500,
        { cause: err, details: { tenantId, artifactType, filePath } }
      );
    }
  }

  public async stat(
    tenantId: string,
    artifactType: ArtifactType,
    filePath: string
  ): Promise<StorageObjectMetadata> {
    const bucket = this.getBucketName(tenantId, artifactType);

    try {
      const res = await this.send<HeadObjectCommandOutput>(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: filePath,
        })
      );

      return {
        tenantId,
        artifactType,
        path: filePath,
        contentType: res.ContentType,
        size: res.ContentLength,
        lastModified: res.LastModified,
        metadata: res.Metadata,
      };
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        throw new AppError(
          `Artifact '${filePath}' not found`,
          ErrorCode.NOT_FOUND,
          404
        );
      }
      throw new AppError(
        `Failed to get metadata for '${filePath}' from Blob storage`,
        ErrorCode.INTERNAL_ERROR,
        500,
        { cause: err }
      );
    }
  }

  public async delete(
    tenantId: string,
    artifactType: ArtifactType,
    filePath: string
  ): Promise<void> {
    const bucket = this.getBucketName(tenantId, artifactType);

    try {
      await this.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: filePath,
        })
      );
      this.getLogger()?.info({ tenantId, artifactType, filePath }, `Deleted artifact from Blob storage`);
    } catch (err) {
      throw new AppError(
        `Failed to delete object '${filePath}' from Blob storage`,
        ErrorCode.INTERNAL_ERROR,
        500,
        { cause: err }
      );
    }
  }

  public async list(
    tenantId: string,
    artifactType: ArtifactType,
    prefix: string = ""
  ): Promise<Array<{ key: string; size?: number; lastModified?: Date }>> {
    const bucket = this.getBucketName(tenantId, artifactType);

    try {
      const response = await this.send<ListObjectsV2CommandOutput>(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
        })
      );

      return (
        response.Contents?.map((item: any) => ({
          key: item.Key || "",
          size: item.Size,
          lastModified: item.LastModified,
        })) || []
      );
    } catch (err: any) {
      if (err.name === "NoSuchBucket" || err.$metadata?.httpStatusCode === 404) {
        return [];
      }
      throw new AppError(
        `Failed to list objects in Blob bucket '${bucket}'`,
        ErrorCode.INTERNAL_ERROR,
        500,
        { cause: err }
      );
    }
  }

  private detectContentType(filePath: string, artifactType: ArtifactType): string {
    if (filePath.endsWith(".zip")) return "application/zip";
    if (filePath.endsWith(".log") || filePath.endsWith(".txt")) return "text/plain";
    if (filePath.endsWith(".json")) return "application/json";
    if (filePath.endsWith(".tar.gz") || filePath.endsWith(".tgz")) return "application/gzip";

    switch (artifactType) {
      case "zips":
        return "application/zip";
      case "logs":
        return "text/plain";
      case "backups":
        return "application/octet-stream";
      default:
        return "application/octet-stream";
    }
  }
}

function isBucketConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.$metadata?.httpStatusCode === 409 || value.name === "BucketAlreadyExists" || value.name === "BucketAlreadyOwnedByYou";
}
