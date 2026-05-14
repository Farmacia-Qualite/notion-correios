import type { Config } from "../config.js";
import { EmitError } from "../types.js";
import { getCorreiosToken } from "./auth.js";

const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1500;

export async function baixarRotuloPdf(cfg: Config, idPrePostagem: string): Promise<Buffer> {
  const token = await getCorreiosToken(cfg);

  const recibo = await solicitarRotuloAssincrono(cfg, token, idPrePostagem);
  const pdfUrl = await aguardarRotuloPronto(cfg, token, recibo);

  const pdfRes = await fetch(pdfUrl);
  if (!pdfRes.ok) {
    throw new EmitError(`Falha ao baixar PDF da etiqueta (HTTP ${pdfRes.status})`);
  }
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  if (buf.length === 0) {
    throw new EmitError("PDF da etiqueta veio vazio");
  }
  return buf;
}

async function solicitarRotuloAssincrono(
  cfg: Config,
  token: string,
  idPrePostagem: string,
): Promise<string> {
  const url = `${cfg.CORREIOS_API_BASE}/prepostagem/v1/prepostagens/rotulo/assincrono/pdf`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify({
      numeroCartaoPostagem: cfg.CORREIOS_CARTAO_POSTAGEM,
      idsPrePostagem: [idPrePostagem],
      tipoRotulo: "P",
      formatoRotulo: "ET",
      imprimeRemetente: "S",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new EmitError(`Solicitação de rótulo falhou (HTTP ${res.status}): ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as { recibo?: string };
  if (!data.recibo) {
    throw new EmitError(`Resposta da solicitação de rótulo sem recibo: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.recibo;
}

async function aguardarRotuloPronto(cfg: Config, token: string, recibo: string): Promise<string> {
  const url = `${cfg.CORREIOS_API_BASE}/prepostagem/v1/prepostagens/rotulo/assincrono/${recibo}`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new EmitError(`Consulta de rótulo falhou (HTTP ${res.status}): ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      status?: string;
      url?: string;
      mensagem?: string;
    };

    if (data.url) return data.url;
    if (data.status && /erro|falha/i.test(data.status)) {
      throw new EmitError(`Geração do rótulo falhou: ${data.mensagem ?? data.status}`);
    }
  }

  throw new EmitError("Timeout aguardando geração do rótulo pelos Correios");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
