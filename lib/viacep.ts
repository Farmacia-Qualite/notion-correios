import { EmitError } from "./types.js";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export type ViaCepResult = {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export async function lookupCep(cep: string): Promise<ViaCepResult> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) {
    throw new EmitError(`CEP inválido: "${cep}"`);
  }

  const url = `https://viacep.com.br/ws/${clean}/json/`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new EmitError(`ViaCEP retornou HTTP ${res.status}`);
  }

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro) {
    throw new EmitError(`CEP ${clean} não encontrado no ViaCEP`);
  }

  return {
    logradouro: data.logradouro ?? "",
    bairro: data.bairro ?? "",
    cidade: data.localidade ?? "",
    uf: data.uf ?? "",
  };
}
