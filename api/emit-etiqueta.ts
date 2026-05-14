import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadConfig, presetForLocal, remetenteFromConfig } from "../lib/config.js";
import { criarPrepostagem } from "../lib/correios/prepostagem.js";
import { baixarRotuloPdf } from "../lib/correios/rotulo.js";
import {
  fetchVenda,
  setEnderecoViaCep,
  setErro,
  setEtiquetaEmitida,
  setStatusEmitindo,
  type VendaPage,
} from "../lib/notion/client.js";
import { uploadEtiquetaPdf } from "../lib/r2.js";
import { EmitError, type Destinatario } from "../lib/types.js";
import { lookupCep } from "../lib/viacep.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }

  const auth = req.headers.authorization ?? "";
  const expected = `Bearer ${cfg.WEBHOOK_SECRET}`;
  if (auth !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pageId = extractPageId(req.body);
  if (!pageId) {
    return res.status(400).json({ error: "pageId ausente no corpo da requisição" });
  }

  let venda: VendaPage | null = null;
  try {
    venda = await fetchVenda(cfg, pageId);
    await setStatusEmitindo(cfg, pageId);

    const destinatario = await resolveDestinatario(cfg, venda);
    const preset = presetForLocal(cfg, venda.local);

    const { idPrePostagem, codigoObjeto } = await criarPrepostagem(cfg, {
      remetente: remetenteFromConfig(cfg),
      destinatario,
      preset,
    });

    const pdf = await baixarRotuloPdf(cfg, idPrePostagem);
    const pdfUrl = await uploadEtiquetaPdf(cfg, { pdf, codigoObjeto });

    await setEtiquetaEmitida(cfg, pageId, { codigoRastreio: codigoObjeto, pdfUrl });

    return res.status(200).json({ ok: true, codigoObjeto, pdfUrl });
  } catch (err) {
    const message = err instanceof EmitError ? err.userMessage : (err as Error).message;
    console.error("[emit-etiqueta] erro:", err);
    if (venda) {
      try {
        await setErro(cfg, pageId, message);
      } catch (notionErr) {
        console.error("[emit-etiqueta] falha ao registrar erro no Notion:", notionErr);
      }
    }
    return res.status(err instanceof EmitError ? 400 : 500).json({ error: message });
  }
}

function extractPageId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const candidates = [obj.pageId, obj.page_id, obj.id];
  for (const v of candidates) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

async function resolveDestinatario(cfg: ReturnType<typeof loadConfig>, venda: VendaPage): Promise<Destinatario> {
  const cepClean = venda.cep.replace(/\D/g, "");
  if (cepClean.length !== 8) {
    throw new EmitError(`CEP do destinatário inválido: "${venda.cep}"`);
  }
  if (!venda.numero) {
    throw new EmitError("Número do destinatário é obrigatório");
  }
  if (!venda.cliente) {
    throw new EmitError("Nome do destinatário (Cliente) é obrigatório");
  }

  let { logradouro, bairroDestinatario, cidade, uf } = venda;
  const needsLookup = !logradouro || !bairroDestinatario || !cidade || !uf;

  if (needsLookup) {
    const fromCep = await lookupCep(cepClean);
    logradouro = logradouro || fromCep.logradouro;
    bairroDestinatario = bairroDestinatario || fromCep.bairro;
    cidade = cidade || fromCep.cidade;
    uf = uf || fromCep.uf;
    await setEnderecoViaCep(cfg, venda.pageId, {
      logradouro,
      bairro: bairroDestinatario,
      cidade,
      uf,
    });
  }

  if (!logradouro || !bairroDestinatario || !cidade || !uf) {
    throw new EmitError(
      "Endereço incompleto após consulta ao CEP. Preencha Logradouro/Bairro/Cidade/UF manualmente e tente de novo.",
    );
  }

  return {
    nome: venda.cliente,
    cep: cepClean,
    logradouro,
    numero: venda.numero,
    complemento: venda.complemento,
    bairro: bairroDestinatario,
    cidade,
    uf,
  };
}
