import { getConfig } from "../config.js";
import { obterToken } from "./auth.js";

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

async function descobrirMetodos(baseUrl: string, path: string, token: string): Promise<string | null> {
  try {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: "OPTIONS",
      headers: { Authorization: `Bearer ${token}` },
    });
    const allow = resp.headers.get("allow");
    console.log("[correios] OPTIONS", { path, status: resp.status, allow });
    return allow;
  } catch (err) {
    console.log("[correios] OPTIONS falhou", { path, error: (err as Error).message });
    return null;
  }
}

export async function baixarRotuloPdf(idPrePostagem: string): Promise<Buffer> {
  const cfg = getConfig().correios;
  const token = await obterToken();

  // Round 2 da descoberta: paths em outros modulos
  const candidatos = [
    // imprime-rotulo (modulo separado)
    "/imprime-rotulo/v1/rotulos",
    "/imprime-rotulo/v1/imprimir",
    "/imprime-rotulo/v1/etiqueta",
    "/imprime-rotulo/v1",
    // hyphens vs no hyphens
    "/imprimerotulo/v1/rotulos",
    "/cws-rotulo/v1/rotulos",
    "/cwsrotulo/v1/rotulos",
    "/cws-etiqueta/v1/etiquetas",
    "/cwsetiqueta/v1/etiquetas",
    // outras variacoes
    "/preposta/v1/rotulos",
    "/etiqueta-postal/v1/rotulos",
    "/rotulos/v1",
    // dentro de prepostagem mas paths novos
    "/prepostagem/v1/lote",
    "/prepostagem/v1/lotes",
    "/prepostagem/v1/relatorio",
    "/prepostagem/v1/exportacao",
    "/prepostagem/v1/prepostagens/imprimir",
    "/prepostagem/v1/prepostagens/imprime-rotulo",
    "/prepostagem/v1/prepostagens/imprimir-rotulo",
    "/prepostagem/v1/prepostagens/relatorio",
    "/prepostagem/v1/imprime-rotulo",
    "/prepostagem/v1/imprimir-rotulo",
  ];

  console.log("[correios] iniciando descoberta de endpoint de rotulo");
  for (const path of candidatos) {
    await descobrirMetodos(cfg.baseUrl, path, token);
  }

  throw new CorreiosRotuloError(
    "Descoberta de endpoint em andamento — confira os logs [correios] OPTIONS para identificar o path correto.",
    0
  );
}
