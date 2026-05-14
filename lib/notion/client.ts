import { Client } from "@notionhq/client";
import type {
  GetPageResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import type { Config } from "../config.js";
import { EmitError, type Local } from "../types.js";
import { PROP, STATUS } from "./properties.js";

let cached: Client | null = null;

function getClient(cfg: Config): Client {
  if (cached) return cached;
  cached = new Client({ auth: cfg.NOTION_TOKEN });
  return cached;
}

export type VendaPage = {
  pageId: string;
  cliente: string;
  local: Local;
  cep: string;
  numero: string;
  complemento: string;
  logradouro: string;
  bairroDestinatario: string;
  cidade: string;
  uf: string;
};

export async function fetchVenda(cfg: Config, pageId: string): Promise<VendaPage> {
  const page = (await getClient(cfg).pages.retrieve({ page_id: pageId })) as GetPageResponse;
  if (!("properties" in page)) {
    throw new EmitError("Página do Notion sem propriedades acessíveis");
  }
  const props = (page as PageObjectResponse).properties;

  const cliente = readTitle(props[PROP.cliente]);
  const localRaw = readSelectName(props[PROP.local]);
  if (localRaw !== "PAC" && localRaw !== "Sedex") {
    throw new EmitError(`Local deve ser PAC ou Sedex (atual: "${localRaw ?? "vazio"}")`);
  }

  return {
    pageId,
    cliente,
    local: localRaw,
    cep: readRichText(props[PROP.cep]),
    numero: readRichText(props[PROP.numero]),
    complemento: readRichText(props[PROP.complemento]),
    logradouro: readRichText(props[PROP.logradouro]),
    bairroDestinatario: readRichText(props[PROP.bairroDestinatario]),
    cidade: readRichText(props[PROP.cidade]),
    uf: readSelectName(props[PROP.uf]) ?? "",
  };
}

export async function setStatusEmitindo(cfg: Config, pageId: string): Promise<void> {
  await getClient(cfg).pages.update({
    page_id: pageId,
    properties: {
      [PROP.statusEtiqueta]: { select: { name: STATUS.emitindo } },
      [PROP.erroEtiqueta]: { rich_text: [] },
    },
  });
}

export async function setEnderecoViaCep(
  cfg: Config,
  pageId: string,
  endereco: { logradouro: string; bairro: string; cidade: string; uf: string },
): Promise<void> {
  await getClient(cfg).pages.update({
    page_id: pageId,
    properties: {
      [PROP.logradouro]: richTextProp(endereco.logradouro),
      [PROP.bairroDestinatario]: richTextProp(endereco.bairro),
      [PROP.cidade]: richTextProp(endereco.cidade),
      [PROP.uf]: { select: endereco.uf ? { name: endereco.uf } : null },
    },
  });
}

export async function setEtiquetaEmitida(
  cfg: Config,
  pageId: string,
  args: { codigoRastreio: string; pdfUrl: string },
): Promise<void> {
  await getClient(cfg).pages.update({
    page_id: pageId,
    properties: {
      [PROP.codRastreio]: richTextProp(args.codigoRastreio),
      [PROP.etiquetaPdf]: {
        files: [
          {
            name: `${args.codigoRastreio}.pdf`,
            type: "external",
            external: { url: args.pdfUrl },
          },
        ],
      },
      [PROP.statusEtiqueta]: { select: { name: STATUS.emitida } },
      [PROP.erroEtiqueta]: { rich_text: [] },
    },
  });
}

export async function setErro(cfg: Config, pageId: string, message: string): Promise<void> {
  await getClient(cfg).pages.update({
    page_id: pageId,
    properties: {
      [PROP.statusEtiqueta]: { select: { name: STATUS.erro } },
      [PROP.erroEtiqueta]: richTextProp(message.slice(0, 1900)),
    },
  });
}

function readTitle(p: unknown): string {
  if (!p || typeof p !== "object" || !("type" in p)) return "";
  const prop = p as { type: string; title?: Array<{ plain_text?: string }> };
  if (prop.type !== "title" || !prop.title) return "";
  return prop.title.map((t) => t.plain_text ?? "").join("").trim();
}

function readRichText(p: unknown): string {
  if (!p || typeof p !== "object" || !("type" in p)) return "";
  const prop = p as { type: string; rich_text?: Array<{ plain_text?: string }> };
  if (prop.type !== "rich_text" || !prop.rich_text) return "";
  return prop.rich_text.map((t) => t.plain_text ?? "").join("").trim();
}

function readSelectName(p: unknown): string | null {
  if (!p || typeof p !== "object" || !("type" in p)) return null;
  const prop = p as { type: string; select?: { name: string } | null };
  if (prop.type !== "select") return null;
  return prop.select?.name ?? null;
}

function richTextProp(value: string) {
  return { rich_text: value ? [{ type: "text" as const, text: { content: value } }] : [] };
}
