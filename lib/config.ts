function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function requiredNumber(name: string): number {
  const raw = required(name);
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Variável de ambiente ${name} deve ser numérica (recebido: ${raw})`);
  }
  return n;
}

export type PacoteFormato = 1 | 2 | 3;

export interface PacotePreset {
  pesoG: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
  formato: PacoteFormato;
  codigoServico: string;
}

export interface RemetenteConfig {
  nome: string;
  cnpj: string;
  inscricaoEstadual: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  ddd: string;
  telefone: string;
  email: string;
}

export interface CorreiosConfig {
  baseUrl: string;
  usuario: string;
  senha: string;
  contrato: string;
  cartaoPostagem: string;
  codigoAdministrativo: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export interface NotionConfig {
  token: string;
  dbVendasId: string;
}

export interface AppConfig {
  webhookSecret: string;
  notion: NotionConfig;
  remetente: RemetenteConfig;
  pacotes: {
    PAC: PacotePreset;
    Sedex: PacotePreset;
  };
  correios: CorreiosConfig;
  r2: R2Config;
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  cached = {
    webhookSecret: required("WEBHOOK_SECRET"),
    notion: {
      token: required("NOTION_TOKEN"),
      dbVendasId: required("NOTION_DB_VENDAS_ID"),
    },
    remetente: {
      nome: required("REMETENTE_NOME"),
      cnpj: required("REMETENTE_CNPJ").replace(/\D/g, ""),
      inscricaoEstadual: required("REMETENTE_IE"),
      logradouro: required("REMETENTE_LOGRADOURO"),
      numero: required("REMETENTE_NUMERO"),
      complemento: process.env.REMETENTE_COMPLEMENTO ?? "",
      bairro: required("REMETENTE_BAIRRO"),
      cep: required("REMETENTE_CEP").replace(/\D/g, ""),
      cidade: required("REMETENTE_CIDADE"),
      uf: required("REMETENTE_UF").toUpperCase(),
      ddd: required("REMETENTE_DDD"),
      telefone: required("REMETENTE_TELEFONE").replace(/\D/g, ""),
      email: required("REMETENTE_EMAIL"),
    },
    pacotes: {
      PAC: {
        pesoG: requiredNumber("PAC_PESO_G"),
        alturaCm: requiredNumber("PAC_ALTURA_CM"),
        larguraCm: requiredNumber("PAC_LARGURA_CM"),
        comprimentoCm: requiredNumber("PAC_COMPRIMENTO_CM"),
        formato: requiredNumber("PAC_FORMATO") as PacoteFormato,
        codigoServico: required("PAC_CODIGO_SERVICO"),
      },
      Sedex: {
        pesoG: requiredNumber("SEDEX_PESO_G"),
        alturaCm: requiredNumber("SEDEX_ALTURA_CM"),
        larguraCm: requiredNumber("SEDEX_LARGURA_CM"),
        comprimentoCm: requiredNumber("SEDEX_COMPRIMENTO_CM"),
        formato: requiredNumber("SEDEX_FORMATO") as PacoteFormato,
        codigoServico: required("SEDEX_CODIGO_SERVICO"),
      },
    },
    correios: {
      baseUrl: process.env.CORREIOS_BASE_URL ?? "https://api.correios.com.br",
      usuario: required("CORREIOS_USUARIO"),
      senha: required("CORREIOS_SENHA"),
      contrato: required("CORREIOS_CONTRATO"),
      cartaoPostagem: required("CORREIOS_CARTAO_POSTAGEM"),
      codigoAdministrativo: required("CORREIOS_COD_ADMINISTRATIVO"),
    },
    r2: {
      accountId: required("R2_ACCOUNT_ID"),
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      bucket: required("R2_BUCKET"),
      publicUrl: required("R2_PUBLIC_URL").replace(/\/$/, ""),
    },
  };
  return cached;
}
