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
| `yarn test` | Run the Vitest suite once |
| `yarn test:watch` | Vitest in watch mode |

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
| `C` | Toggle picture shape (aspect ratio) menu |
| `T` | Toggle audio track menu |
| `S` | Toggle subtitle menu |
| `A` | Cycle picture shape |
| `B` | Cycle audio track |
| `V` | Cycle subtitle track (… → off → first) |
| `?` | Show the keyboard map |
| `Esc` | Close the topmost surface / exit fullscreen / go back |

All player shortcuts show a brief animated indicator in the center of the viewport confirming the action.

This table is also in the player itself: `?` (or the gear ▸ **Keyboard shortcuts**)
draws it over the picture, grouped by context. The card doesn't trap focus — the
keys it lists keep working while it is up, so a row can be read and tried in one
go. It is rendered from `src/utils/playerShortcuts.ts`, which is the list to
extend when a binding is added.

Player shortcuts are bare keys: anything held with Ctrl, Cmd or Alt belongs to
the browser and the player ignores it.

## Project structure

```
src/
├── api/            # HTTP client + TanStack Query hooks
├── components/     # Reusable UI (Navbar, HeroBanner, MediaCard, etc.)
├── hooks/          # Custom hooks (usePopover, usePlaybackPreferences)
├── i18n/           # i18next config + en.json / pt-BR.json
├── pages/          # Route pages (Home, Browse, Player, Settings, etc.)
├── test/           # Vitest setup (jsdom + Testing Library)
├── theme/          # MUI dark theme (colors, typography)
├── App.tsx         # Routes + providers
└── main.tsx        # Entry point
```

## Playback preferences

Stored per profile on the backend (`GET`/`PUT /api/v1/preferences`), so they
follow the viewer across devices; `localStorage` keeps a per-profile copy as a
first-render cache. Consumed by the Player:

- **Preferred audio language** — auto-selects the matching HLS audio track on first play.
- **Preferred subtitle language + mode** — `always`, `foreignOnly`, `forcedOnly`, or `off`.
- **Subtitle appearance** — color, background, size and edge treatment.
- **Default quality** — picks the resolution when available, falls through to the primary file otherwise.
- **Playback speed** — survives across episodes and sessions.
- **Opening** (`intro_skip_mode`) — `manual` (the Skip Intro button, nothing moves
  on its own), `auto`, or `autoAfterFirst` (plays the theme on episode 1 of a
  season, skips it from episode 2 on). Only episodes carrying an intro marker are
  affected. At most one automatic skip per playback, never on an opening the
  viewer seeked into, and a short "watch it after all" offer follows every skip.
- **End credits** (`credits_skip_mode`) — `manual` shows the next-episode card and
  waits for the click; `auto` rolls into the next episode at the detected credits
  onset. The last episode of a series and movies always wait. Episodes with no
  credits marker keep the end-of-file auto-advance either way.

Configured in Settings (`/settings`).

## Picture shape

Some transfers arrive with the wrong aspect ratio flagged — 4:3 broadcast
material stored as 16:9 is the usual one, and it plays back horizontally
stretched with nothing in the stream to say so. The player can override the
shape the way VLC's *Video ▸ Aspect Ratio* does: `A` steps through the shapes
the way VLC's own key does, `C` opens the list to pick one, and the gear in the
control bar ▸ **Aspect ratio** gets there with the mouse.

- **Original** — the file's own ratio. The default; nothing is touched.
- **16:9 / 4:3 / 16:10 / 2.35:1 / 1:1** — forced display ratio. The whole frame
  stays visible, reshaped to fit, letterboxed or pillarboxed as needed.
- **Stretch** — fills the stage, ignoring the shape.
- **Zoom** — fills the stage by cropping the overflow (eats letterbox bars baked
  into the picture).

The choice is remembered **per title** in `localStorage`, keyed on the movie or
the *series* rather than the episode, so a bad rip is corrected once and stays
corrected for the rest of the show. Deliberately not a server-side playback
preference: a stretched file is a property of that file, not a taste the viewer
carries from title to title.

