import { getConfig } from "../config.js";

interface CachedToken {
  token: string;
  expiraEm: number;
}

let cache: CachedToken | null = null;

const RENEW_BEFORE_MS = 5 * 60 * 1000;

export class CorreiosAuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CorreiosAuthError";
  }
}

export async function obterToken(): Promise<string> {
  const agora = Date.now();
  if (cache && cache.expiraEm - RENEW_BEFORE_MS > agora) {
    return cache.token;
  }

  const cfg = getConfig().correios;
  const basic = Buffer.from(`${cfg.usuario}:${cfg.senha}`).toString("base64");

  const resp = await fetch(`${cfg.baseUrl}/token/v1/autentica/cartaopostagem`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ numero: cfg.cartaoPostagem }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new CorreiosAuthError(
      `Falha ao autenticar na CWS (HTTP ${resp.status}): ${body.slice(0, 300)}`,
      resp.status
    );
  }

  const data = (await resp.json()) as { token?: string; expiraEm?: string };
  if (!data.token) {
    throw new CorreiosAuthError("Resposta da CWS sem campo 'token'");
  }

  const expiraEm = data.expiraEm ? Date.parse(data.expiraEm) : agora + 60 * 60 * 1000;
  cache = { token: data.token, expiraEm: Number.isFinite(expiraEm) ? expiraEm : agora + 60 * 60 * 1000 };
  return cache.token;
}

export function invalidarTokenCache(): void {
  cache = null;
}
