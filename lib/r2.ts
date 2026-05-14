import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getConfig } from "./config.js";

let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  const cfg = getConfig().r2;
  cached = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cached;
}

export class R2UploadError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = "R2UploadError";
  }
}

export async function uploadPdf(args: {
  key: string;
  pdf: Buffer;
}): Promise<{ url: string }> {
  const cfg = getConfig().r2;
  try {
    await client().send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: args.key,
        Body: args.pdf,
        ContentType: "application/pdf",
        ContentDisposition: `inline; filename="${args.key.split("/").pop() ?? "etiqueta.pdf"}"`,
      })
    );
  } catch (err) {
    throw new R2UploadError(
      `Falha ao subir PDF no R2: ${(err as Error).message}`,
      err
    );
  }
  return { url: `${cfg.publicUrl}/${args.key}` };
}
