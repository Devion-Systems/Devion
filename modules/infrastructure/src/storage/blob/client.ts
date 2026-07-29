import { s3 } from "./connection.js";
import { BlobStorageClient } from "./blob-client.js";

export * from "./connection.js";
export * from "./blob-client.js";

export const blobStorage = new BlobStorageClient({
  s3Client: s3,
  defaultBucketPrefix: process.env.S3_BUCKET_PREFIX || "devion",
  autoCreateBuckets: true,
});

export async function uploadFile(bucket: string, key: string, data: string | Buffer) {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
  });
  await s3.send(command);
}

export async function getFile(bucket: string, key: string) {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  return response.Body?.transformToString();
}
