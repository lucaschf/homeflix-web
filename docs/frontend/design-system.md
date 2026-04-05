# HomeFlix Design System

## 1. Foundations

### 1.1 Color Palette

**Base:** Dark theme inspired by Crunchyroll's interface.
**Accent:** Peach/coral inspired by Claude's brand color.

#### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-primary` | `#0D0D0D` | Main background (body) |
| `--color-bg-secondary` | `#141414` | Cards, panels, sidebar |
| `--color-bg-tertiary` | `#1A1A1A` | Hover states, elevated surfaces |
| `--color-bg-overlay` | `rgba(0,0,0,0.7)` | Modal/dialog overlays |

#### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-accent` | `#E8926F` | Primary CTA, active states, progress bars |
| `--color-accent-hover` | `#D47A57` | Accent hover state |
| `--color-accent-light` | `#F0A889` | Accent subtle (tags, badges) |
| `--color-accent-bg` | `rgba(232,146,111,0.15)` | Accent background tint |

#### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#FFFFFF` | Headings, important text |
| `--color-text-secondary` | `#A0A0A0` | Body text, descriptions |
| `--color-text-tertiary` | `#666666` | Placeholders, disabled text |
| `--color-text-inverse` | `#0D0D0D` | Text on accent buttons |

#### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#4ADE80` | Completed, confirmed |
| `--color-warning` | `#FBBF24` | Warnings, in-progress |
| `--color-error` | `#F87171` | Errors, destructive actions |
| `--color-info` | `#60A5FA` | Informational |

#### Surface & Border

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-border` | `#2A2A2A` | Dividers, card borders |
| `--color-border-hover` | `#3A3A3A` | Border hover state |
| `--color-surface-glass` | `rgba(255,255,255,0.05)` | Glassmorphism panels |

### 1.2 Typography

**Font Family:** `Inter` (primary), `system-ui` (fallback)

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Display | 36px / 2.25rem | 700 | 1.2 | Hero titles |
| H1 | 28px / 1.75rem | 700 | 1.3 | Page titles |
| H2 | 22px / 1.375rem | 600 | 1.3 | Section headers |
| H3 | 18px / 1.125rem | 600 | 1.4 | Card titles |
| Body | 14px / 0.875rem | 400 | 1.5 | General text |
| Body Small | 12px / 0.75rem | 400 | 1.5 | Metadata, captions |
| Caption | 11px / 0.6875rem | 500 | 1.4 | Badges, labels |

### 1.3 Spacing Scale

Based on 4px increments:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Inline spacing, icon gaps |
| `--space-2` | 8px | Tight padding |
| `--space-3` | 12px | Card inner padding |
| `--space-4` | 16px | Standard padding |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Card gaps in grids |
| `--space-8` | 32px | Section margins |
| `--space-10` | 40px | Page margins |
| `--space-12` | 48px | Large section spacing |
| `--space-16` | 64px | Hero spacing |

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Buttons, badges |
| `--radius-md` | 8px | Cards, inputs |
| `--radius-lg` | 12px | Modals, panels |
| `--radius-xl` | 16px | Hero cards |
| `--radius-full` | 9999px | Avatars, pills |

### 1.5 Shadows & Elevation

| Level | Value | Usage |
|-------|-------|-------|
| Elevation 1 | `0 1px 3px rgba(0,0,0,0.5)` | Cards at rest |
| Elevation 2 | `0 4px 12px rgba(0,0,0,0.6)` | Cards on hover |
| Elevation 3 | `0 8px 24px rgba(0,0,0,0.7)` | Modals, dropdowns |
| Glow | `0 0 20px rgba(232,146,111,0.3)` | Accent focus glow |

### 1.6 Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `150ms ease` | Hover, color changes |
| `--transition-normal` | `250ms ease` | Scale, opacity |
| `--transition-slow` | `400ms ease` | Layout shifts, modals |

---

## 2. Components

### 2.1 Media Card

The primary content unit. Used in carousels and grids.

**Variants:**
- **Poster Card** (portrait, 2:3 ratio) — movies, series
- **Episode Card** (landscape, 16:9 ratio) — episodes, continue watching
- **Hero Card** (wide, 21:9 ratio) — featured content banner

**States:**
- Default: poster image, title below
- Hover: slight scale (1.05), shadow elevation 2, play icon overlay
- Loading: shimmer/skeleton placeholder
- No Image: gradient background + text fallback

**Anatomy (Poster Card):**
```
+-------------------------+
|                         |
|      Poster Image       |
|      (2:3 ratio)        |
|                         |
|  [Progress Bar]         |
+-------------------------+
  Title                    
  Year  |  Duration        
```

### 2.2 Navigation Sidebar

Fixed left sidebar (collapsed by default on mobile).

**Items:**
- Home (logo + brand)
- Browse
- My Lists
- History
- Settings

**Behavior:**
- Desktop: expanded (240px) or collapsed (64px)
- Tablet: collapsed icon-only
- Mobile: hidden, opened via hamburger

### 2.3 Hero Banner

