export type Local = "PAC" | "Sedex";

export type EnderecoDestinatario = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type Destinatario = EnderecoDestinatario & {
  nome: string;
};

export type Remetente = {
  nome: string;
  cnpj: string;
  inscricaoEstadual: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ddd: string;
  telefone: string;
  email: string;
};

export type PacotePreset = {
  codigoServico: string;
  pesoG: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
  formato: number;
};

export class EmitError extends Error {
  constructor(public readonly userMessage: string, cause?: unknown) {
    super(userMessage);
    if (cause) this.cause = cause;
  }
}
