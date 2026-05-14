# notion-correios

Integração Notion ↔ Correios CWS para emissão de etiquetas PAC/Sedex via botão na base `DB - Vendas`.

## Como funciona

1. Usuário preenche `CEP` e `Número` na linha da venda no Notion
2. Clica no botão **Emitir Etiqueta**
3. Notion dispara webhook → função na Vercel
4. Backend valida campos, consulta ViaCEP se necessário, autentica na CWS, cria a prepostagem, baixa o PDF, sobe no Cloudflare R2 e atualiza a página do Notion com:
   - `Cód. Rastreio`
   - `Etiqueta PDF` (link público)
   - `Status Etiqueta = Emitida`

Em caso de erro, `Status Etiqueta = Erro` e `Erro Etiqueta` recebe a mensagem.

## Stack

- TypeScript + Vercel Functions (Node 20)
- `@notionhq/client` (Notion API)
- `@aws-sdk/client-s3` (Cloudflare R2, S3-compatível)
- ViaCEP (lookup de endereço por CEP)
- Correios CWS API v1/v2

## Propriedades usadas na DB - Vendas

| Propriedade | Tipo | Origem |
|---|---|---|
| `Cliente` | title | já existe — nome destinatário |
| `Local` | select | já existe — `PAC` ou `Sedex` |
| `Cód. Rastreio` | text | já existe — preenchido pelo backend |
| `CEP` | text | manual (obrigatório) |
| `Número` | text | manual (obrigatório) |
| `Complemento` | text | manual (opcional) |
| `Logradouro` | text | auto via ViaCEP, editável |
| `Bairro Destinatário` | text | auto via ViaCEP, editável |
| `Cidade` | text | auto via ViaCEP, editável |
| `UF` | select | auto via ViaCEP, editável |
| `Status Etiqueta` | select | controlado pelo backend |
| `Etiqueta PDF` | files | link do R2, preenchido pelo backend |
| `Erro Etiqueta` | text | preenchido em caso de falha |
| `Emitir Etiqueta` | button | dispara o webhook |

## Setup

### 1. Variáveis de ambiente

Copie `.env.example` para `.env.local` (local) ou configure no painel da Vercel (produção).

### 2. Integração do Notion

1. Crie uma integração interna em https://www.notion.so/profile/integrations
2. Capabilities: Read content, Update content, Insert content
3. Copie o token → `NOTION_TOKEN`
4. Abra a base `DB - Vendas` → menu `...` → Connections → adicione a integração

### 3. Cloudflare R2

1. Crie bucket `etiquetas-qualite`
2. Habilite acesso público (R2.dev domain ou subdomínio próprio)
3. Crie Account API Token com **Object Read & Write** restrito ao bucket
4. Preencha `R2_*` no env

### 4. Correios CWS

Credenciais do contrato comercial (usuário, senha, número do contrato, cartão de postagem). Códigos de serviço PAC/Sedex podem variar por contrato — confirme em Meu Correios.

### 5. Deploy Vercel

```bash
npm install
npx vercel
npx vercel --prod
```

Configure todas as env vars no painel da Vercel antes do `--prod`.

### 6. Botão no Notion

Na `DB - Vendas`, crie uma propriedade do tipo **Button** chamada `Emitir Etiqueta`:

- Action: **Send webhook**
- URL: `https://<seu-projeto>.vercel.app/api/emit-etiqueta`
- Method: `POST`
- Header: `Authorization` = `Bearer <WEBHOOK_SECRET>`
- Body: `{"pageId": "{{page.id}}"}` (sintaxe do Notion para o ID da página atual)

## Desenvolvimento local

```bash
npm install
npm run typecheck
npm run dev    # vercel dev
```

## Estrutura

```
api/emit-etiqueta.ts        # handler HTTP
lib/config.ts               # validação env (zod)
lib/types.ts                # tipos compartilhados + EmitError
lib/viacep.ts               # lookup CEP
lib/r2.ts                   # upload PDF
lib/correios/auth.ts        # JWT cacheado
lib/correios/prepostagem.ts # cria prepostagem v2
lib/correios/rotulo.ts      # baixa PDF (assíncrono + polling)
lib/notion/properties.ts    # nomes/opções
lib/notion/client.ts        # leitura/atualização de páginas
```