Featured content section at the top of the Home page.

**Anatomy:**
```
+---------------------------------------------------+
|  Backdrop Image (gradient overlay left-to-right)   |
|                                                    |
|  Title (Display)                                   |
|  Year | Duration | Genres                          |
|  Synopsis (2 lines, truncated)                     |
|                                                    |
|  [Play Button]  [Add to List]  [More Info]         |
+---------------------------------------------------+
```

### 2.4 Carousel

Horizontal scrolling row of Media Cards.

**Anatomy:**
```
Section Title                          [See All >]
+------+ +------+ +------+ +------+ +------+
| Card | | Card | | Card | | Card | | Card | -->
+------+ +------+ +------+ +------+ +------+
```

**Behavior:**
- Left/right scroll arrows on hover (desktop)
- Swipe on mobile/tablet
- Peek: show partial next card to indicate scrollability
- Smooth scroll animation

### 2.5 Player Controls

Video player overlay with controls.

**Layout:**
```
+---------------------------------------------------+
|                                                    |
|              Video Content Area                    |
|                                                    |
|---------------------------------------------------+
|  [Progress Bar - full width, accent color]         |
|  [<<] [Play/Pause] [>>]    Title    [Sub] [Qual] [FS] |
+---------------------------------------------------+
```

**Controls:**
- Play/Pause (center, large)
- Seek bar (accent color, buffered section in gray)
- Skip backward/forward (10s/30s)
- Volume slider
- Subtitle selector
- Quality/variant selector
- Fullscreen toggle
- Playback speed

### 2.6 Buttons

| Variant | Background | Text | Usage |
|---------|-----------|------|-------|
| Primary | `--color-accent` | `--color-text-inverse` | Main CTA (Play, Save) |
| Secondary | `transparent` | `--color-text-primary` | Secondary actions (Add to List) |
| Ghost | `transparent` | `--color-text-secondary` | Tertiary (Cancel, Back) |
| Icon | `--color-bg-tertiary` | `--color-text-primary` | Round icon buttons |

**Sizes:** `sm` (32px), `md` (40px), `lg` (48px)

### 2.7 Search

Global search accessible from the top bar.

**Behavior:**
- Click/shortcut (Ctrl+K) opens search overlay
- Debounce 300ms before querying
- Results grouped: Movies, Series, Episodes
- Each result shows poster thumbnail + title + year
- Recent searches saved locally

### 2.8 Badges & Tags

- **Genre Tag:** pill shape, `--color-bg-tertiary`, `--color-text-secondary`
- **Resolution Badge:** `4K`, `1080p` — accent background for 4K, subtle for others
- **HDR Badge:** accent pill
- **New Badge:** accent pill, shown for items added in the last 7 days
- **Progress Badge:** percentage or "Watched" in green

---

## 3. Layout

### 3.1 Grid System

| Breakpoint | Name | Columns | Gutter | Sidebar |
|-----------|------|---------|--------|---------|
| < 640px | Mobile | 2 | 12px | Hidden |
| 640-1024px | Tablet | 3-4 | 16px | Collapsed |
| 1024-1440px | Desktop | 5-6 | 20px | Expanded |
| > 1440px | Wide | 7-8 | 24px | Expanded |

### 3.2 Page Structure

```
+--------+------------------------------------------+
|        |  Top Bar (search, user)                   |
|  Side  |------------------------------------------|
|  bar   |                                          |
|        |  Content Area                            |
|        |  (scrollable)                            |
|        |                                          |
|        |                                          |
+--------+------------------------------------------+
```

### 3.3 Z-Index Scale

| Level | Value | Usage |
|-------|-------|-------|
| Content | 0 | Default content |
| Sticky | 10 | Sticky headers |
| Sidebar | 20 | Navigation sidebar |
| Dropdown | 30 | Dropdowns, tooltips |
| Modal | 40 | Modal dialogs |
| Toast | 50 | Notifications |
| Player | 60 | Fullscreen player |

---

## 4. Motion & Animation

### 4.1 Principles

- **Purposeful:** animations communicate state changes, not decoration
- **Quick:** most transitions under 300ms
- **Subtle:** small scale/opacity changes, avoid dramatic effects

### 4.2 Common Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| Card hover scale | 250ms | ease-out | 1.0 -> 1.05 |
| Fade in | 200ms | ease-in | Page content load |
| Slide up | 300ms | ease-out | Modal entrance |
| Progress bar | 150ms | linear | Playback position |
| Skeleton shimmer | 1.5s | linear | Loading states |

---

## 5. Iconography

**Icon set:** Lucide React (consistent, clean line icons)

**Sizes:**
- `sm`: 16px (inline, badges)
- `md`: 20px (navigation, buttons)
- `lg`: 24px (feature icons)
- `xl`: 32px (empty states)

**Key Icons:**
- Play, Pause, SkipForward, SkipBack
- Heart (favorite), Plus (add to list), Clock (history)
- Search, Settings, ChevronRight
- Monitor (quality), Subtitles, Volume2
- Film, Tv, FolderOpen (library)
