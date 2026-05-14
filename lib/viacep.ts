export interface EnderecoViaCEP {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export class ViaCEPError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ViaCEPError";
  }
}

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoViaCEP> {
  const limpo = cep.replace(/\D/g, "");
  if (limpo.length !== 8) {
    throw new ViaCEPError(`CEP inválido: "${cep}" (deve conter 8 dígitos)`);
  }

  const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
  if (!resp.ok) {
    throw new ViaCEPError(`ViaCEP HTTP ${resp.status}`, resp.status);
  }

  const data = (await resp.json()) as {
    erro?: boolean | string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };

  if (data.erro || !data.localidade || !data.uf) {
    throw new ViaCEPError(`CEP ${limpo} não encontrado no ViaCEP`);
  }

  return {
    logradouro: (data.logradouro ?? "").trim(),
    bairro: (data.bairro ?? "").trim(),
    cidade: data.localidade.trim(),
    uf: data.uf.trim().toUpperCase(),
  };
}
