import type { Readable } from "stream";
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  CreateBucketCommand,
  HeadBucketCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageConfig {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}

export class StorageService {
  private readonly client: S3Client;
  private readonly bucketCache = new Set<string>();
  private readonly bucketInitPromises = new Map<string, Promise<void>>();

  constructor(config: StorageConfig = {}) {
    const endpoint = config.endpoint ?? process.env.S3_ENDPOINT ?? "http://localhost:9000";
    const accessKeyId = config.accessKeyId ?? process.env.S3_ACCESS_KEY ?? "onprem_access_key";
    const secretAccessKey = config.secretAccessKey ?? process.env.S3_SECRET_KEY ?? "onprem_secret_key_must_be_long";
    const region = config.region ?? process.env.S3_REGION ?? process.env.AWS_REGION ?? "us-east-1";

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Zwingend erforderlich für RustFS / lokale Container
    });
  }

  private async nodeStreamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  private async webStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let chunkResult: { done: boolean; value?: Uint8Array };

    while (!(chunkResult = await reader.read()).done) {
      if (chunkResult.value) {
        chunks.push(chunkResult.value);
      }
    }

    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }

  private isReadableNodeStream(value: unknown): value is Readable {
    return !!value && typeof (value as Readable).pipe === "function";
  }

  private isReadableWebStream(value: unknown): value is ReadableStream<Uint8Array> {
    return !!value && typeof (value as any).getReader === "function";
  }

  /**
   * Stellt sicher, dass ein Bucket existiert. Wenn nicht, wird er erstellt.
   */
  async ensureBucket(bucketName: string): Promise<void> {
    if (this.bucketCache.has(bucketName)) {
      return;
    }

    const inFlight = this.bucketInitPromises.get(bucketName);
    if (inFlight) {
      return inFlight;
    }

    const promise = (async () => {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
      } catch (error: any) {
        if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
          try {
            await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
          } catch (createError: any) {
            if (createError.name !== "BucketAlreadyOwnedByYou" && createError.$metadata?.httpStatusCode !== 409) {
              throw createError;
            }
          }
        } else {
          throw error;
        }
      }

      this.bucketCache.add(bucketName);
      this.bucketInitPromises.delete(bucketName);
    })();

    this.bucketInitPromises.set(bucketName, promise);
    return promise;
  }

  /**
   * Lädt eine Datei in einen Bucket hoch
   */
  async upload(
    bucketName: string,
    key: string,
    body: Buffer | string | Uint8Array | ArrayBuffer | Readable,
    contentType?: string,
  ): Promise<void> {
    await this.ensureBucket(bucketName);

    const payload = body instanceof ArrayBuffer ? Buffer.from(body) : body;

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: payload,
        ContentType: contentType,
      }),
    );
  }

  /**
   * Holt eine Datei als Buffer ab
   */
  async download(bucketName: string, key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Datei ${key} im Bucket ${bucketName} ist leer.`);
    }

    if (typeof (response.Body as any).transformToByteArray === "function") {
      const bytes = await (response.Body as any).transformToByteArray();
      return Buffer.from(bytes);
    }

    if (typeof response.Body === "string") {
      return Buffer.from(response.Body);
    }

    if (response.Body instanceof Uint8Array) {
      return Buffer.from(response.Body);
    }

    if (this.isReadableNodeStream(response.Body)) {
      return this.nodeStreamToBuffer(response.Body as Readable);
    }

    if (this.isReadableWebStream(response.Body)) {
      return this.webStreamToBuffer(response.Body);
    }

    throw new Error(`Unbekannter Body-Typ für Objekt ${key} im Bucket ${bucketName}.`);
  }

  /**
   * Holt eine Datei als Stream ab, um Speicher zu sparen.
   */
  async downloadStream(bucketName: string, key: string): Promise<Readable | ReadableStream<Uint8Array>> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Datei ${key} im Bucket ${bucketName} ist leer.`);
    }

    if (this.isReadableNodeStream(response.Body) || this.isReadableWebStream(response.Body)) {
      return response.Body;
    }

    throw new Error(`Stream für Objekt ${key} im Bucket ${bucketName} konnte nicht geöffnet werden.`);
  }

  /**
   * Löscht eine Datei aus einem Bucket
   */
  async delete(bucketName: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
  }

  /**
   * Generiert eine zeitlich begrenzte URL zum sicheren Downloaden/Anschauen im Browser
   * (Standard: Link ist 1 Stunde gültig)
   */
  async getDownloadUrl(bucketName: string, key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}