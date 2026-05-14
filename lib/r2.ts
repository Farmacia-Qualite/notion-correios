import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Config } from "./config.js";
import { EmitError } from "./types.js";

let client: S3Client | null = null;

function getClient(cfg: Config): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.R2_ACCESS_KEY_ID,
      secretAccessKey: cfg.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export async function uploadEtiquetaPdf(
  cfg: Config,
  args: { pdf: Buffer; codigoObjeto: string },
): Promise<string> {
  const key = `etiquetas/${args.codigoObjeto}.pdf`;
  try {
    await getClient(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.R2_BUCKET,
        Key: key,
        Body: args.pdf,
        ContentType: "application/pdf",
        ContentDisposition: `inline; filename="${args.codigoObjeto}.pdf"`,
      }),
    );
  } catch (err) {
    throw new EmitError(`Falha ao subir PDF no R2: ${(err as Error).message}`, err);
  }

  const base = cfg.R2_PUBLIC_URL.replace(/\/$/, "");
  return `${base}/${key}`;
}
