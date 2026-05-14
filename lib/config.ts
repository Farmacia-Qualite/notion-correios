import { z } from "zod";

const numericString = z.string().regex(/^\d+$/, "deve ser numérico");

const schema = z.object({
  NOTION_TOKEN: z.string().min(1),
  NOTION_DB_VENDAS_ID: z.string().min(1),

  WEBHOOK_SECRET: z.string().min(16),

  CORREIOS_API_BASE: z.string().url().default("https://api.correios.com.br"),
  CORREIOS_USER: z.string().min(1),
  CORREIOS_PASSWORD: z.string().min(1),
  CORREIOS_CONTRATO: z.string().min(1),
  CORREIOS_CARTAO_POSTAGEM: z.string().min(1),
  CORREIOS_COD_SERVICO_PAC: z.string().min(1),
  CORREIOS_COD_SERVICO_SEDEX: z.string().min(1),

  REMETENTE_NOME: z.string().min(1),
  REMETENTE_CNPJ: z.string().min(1),
  REMETENTE_IE: z.string().optional().default(""),
  REMETENTE_CEP: z.string().regex(/^\d{8}$/, "CEP do remetente deve ter 8 dígitos"),
  REMETENTE_LOGRADOURO: z.string().min(1),
  REMETENTE_NUMERO: z.string().min(1),
  REMETENTE_COMPLEMENTO: z.string().optional().default(""),
  REMETENTE_BAIRRO: z.string().min(1),
  REMETENTE_CIDADE: z.string().min(1),
  REMETENTE_UF: z.string().length(2),
  REMETENTE_DDD: z.string().regex(/^\d{2}$/),
  REMETENTE_TELEFONE: z.string().min(8),
  REMETENTE_EMAIL: z.string().email(),

  PAC_PESO_G: numericString,
  PAC_ALTURA_CM: numericString,
  PAC_LARGURA_CM: numericString,
  PAC_COMPRIMENTO_CM: numericString,
  PAC_FORMATO: z.enum(["1", "2", "3"]).default("2"),

  SEDEX_PESO_G: numericString,
  SEDEX_ALTURA_CM: numericString,
  SEDEX_LARGURA_CM: numericString,
  SEDEX_COMPRIMENTO_CM: numericString,
  SEDEX_FORMATO: z.enum(["1", "2", "3"]).default("2"),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
});

let cached: z.infer<typeof schema> | null = null;

export function loadConfig() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export type Config = z.infer<typeof schema>;

export function presetForLocal(cfg: Config, local: "PAC" | "Sedex") {
  if (local === "PAC") {
    return {
      codigoServico: cfg.CORREIOS_COD_SERVICO_PAC,
      pesoG: Number(cfg.PAC_PESO_G),
      alturaCm: Number(cfg.PAC_ALTURA_CM),
      larguraCm: Number(cfg.PAC_LARGURA_CM),
      comprimentoCm: Number(cfg.PAC_COMPRIMENTO_CM),
      formato: Number(cfg.PAC_FORMATO),
    };
  }
  return {
    codigoServico: cfg.CORREIOS_COD_SERVICO_SEDEX,
    pesoG: Number(cfg.SEDEX_PESO_G),
    alturaCm: Number(cfg.SEDEX_ALTURA_CM),
    larguraCm: Number(cfg.SEDEX_LARGURA_CM),
    comprimentoCm: Number(cfg.SEDEX_COMPRIMENTO_CM),
    formato: Number(cfg.SEDEX_FORMATO),
  };
}

export function remetenteFromConfig(cfg: Config) {
  return {
    nome: cfg.REMETENTE_NOME,
    cnpj: cfg.REMETENTE_CNPJ,
    inscricaoEstadual: cfg.REMETENTE_IE,
    cep: cfg.REMETENTE_CEP,
    logradouro: cfg.REMETENTE_LOGRADOURO,
    numero: cfg.REMETENTE_NUMERO,
    complemento: cfg.REMETENTE_COMPLEMENTO,
    bairro: cfg.REMETENTE_BAIRRO,
    cidade: cfg.REMETENTE_CIDADE,
    uf: cfg.REMETENTE_UF,
    ddd: cfg.REMETENTE_DDD,
    telefone: cfg.REMETENTE_TELEFONE,
    email: cfg.REMETENTE_EMAIL,
  };
}
