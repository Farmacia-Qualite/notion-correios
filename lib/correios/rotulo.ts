import { getConfig } from "../config.js";
import { invalidarTokenCache, obterToken } from "./auth.js";

export class CorreiosRotuloError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "CorreiosRotuloError";
  }
}

export async function baixarRotuloPdf(idPrePostagem: string): Promise<Buffer> {
  const cfg = getConfig().correios;
  let token = await obterToken();

  const exec = async (authToken: string) =>
    fetch(
      `${cfg.baseUrl}/prepostagem/v1/prepostagens/${encodeURIComponent(idPrePostagem)}/rotulos`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: "application/json",
        },
      }
    );

  let resp = await exec(token);
  if (resp.status === 401 || resp.status === 403) {
    invalidarTokenCache();
    token = await obterToken();
    resp = await exec(token);
  }

  const text = await resp.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!resp.ok) {
    throw new CorreiosRotuloError(
      `Falha ao obter rótulo (HTTP ${resp.status})`,
      resp.status,
      parsed
    );
  }

  const data = parsed as { dadoPdfBase64?: string; pdf?: string };
  const base64 = data?.dadoPdfBase64 ?? data?.pdf;
  if (!base64) {
    throw new CorreiosRotuloError(
      "Resposta da CWS sem PDF em base64",
      resp.status,
      parsed
    );
  }

  return Buffer.from(base64, "base64");
}
