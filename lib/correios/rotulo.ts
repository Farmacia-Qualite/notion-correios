import { getConfig } from "../config.js";
import { invalidarTokenCache, obterToken } from "./auth.js";

export class CorreiosRotuloError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "CorreiosRotuloError";
  }
}

interface RotuloItem {
  idPrePostagem?: string;
  numeroEtiqueta?: string;
  tipoRotulo?: string;
  rotuloBase64?: string;
  dadoPdfBase64?: string;
  pdf?: string;
  conteudo?: string;
  base64?: string;
}

function extrairBase64(parsed: unknown): string | null {
  if (parsed == null) return null;
  if (typeof parsed === "string") return parsed;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const v = extrairBase64(item);
      if (v) return v;
    }
    return null;
  }
  if (typeof parsed === "object") {
    const obj = parsed as RotuloItem & Record<string, unknown>;
    const candidato =
      obj.rotuloBase64 ?? obj.dadoPdfBase64 ?? obj.pdf ?? obj.conteudo ?? obj.base64;
    if (typeof candidato === "string" && candidato.length > 100) return candidato;
    for (const v of Object.values(obj)) {
      const found = extrairBase64(v);
      if (found) return found;
    }
  }
  return null;
}

export async function baixarRotuloPdf(idPrePostagem: string): Promise<Buffer> {
  const cfg = getConfig().correios;
  let token = await obterToken();

  const body = JSON.stringify({
    idsPrePostagem: [idPrePostagem],
    tipoRotulo: "P",
    formatoRotulo: "ETIQUETA",
    imprimeRemetente: "N",
  });

  const exec = async (authToken: string) =>
    fetch(`${cfg.baseUrl}/prepostagem/v1/prepostagens/rotulos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });

  let resp = await exec(token);
  if (resp.status === 401 || resp.status === 403) {
    invalidarTokenCache();
    token = await obterToken();
    resp = await exec(token);
  }

  const contentType = resp.headers.get("content-type") ?? "";
  const allow = resp.headers.get("allow");
  console.log("[correios] rotulo response", {
    status: resp.status,
    contentType,
    allow,
  });

  if (!resp.ok) {
    const text = await resp.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    throw new CorreiosRotuloError(
      `Falha ao obter rótulo (HTTP ${resp.status})`,
      resp.status,
      parsed
    );
  }

  if (contentType.includes("application/pdf")) {
    const buf = Buffer.from(await resp.arrayBuffer());
    return buf;
  }

  const text = await resp.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  const base64 = extrairBase64(parsed);
  if (!base64) {
    throw new CorreiosRotuloError(
      "Resposta da CWS sem PDF em base64",
      resp.status,
      typeof parsed === "string" ? parsed.slice(0, 500) : parsed
    );
  }

  return Buffer.from(base64, "base64");
}
