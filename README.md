# ARVON FOOD

Sistema de gestão para restaurantes: PDV, mesas, cozinha, caixa, estoque e relatórios.

## Desenvolvimento

Você precisa de Node.js e [pnpm](https://pnpm.io/installation).

```sh
git clone <url-do-repositorio>
cd make-and-be-happy
pnpm install
cp .env.example .env.local   # se existir; senão crie com as variáveis abaixo
pnpm dev
```

Variáveis locais em `.env.local`:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

## Build

```sh
pnpm run build
```

## Stack

React, TypeScript, TanStack Start, Tailwind CSS, Supabase (Auth, Postgres, Realtime, Storage).
