import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getConfig } from "../lib/config.js";
import {
  atualizarEnderecoAuto,
  buscarVenda,
  ehServicoSuportado,
  marcarEmitida,
  marcarEmitindo,
  marcarErro,
} from "../lib/notion/client.js";
import { criarPrepostagem } from "../lib/correios/prepostagem.js";
import { baixarRotuloPdf } from "../lib/correios/rotulo.js";
import { buscarEnderecoPorCep } from "../lib/viacep.js";
import { uploadPdf } from "../lib/r2.js";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function autorizado(req: VercelRequest, secret: string): boolean {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && safeEqual(auth, `Bearer ${secret}`)) {
    return true;
  }
  const custom = req.headers["x-webhook-secret"];
  if (typeof custom === "string" && safeEqual(custom, secret)) {
    return true;
  }
  return false;
}

interface WebhookBody {
  pageId?: string;
  page_id?: string;
  data?: { id?: string };
}

function extrairPageId(body: unknown): string | null {
  let parsed: WebhookBody | undefined;
  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body) as WebhookBody;
    } catch {
      return null;
    }
  } else if (body && typeof body === "object") {
    parsed = body as WebhookBody;
  }
  if (!parsed) return null;
  const raw = parsed.pageId ?? parsed.page_id ?? parsed.data?.id;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function descreverErro(err: unknown): string {
  if (err instanceof Error) {
    const detail = (err as { body?: unknown }).body;
    if (detail) {
      try {
        return `${err.message} | detalhe: ${JSON.stringify(detail).slice(0, 1500)}`;
      } catch {
        return err.message;
      }
    }
    return err.message;
  }
  return String(err);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let cfg;
  try {
    cfg = getConfig();
  } catch (err) {
    res.status(500).json({ error: `Configuração inválida: ${(err as Error).message}` });
    return;
  }

  if (!autorizado(req, cfg.webhookSecret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const pageId = extrairPageId(req.body);
  if (!pageId) {
    res.status(400).json({ error: "pageId ausente no corpo da requisição" });
    return;
  }

  res.status(202).json({ ok: true, pageId });

  emitir(pageId).catch((err) => {
    console.error("[emit-etiqueta] erro não tratado", err);
  });
}

async function emitir(pageId: string): Promise<void> {
  try {
    const venda = await buscarVenda(pageId);

    if (!ehServicoSuportado(venda.local)) {
      await marcarErro(
        pageId,
        `Local "${venda.local || "(vazio)"}" não suportado. Use PAC ou Sedex.`
      );
      return;
    }

    if (!venda.cep || venda.cep.length !== 8) {
      await marcarErro(pageId, "CEP ausente ou inválido (precisa de 8 dígitos).");
      return;
    }
    if (!venda.numero) {
      await marcarErro(pageId, "Número do endereço é obrigatório.");
      return;
    }
    if (!venda.cliente) {
      await marcarErro(pageId, "Cliente (título) é obrigatório.");
      return;
    }

    await marcarEmitindo(pageId);

    let logradouro = venda.logradouro;
    let cidade = venda.cidade;
    let uf = venda.uf;
    let bairro = venda.bairroDestinatario;

    if (!logradouro || !cidade || !uf || !bairro) {
      const auto = await buscarEnderecoPorCep(venda.cep);
      logradouro = logradouro || auto.logradouro;
      cidade = cidade || auto.cidade;
      uf = uf || auto.uf;
      bairro = bairro || auto.bairro;
      await atualizarEnderecoAuto(pageId, { logradouro, cidade, uf, bairro });
    }

    if (!logradouro || !cidade || !uf || !bairro) {
      await marcarErro(
        pageId,
        "Endereço incompleto após ViaCEP. Preencha Logradouro/Bairro/Cidade/UF manualmente."
      );
      return;
    }

    const cfg = getConfig();
    const pacote = cfg.pacotes[venda.local];

    const prepostagem = await criarPrepostagem(
      {
        nome: venda.cliente,
        endereco: {
          cep: venda.cep,
          logradouro,
          numero: venda.numero,
          complemento: venda.complemento,
          bairro,
          cidade,
          uf,
        },
      },
      pacote
    );

    const pdf = await baixarRotuloPdf(prepostagem.idPrePostagem);
    const key = `${new Date().toISOString().slice(0, 10)}/${prepostagem.codigoObjeto}.pdf`;
    const { url } = await uploadPdf({ key, pdf });

    await marcarEmitida(pageId, {
      codRastreio: prepostagem.codigoObjeto,
      pdfUrl: url,
      pdfNome: `${prepostagem.codigoObjeto}.pdf`,
    });
  } catch (err) {
    console.error("[emit-etiqueta] falha", err);
    try {
      await marcarErro(pageId, descreverErro(err));
    } catch (err2) {
      console.error("[emit-etiqueta] falha ao gravar erro no Notion", err2);
    }
  }
}
