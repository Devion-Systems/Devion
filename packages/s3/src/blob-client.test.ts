import { expect, test } from "bun:test";
import { BlobStorageClient } from "./blob-client.js";

test("coalesces concurrent bucket creation and caches the confirmed bucket", async () => {
  let headCalls = 0;
  let createCalls = 0;
  const missingBucket = Object.assign(new Error("missing"), {
    name: "NotFound",
    $metadata: { httpStatusCode: 404 },
  });
  const s3Client = {
    send: async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "HeadBucketCommand") {
        headCalls += 1;
        if (headCalls === 1) throw missingBucket;
      }
      if (command.constructor.name === "CreateBucketCommand") createCalls += 1;
      return {};
    },
  };
  const storage = new BlobStorageClient({ s3Client: s3Client as never });

  await Promise.all([
    storage.ensureBucketExists("devion-org-assets"),
    storage.ensureBucketExists("devion-org-assets"),
  ]);
  await storage.ensureBucketExists("devion-org-assets");

  expect(createCalls).toBe(1);
  expect(headCalls).toBe(1);
});

test("rejects tenant IDs that previously aliased another tenant's bucket", () => {
  const storage = new BlobStorageClient({ s3Client: {} as never });
  expect(storage.getBucketName("acme", "assets")).toBe("devion-acme-assets");
  for (const id of ["ACME", "a_b", "a/b", "", "a".repeat(100)]) {
    expect(() => storage.getBucketName(id, "assets")).toThrow();
  }
});

test("health checks contact storage even after successful provisioning", async () => {
  let down = false;
  const storage = new BlobStorageClient({ s3Client: { send: async () => {
    if (down) throw new Error("storage unavailable");
    return {};
  } } as never });
  await storage.ensureBucketExists("devion-health-check");
  down = true;
  await expect(storage.checkBucket("devion-health-check")).rejects.toThrow("storage unavailable");
});
