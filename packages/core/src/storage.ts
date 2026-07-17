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
  private client: S3Client;

  constructor(config: StorageConfig = {}) {
    const endpoint = config.endpoint || process.env.S3_ENDPOINT || "http://localhost:9000";
    const accessKeyId = config.accessKeyId || process.env.S3_ACCESS_KEY || "onprem_access_key";
    const secretAccessKey = config.secretAccessKey || process.env.S3_SECRET_KEY || "onprem_secret_key_must_be_long";
    const region = config.region || "us-east-1"; 

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

  /**
   * Stellt sicher, dass ein Bucket existiert. Wenn nicht, wird er erstellt.
   */
  async ensureBucket(bucketName: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error: any) {
      // Wenn der Bucket nicht existiert (404), erstellen wir ihn
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
      } else {
        throw error;
      }
    }
  }

  /**
   * Lädt eine Datei (Buffer, String oder Stream) in einen Bucket hoch
   */
  async upload(bucketName: string, key: string, body: Buffer | string, contentType?: string): Promise<void> {
    await this.ensureBucket(bucketName);
    
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
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
      })
    );

    if (!response.Body) {
      throw new Error(`Datei ${key} im Bucket ${bucketName} ist leer.`);
    }

    // Wandelt den Stream des SDKs in einen Node.js Buffer um
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
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