import { strict as assert } from "node:assert";
import { S3Client, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { BlobStorageClient } from "./blob-client.js";
// Fixed loopback endpoint: never uses an operator's production credentials.
const s3 = new S3Client({ endpoint: "http://127.0.0.1:59000", region: "us-east-1", forcePathStyle: true,
  credentials: { accessKeyId: "devion_test", secretAccessKey: "devion_test_local_only" }, maxAttempts: 2 });
const storage = new BlobStorageClient({ s3Client: s3, requestTimeoutMs: 5000 });
const tenant = crypto.randomUUID();
const bucket = storage.getBucketName(tenant, "assets");
const keys = ["one.txt", "two.txt"];
try {
  await Promise.all(keys.map(key => storage.upload(tenant, "assets", key, `payload-${key}`)));
  assert.equal((await storage.list(tenant, "assets")).length, 2);
  const { body } = await storage.get(tenant, "assets", keys[0]!);
  assert.equal(await new Response(body as BodyInit).text(), "payload-one.txt");
  assert.equal((await storage.stat(tenant, "assets", keys[0]!)).size, 15);
  await storage.checkBucket(bucket);
  console.log("RustFS: concurrent provisioning, upload, list, download, metadata and health passed");
} finally {
  for (const key of keys) await storage.delete(tenant, "assets", key);
  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
  s3.destroy();
}
