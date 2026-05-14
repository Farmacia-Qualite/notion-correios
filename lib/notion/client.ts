import { Client } from "@notionhq/client";
import { getConfig } from "../config.js";
import {
  PROP,
  STATUS,
  clearText,
  readSelect,
  readText,
  readTitle,
  writeFiles,
  writeSelect,
  writeText,
  type Servico,
} from "./properties.js";

let cached: Client | null = null;

function client(): Client {
  if (!cached) {
    cached = new Client({ auth: getConfig().notion.token });
  }
  return cached;
}

export interface VendaPagina {
  pageId: string;
  cliente: string;
  local: string;
  cep: string;
  numero: string;
  complemento: string;
  logradouro: string;
  cidade: string;
  uf: string;
  bairroDestinatario: string;
}

export async function buscarVenda(pageId: string): Promise<VendaPagina> {
  const page = await client().pages.retrieve({ page_id: pageId });
  const props = (page as { properties?: Record<string, unknown> }).properties ?? {};
  return {
    pageId,
    cliente: readTitle(props[PROP.cliente] as Record<string, unknown>),
    local: readSelect(props[PROP.local] as Record<string, unknown>),
    cep: readText(props[PROP.cep] as Record<string, unknown>).replace(/\D/g, ""),
    numero: readText(props[PROP.numero] as Record<string, unknown>),
    complemento: readText(props[PROP.complemento] as Record<string, unknown>),
    logradouro: readText(props[PROP.logradouro] as Record<string, unknown>),
    cidade: readText(props[PROP.cidade] as Record<string, unknown>),
    uf: readSelect(props[PROP.uf] as Record<string, unknown>),
    bairroDestinatario: readText(props[PROP.bairroDestinatario] as Record<string, unknown>),
  };
}

export function ehServicoSuportado(local: string): local is Servico {
  return local === "PAC" || local === "Sedex";
}

export async function marcarEmitindo(pageId: string): Promise<void> {
  await client().pages.update({
    page_id: pageId,
    properties: {
      [PROP.statusEtiqueta]: writeSelect(STATUS.emitindo),
      [PROP.erroEtiqueta]: clearText(),
    },
  });
}

export async function atualizarEnderecoAuto(
  pageId: string,
  endereco: { logradouro: string; cidade: string; uf: string; bairro: string }
): Promise<void> {
  await client().pages.update({
    page_id: pageId,
    properties: {
      [PROP.logradouro]: writeText(endereco.logradouro),
      [PROP.cidade]: writeText(endereco.cidade),
      [PROP.uf]: writeSelect(endereco.uf.toUpperCase()),
      [PROP.bairroDestinatario]: writeText(endereco.bairro),
    },
  });
}

export async function marcarEmitida(
  pageId: string,
  args: { codRastreio: string; pdfUrl: string; pdfNome: string }
): Promise<void> {
  await client().pages.update({
    page_id: pageId,
    properties: {
      [PROP.codRastreio]: writeText(args.codRastreio),
      [PROP.etiquetaPdf]: writeFiles([{ name: args.pdfNome, url: args.pdfUrl }]),
      [PROP.statusEtiqueta]: writeSelect(STATUS.emitida),
      [PROP.erroEtiqueta]: clearText(),
    },
  });
}

export async function marcarErro(pageId: string, mensagem: string): Promise<void> {
  const trimmed = mensagem.length > 2000 ? mensagem.slice(0, 2000) : mensagem;
  await client().pages.update({
    page_id: pageId,
    properties: {
      [PROP.statusEtiqueta]: writeSelect(STATUS.erro),
      [PROP.erroEtiqueta]: writeText(trimmed),
    },
  });
}
