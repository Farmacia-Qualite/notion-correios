export const PROP = {
  cliente: "Cliente",
  local: "Local",
  cep: "CEP",
  numero: "Número",
  complemento: "Complemento",
  logradouro: "Logradouro",
  cidade: "Cidade",
  uf: "UF",
  bairroDestinatario: "Bairro Destinatário",
  codRastreio: "Cód. Rastreio",
  statusEtiqueta: "Status Etiqueta",
  etiquetaPdf: "Etiqueta PDF",
  erroEtiqueta: "Erro Etiqueta",
} as const;

export const STATUS = {
  naoEmitida: "Não emitida",
  emitindo: "Emitindo",
  emitida: "Emitida",
  erro: "Erro",
} as const;

export const LOCAL = {
  pac: "PAC",
  sedex: "Sedex",
} as const;

export type Servico = "PAC" | "Sedex";

type NotionProperty = Record<string, unknown>;

export function readTitle(prop: NotionProperty | undefined): string {
  const items = (prop as { title?: Array<{ plain_text?: string }> } | undefined)?.title ?? [];
  return items.map((p) => p.plain_text ?? "").join("").trim();
}

export function readText(prop: NotionProperty | undefined): string {
  const items =
    (prop as { rich_text?: Array<{ plain_text?: string }> } | undefined)?.rich_text ?? [];
  return items.map((p) => p.plain_text ?? "").join("").trim();
}

export function readSelect(prop: NotionProperty | undefined): string {
  return (
    (prop as { select?: { name?: string } } | undefined)?.select?.name?.trim() ?? ""
  );
}

export function writeText(value: string) {
  return { rich_text: [{ type: "text" as const, text: { content: value } }] };
}

export function writeSelect(name: string) {
  return { select: { name } };
}

export function writeFiles(files: Array<{ name: string; url: string }>) {
  return {
    files: files.map((f) => ({
      name: f.name,
      type: "external" as const,
      external: { url: f.url },
    })),
  };
}

export function clearText() {
  return { rich_text: [] };
}
