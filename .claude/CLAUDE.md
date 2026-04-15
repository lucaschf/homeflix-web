# CLAUDE.md - HomeFlix Web (Frontend)

Este arquivo fornece contexto para o Claude Code trabalhar neste projeto.

## Visão Geral do Projeto

**HomeFlix Web** é o frontend da plataforma de streaming pessoal HomeFlix. Consome a API REST do backend para gerenciar e reproduzir filmes/séries armazenados em HD local.

### Stack Tecnológico

- **Framework:** React 19, TypeScript 5.9
- **Build:** Vite 8
- **UI:** MUI 7 (Material UI), Lucide React (ícones)
- **State/Data:** TanStack Query (React Query) v5
- **Routing:** React Router DOM v7
- **i18n:** i18next + react-i18next
- **Player:** hls.js (HLS streaming)
- **Font:** Inter (via @fontsource)

## Estrutura do Projeto

```
src/
├── api/               # Cliente HTTP e hooks de dados
│   ├── client.ts      # Fetch wrapper (GET/POST sobre /api/v1)
│   ├── hooks.ts       # React Query hooks (useMovie, useMovies, etc.)
│   └── types.ts       # Tipos de resposta da API
├── components/        # Componentes reutilizáveis
│   ├── Layout.tsx     # Layout principal com Navbar
│   ├── Navbar.tsx     # Barra de navegação
│   ├── HeroBanner.tsx # Banner hero da Home
│   ├── MediaCard.tsx  # Card de mídia
│   ├── MediaCarousel.tsx
│   ├── SearchOverlay.tsx
│   └── language-switch/
├── hooks/             # Custom hooks
├── i18n/              # Internacionalização
│   ├── index.ts       # Configuração i18next
│   └── locales/       # en.json, pt-BR.json
├── pages/             # Páginas/rotas
│   ├── Home.tsx
│   ├── Browse.tsx
│   ├── MovieDetail.tsx
│   ├── SeriesDetail.tsx
│   ├── Player.tsx     # Player HLS com controles customizados
│   └── Settings.tsx
├── theme/             # Tema MUI (dark mode, cores, tipografia)
│   ├── index.ts
│   └── colors.ts
├── App.tsx            # Rotas e providers
└── main.tsx           # Entry point
```

## Padrões de Código

### API Client

Todas as chamadas à API passam pelo wrapper em `api/client.ts`, que adiciona `/api/v1` como base URL. Os dados são consumidos via React Query hooks em `api/hooks.ts`.

### Rotas

Definidas em `App.tsx`:
- `/` — Home
- `/browse` — Catálogo
- `/movie/:movieId` — Detalhes do filme
- `/series/:seriesId` — Detalhes da série
- `/play/movie/:movieId` — Player (filme)
- `/play/episode/:seriesId/:season/:episode` — Player (episódio)
- `/settings` — Configurações

As rotas do Player não usam o `Layout` (tela cheia).

### Tema

Dark mode exclusivo. Cor primária: peach (`#E8926F`). Fonte: Inter. Configurado em `theme/index.ts`.

### i18n

Suporte a `en` e `pt-BR`. Idioma salvo em `localStorage` (chave `homeflix-language`). Fallback para `en`.

## Comandos

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Lint
npm run lint

# Preview do build
npm run preview
```

## Git Workflow

- **NUNCA commitar diretamente em `develop` ou `master`**. Sempre criar uma branch local a partir de `origin/develop` antes de commitar: `git checkout -b <branch-name> origin/develop`
- Convenção de nomes de branch: `<type>/<descricao-curta>` (ex: `fix/hls-player-buffering`, `feat/add-search-overlay`)

## Commit Messages

Mensagens de commit seguem **Conventional Commits** em inglês:

```
<type>(<scope>): <subject>

<body>
```

### Regras

1. **Subject**: Imperativo, máximo 50 caracteres
2. **Body**: Explicação em 2-3 frases (opcional)
3. **Scope**: Usar nome do módulo quando aplicável (ex: `player`, `api`, `theme`)
4. **Sem menções de IA**: Nunca incluir `Co-Authored-By`, menções ao Claude, ou qualquer referência a uso de IA em commits, PRs, comentários de código ou qualquer outro artefato

### Types

- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `refactor`: Refatoração
- `test`: Testes
- `docs`: Documentação
- `chore`: Manutenção

### Exemplos

```
feat(player): add HLS streaming with hls.js

Implement custom video player with quality selection,
playback speed controls, and keyboard shortcuts.
```

```
fix(api): unwrap response envelope in hooks

The API returns data inside a { data } envelope that
was not being unwrapped by the React Query hooks.
```

## Pull Requests

- **Título**: Conventional Commits — `<type>(<scope>): <subject>` (max 70 chars)
- **Idioma**: Inglês
- **Seções obrigatórias**: `## Summary` (bullets) + `## Test plan` (checklist)
- **Seções opcionais**: `## Breaking changes`, `## Related issues`

## Notas Importantes

- **Idioma do código**: Inglês
- **Idioma dos commits**: Inglês (Conventional Commits)
- **i18n**: Suporte a en + pt-BR
- Backend roda separadamente — o Vite faz proxy de `/api` para o backend em dev
