# notion-correios

Webhook serverless (Vercel + TypeScript) que emite etiquetas dos Correios (PAC/Sedex
via API CWS) a partir de páginas da base **DB - Vendas** no Notion. O usuário aperta
o botão "Emitir Etiqueta" na linha da venda; o backend lê o endereço, cria a
prepostagem, baixa o PDF do rótulo, salva no Cloudflare R2 e devolve a URL pública
para o campo `Etiqueta PDF` no Notion.

## Fluxo

1. Usuário aperta **Emitir Etiqueta** na linha da venda no Notion.
2. Notion envia `POST /api/emit-etiqueta` com `{ pageId }` e
   `Authorization: Bearer <WEBHOOK_SECRET>`.
3. Backend valida o segredo, retorna `202 Accepted` imediatamente e processa em
   background:
   - Lê a página no Notion (Cliente, Local, CEP, Número, Complemento).
   - Valida `Local ∈ {PAC, Sedex}` e os campos manuais.
   - Marca `Status Etiqueta = Emitindo`.
   - Se faltar Logradouro/Cidade/UF/Bairro Destinatário, busca no ViaCEP e atualiza
     a página.
   - Autentica na CWS (token cacheado por ~1h).
   - Cria a prepostagem (`POST /prepostagem/v2/prepostagens`).
   - Baixa o rótulo em PDF (`GET /prepostagem/v1/prepostagens/{id}/rotulos`).
   - Faz upload no R2 → URL pública.
   - Atualiza `Cód. Rastreio`, `Etiqueta PDF`, `Status Etiqueta = Emitida`.
4. Em qualquer falha, grava `Status Etiqueta = Erro` + mensagem em `Erro Etiqueta`.

## Propriedades usadas na DB - Vendas

| Propriedade           | Tipo   | Origem               |
| --------------------- | ------ | -------------------- |
| Cliente               | title  | já existia           |
| Local                 | select | já existia (PAC/Sedex) |
| CEP                   | text   | manual               |
| Número                | text   | manual               |
| Complemento           | text   | manual (opcional)    |
| Logradouro            | text   | ViaCEP               |
| Cidade                | text   | ViaCEP               |
| UF                    | select | ViaCEP               |
| Bairro Destinatário   | text   | ViaCEP               |
| Cód. Rastreio         | text   | Correios             |
| Status Etiqueta       | select | backend              |
| Etiqueta PDF          | files  | R2                   |
| Erro Etiqueta         | text   | backend              |

## Estrutura

```
api/emit-etiqueta.ts        # handler Vercel (webhook)
lib/config.ts               # validação de env vars
lib/correios/auth.ts        # token JWT CWS (cache em memória)
lib/correios/prepostagem.ts # criar prepostagem
lib/correios/rotulo.ts      # baixar PDF
lib/notion/client.ts        # ler/atualizar páginas
lib/notion/properties.ts    # nomes + helpers de leitura/escrita
lib/viacep.ts               # lookup CEP
lib/r2.ts                   # upload PDF no Cloudflare R2
.env.example                # todas as variáveis necessárias
vercel.json                 # config da function
```

## Setup

### 1. Variáveis de ambiente

Copie `.env.example` e preencha. Resumo dos grupos:

- **WEBHOOK_SECRET** — `openssl rand -hex 32`. O mesmo valor vai no header
  `Authorization` do botão do Notion.
- **NOTION_TOKEN** — Internal Integration Secret. Lembre de compartilhar a
  DB - Vendas com a integração (`...` no canto superior → Connections).
- **REMETENTE_\*** — dados fixos da Farmácia Qualité que aparecem em toda
  etiqueta.
- **PAC_\*** / **SEDEX_\*** — pacote padrão por serviço (peso em g, dimensões
  em cm, formato 1=envelope/2=caixa/3=cilindro).
- **CORREIOS_\*** — credenciais CWS (usuário, senha, contrato, cartão de
  postagem, código administrativo).
- **R2_\*** — Account ID, Access Key, Secret, bucket e URL pública.

### 2. Deploy no Vercel

1. Importar o repo no Vercel (preset: **Other** → ele detecta `package.json` e
   roda as functions de `api/`).
2. Em **Settings → Environment Variables**, cadastrar todas as variáveis do
   `.env.example` no ambiente **Production**.
3. Deploy. URL final do webhook:
   `https://<projeto>.vercel.app/api/emit-etiqueta`.

### 3. Botão "Emitir Etiqueta" no Notion

1. Na DB - Vendas, adicionar uma propriedade do tipo **Button** chamada
   `Emitir Etiqueta`.
2. Ação: **Send webhook**.
3. URL: `https://<projeto>.vercel.app/api/emit-etiqueta`.
4. Headers:
   - `Authorization: Bearer <WEBHOOK_SECRET>`
   - `Content-Type: application/json`
5. Body (JSON):
   ```json
   { "pageId": "{{page.id}}" }
   ```

## Erros mapeados (todos vão para `Erro Etiqueta`)

- `Local` diferente de PAC/Sedex.
- CEP ausente / com menos de 8 dígitos.
- Número do endereço vazio.
- ViaCEP retornou erro (CEP inexistente).
- CWS rejeitou prepostagem (CEP fora de cobertura, contrato sem cobertura, etc.).
- Falha de autenticação na CWS (credenciais).
- Falha de upload no R2.
- Falha ao atualizar página no Notion.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencher
npm run typecheck            # apenas valida tipos (sem emitir)
vercel dev                   # roda local em http://localhost:3000
```
