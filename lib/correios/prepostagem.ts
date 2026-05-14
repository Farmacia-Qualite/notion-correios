import type { Config } from "../config.js";
import type { Destinatario, PacotePreset, Remetente } from "../types.js";
import { EmitError } from "../types.js";
import { getCorreiosToken } from "./auth.js";

export type PrepostagemResult = {
  idPrePostagem: string;
  codigoObjeto: string;
};

export async function criarPrepostagem(
  cfg: Config,
  args: {
    remetente: Remetente;
    destinatario: Destinatario;
    preset: PacotePreset;
    numeroNotaFiscal?: string;
  },
): Promise<PrepostagemResult> {
  const token = await getCorreiosToken(cfg);
  const { remetente, destinatario, preset } = args;

  const body = {
    idCorreios: "",
    codigoServico: preset.codigoServico,
    numeroCartaoPostagem: cfg.CORREIOS_CARTAO_POSTAGEM,
    numeroNotaFiscal: args.numeroNotaFiscal ?? "",
    remetente: {
      nome: remetente.nome,
      dddTelefone: remetente.ddd,
      telefone: remetente.telefone,
      email: remetente.email,
      cpfCnpj: remetente.cnpj,
      inscricaoEstadual: remetente.inscricaoEstadual,
      cep: remetente.cep,
      logradouro: remetente.logradouro,
      numero: remetente.numero,
      complemento: remetente.complemento,
      bairro: remetente.bairro,
      cidade: remetente.cidade,
      uf: remetente.uf,
    },
    destinatario: {
      nome: destinatario.nome,
      cep: destinatario.cep,
      logradouro: destinatario.logradouro,
      numero: destinatario.numero,
      complemento: destinatario.complemento,
      bairro: destinatario.bairro,
      cidade: destinatario.cidade,
      uf: destinatario.uf,
    },
    codigoFormatoObjeto: String(preset.formato),
    pesoInformado: String(preset.pesoG),
    alturaInformada: String(preset.alturaCm),
    larguraInformada: String(preset.larguraCm),
    comprimentoInformado: String(preset.comprimentoCm),
    cienteObjetoNaoProibido: 1,
  };

  const url = `${cfg.CORREIOS_API_BASE}/prepostagem/v2/prepostagens`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new EmitError(`Prepostagem rejeitada (HTTP ${res.status}): ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as { id?: string; codigoObjeto?: string };
  if (!data.id || !data.codigoObjeto) {
    throw new EmitError(`Resposta de prepostagem incompleta: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return { idPrePostagem: data.id, codigoObjeto: data.codigoObjeto };
}
