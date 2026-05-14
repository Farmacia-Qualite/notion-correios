import { getConfig, type PacotePreset } from "../config.js";
import { invalidarTokenCache, obterToken } from "./auth.js";

export interface Destinatario {
  nome: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
}

export interface PrepostagemResultado {
  idPrePostagem: string;
  codigoObjeto: string;
}

export class CorreiosPrepostagemError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "CorreiosPrepostagemError";
  }
}

function montarPayload(destinatario: Destinatario, pacote: PacotePreset) {
  const cfg = getConfig();
  const r = cfg.remetente;
  const payload: Record<string, unknown> = {
    codigoServico: pacote.codigoServico,
    numeroContrato: cfg.correios.contrato,
    cartaoPostagem: cfg.correios.cartaoPostagem,
  };
  if (cfg.correios.codigoAdministrativo) {
    payload.codigoAdministrativo = cfg.correios.codigoAdministrativo;
  }
  return {
    ...payload,
    remetente: {
      nome: r.nome,
      dddTelefone: r.ddd,
      telefone: r.telefone,
      email: r.email,
      cpfCnpj: r.cnpj,
      endereco: {
        cep: r.cep,
        logradouro: r.logradouro,
        numero: r.numero,
        complemento: r.complemento,
        bairro: r.bairro,
        cidade: r.cidade,
        uf: r.uf,
      },
    },
    destinatario: {
      nome: destinatario.nome,
      endereco: {
        cep: destinatario.endereco.cep,
        logradouro: destinatario.endereco.logradouro,
        numero: destinatario.endereco.numero,
        complemento: destinatario.endereco.complemento ?? "",
        bairro: destinatario.endereco.bairro,
        cidade: destinatario.endereco.cidade,
        uf: destinatario.endereco.uf,
      },
    },
    volumeInformado: {
      altura: pacote.alturaCm,
      largura: pacote.larguraCm,
      comprimento: pacote.comprimentoCm,
      peso: pacote.pesoG,
      tipoObjeto: pacote.formato,
    },
  };
}

export async function criarPrepostagem(
  destinatario: Destinatario,
  pacote: PacotePreset
): Promise<PrepostagemResultado> {
  const cfg = getConfig().correios;
  let token = await obterToken();

  const exec = async (authToken: string) =>
    fetch(`${cfg.baseUrl}/prepostagem/v1/prepostagens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(montarPayload(destinatario, pacote)),
    });

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
    throw new CorreiosPrepostagemError(
      `Prepostagem rejeitada (HTTP ${resp.status})`,
      resp.status,
      parsed
    );
  }

  const data = parsed as { id?: string; codigoObjeto?: string };
  if (!data?.id || !data?.codigoObjeto) {
    throw new CorreiosPrepostagemError(
      "Resposta da CWS sem id/codigoObjeto",
      resp.status,
      parsed
    );
  }

  return { idPrePostagem: data.id, codigoObjeto: data.codigoObjeto };
}
