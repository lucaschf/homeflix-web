# HomeFlix Web

Frontend for the HomeFlix personal streaming platform. Manages and plays movies and series stored on a local drive.

## Stack

- **Framework:** React, TypeScript
- **Build:** Vite
- **UI:** MUI (Material UI), Lucide React (icons)
- **Data:** TanStack Query
- **Routing:** React Router DOM
- **i18n:** i18next (en + pt-BR)
- **Player:** hls.js

## Getting started

```bash
yarn install
yarn dev        # http://localhost:5173
```

The backend must be running separately (Vite proxies `/api` to it in dev).

## Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start dev server with HMR |
| `yarn build` | Production build |
| `yarn preview` | Preview production build |
| `yarn lint` | Run ESLint (full repo) |

## Keyboard shortcuts

### Global

| Key | Action |
|-----|--------|
| `Ctrl+K` / `Cmd+K` | Open search overlay |

### Player

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `←` | Rewind 10s |
| `→` | Forward 30s |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Mute / Unmute |
| `F` | Toggle fullscreen |
| `A` | Toggle audio track menu |
| `S` | Toggle subtitle menu |
| `Esc` | Exit fullscreen / Go back |

All player shortcuts show a brief animated indicator in the center of the viewport confirming the action.

## Project structure

```
src/
├── api/            # HTTP client + TanStack Query hooks
├── components/     # Reusable UI (Navbar, HeroBanner, MediaCard, etc.)
├── hooks/          # Custom hooks (usePopover, usePlaybackPreferences)
├── i18n/           # i18next config + en.json / pt-BR.json
├── pages/          # Route pages (Home, Browse, Player, Settings, etc.)
├── theme/          # MUI dark theme (colors, typography)
├── App.tsx         # Routes + providers
└── main.tsx        # Entry point
```

## Playback preferences

Persisted per-device in `localStorage` and consumed by the Player:

- **Preferred audio language** — auto-selects the matching HLS audio track on first play.
- **Preferred subtitle language + mode** — `always`, `foreignOnly`, `forcedOnly`, or `off`.
- **Default quality** — picks the resolution when available, falls through to the primary file otherwise.
- **Playback speed** — survives across episodes and sessions.

Configured in Settings (`/settings`).
