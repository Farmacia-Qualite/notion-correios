import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getConfig } from "../lib/config.js";
import { obterToken } from "../lib/correios/auth.js";

interface TentativaResultado {
  nome: string;
  url: string;
  metodo: string;
  status: number;
  contentType: string | null;
  bodyPreview: string;
  allowHeader: string | null;
  erro?: string;
}

const QUERY_ROTULO = "tipoRotulo=P&formatoRotulo=ET&imprimeRemetente=S&layoutImpressao=LINEAR_100_80";

async function tentar(
  nome: string,
  url: string,
  metodo: string,
  token: string,
  body: unknown
): Promise<TentativaResultado> {
  try {
    const resp = await fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await resp.text();
    return {
      nome,
      url,
      metodo,
      status: resp.status,
      contentType: resp.headers.get("content-type"),
      bodyPreview: text.slice(0, 600),
      allowHeader: resp.headers.get("allow"),
    };
  } catch (err) {
    return {
      nome,
      url,
      metodo,
      status: 0,
      contentType: null,
      bodyPreview: "",
      allowHeader: null,
      erro: (err as Error).message,
    };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  let cfg;
  try {
    cfg = getConfig();
  } catch (err) {
    res.status(500).json({ error: `Configuração inválida: ${(err as Error).message}` });
    return;
  }

  const auth = req.headers["authorization"];
  const okBearer = typeof auth === "string" && auth === `Bearer ${cfg.webhookSecret}`;
  const okQuery = req.query.secret === cfg.webhookSecret;
  if (!okBearer && !okQuery) {
    res.status(401).json({ error: "Unauthorized — passe ?secret=... ou Authorization: Bearer ..." });
    return;
  }

  const idPrePostagem = (req.query.id as string | undefined)?.trim();
  if (!idPrePostagem) {
    res.status(400).json({
      error: "Faltando ?id=<idPrePostagem>. Ex: /api/test-rotulo?secret=...&id=PRt4Ba8iMwTMeHwqQJVCtImg",
    });
    return;
  }

  const token = await obterToken();
  const bodyAssincrono = [{ idPrePostagem, sequencial: 1 }];

  const tentativas: TentativaResultado[] = [];

  // Teste 1: portal prepostagem.correios.com.br com Bearer (improvável funcionar, mas vale testar)
  tentativas.push(
    await tentar(
      "portal-prepostagem-bearer",
      `https://prepostagem.correios.com.br/rotulo/painel/imprimir/assincrono?${QUERY_ROTULO}`,
      "POST",
      token,
      bodyAssincrono
    )
  );

  // Teste 2: api.correios.com.br + mesmo path do portal
  tentativas.push(
    await tentar(
      "api-rotulo-assincrono",
      `${cfg.correios.baseUrl}/rotulo/painel/imprimir/assincrono?${QUERY_ROTULO}`,
      "POST",
      token,
      bodyAssincrono
    )
  );

  // Teste 3: api.correios.com.br + path com /v1/
  tentativas.push(
    await tentar(
      "api-rotulo-v1-assincrono",
      `${cfg.correios.baseUrl}/rotulo/v1/painel/imprimir/assincrono?${QUERY_ROTULO}`,
      "POST",
      token,
      bodyAssincrono
    )
  );

  // Teste 4: api.correios.com.br + dentro de prepostagem
  tentativas.push(
    await tentar(
      "api-prepostagem-v1-rotulo-assincrono",
      `${cfg.correios.baseUrl}/prepostagem/v1/rotulo/painel/imprimir/assincrono?${QUERY_ROTULO}`,
      "POST",
      token,
      bodyAssincrono
    )
  );

  // Teste 5: endpoint de polling no portal
  tentativas.push(
    await tentar(
      "portal-processamentosrotulos-bearer",
      `https://prepostagem.correios.com.br/processamentosrotulos`,
      "POST",
      token,
      { idRecibo: "fake-id-para-discovery", statusProcessamento: "EM_PROCESSAMENTO" }
    )
  );

  // Teste 6: endpoint de polling na CWS API
  tentativas.push(
    await tentar(
      "api-processamentosrotulos",
      `${cfg.correios.baseUrl}/processamentosrotulos`,
      "POST",
      token,
      { idRecibo: "fake-id-para-discovery", statusProcessamento: "EM_PROCESSAMENTO" }
    )
  );

  res.status(200).json({
    idPrePostagem,
    tokenLen: token.length,
    tentativas,
    instrucoes:
      "Procure por status 200/201/202 (sucesso) ou 401/403 (auth fail). 404 = path errado. 405 = path certo, método errado.",
  });
}
