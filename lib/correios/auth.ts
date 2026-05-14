import type { Config } from "../config.js";
import { EmitError } from "../types.js";

type TokenCache = { token: string; expiresAt: number };

let cache: TokenCache | null = null;

export async function getCorreiosToken(cfg: Config): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) {
    return cache.token;
  }

  const basic = Buffer.from(`${cfg.CORREIOS_USER}:${cfg.CORREIOS_PASSWORD}`).toString("base64");
  const url = `${cfg.CORREIOS_API_BASE}/token/v1/autentica/contrato`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    },
    body: JSON.stringify({ numero: cfg.CORREIOS_CONTRATO }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new EmitError(
      `Falha ao autenticar nos Correios CWS (HTTP ${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { token?: string; expiraEm?: string };
  if (!data.token) {
    throw new EmitError("Resposta de autenticação Correios sem token");
  }

  const expiresAt = data.expiraEm ? new Date(data.expiraEm).getTime() : now + 55 * 60_000;
  cache = { token: data.token, expiresAt };
  return data.token;
}
