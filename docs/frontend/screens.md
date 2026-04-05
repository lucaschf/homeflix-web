# HomeFlix Screens Specification

Reference: Crunchyroll-style layout with dark theme and peach accent.

---

## 1. Home (Dashboard)

The main landing page after opening the app.

### Layout

```
+--------+--------------------------------------------------+
|        |  [Logo]              [Search]          [Settings] |
|        |--------------------------------------------------|
|  Side  |                                                  |
|  bar   |  +----- Hero Banner (featured content) --------+ |
|        |  | Backdrop with gradient                       | |
|        |  | Title, Year, Duration, Genres                | |
|        |  | Synopsis (2 lines)                           | |
|        |  | [Play]  [+ My List]  [Info]                  | |
|        |  +---------------------------------------------+ |
|        |                                                  |
|        |  Continue Watching                    [See All >] |
|        |  +------+ +------+ +------+ +------+             |
|        |  | 16:9 | | 16:9 | | 16:9 | | 16:9 | -->        |
|        |  | card | | card | | card | | card |             |
|        |  |[===] | |[==  ]| |[=   ]| |[=== ]|            |
|        |  +------+ +------+ +------+ +------+             |
|        |                                                  |
|        |  Recently Added                       [See All >] |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  | 2:3  | | 2:3  | | 2:3  | | 2:3  | | 2:3  |  |
|        |  |poster| |poster| |poster| |poster| |poster|  |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |                                                  |
|        |  Movies                               [See All >] |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  |poster| |poster| |poster| |poster| |poster|  |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |                                                  |
|        |  Series                               [See All >] |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  |poster| |poster| |poster| |poster| |poster|  |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |                                                  |
+--------+--------------------------------------------------+
```

### Sections (top to bottom)

1. **Hero Banner** — randomly selected from recently added or popular content. Auto-rotates every 8 seconds. Shows backdrop image with left-to-right gradient overlay. Dots indicator at bottom.

2. **Continue Watching** — episode/movie cards (16:9) with progress bar overlay. Ordered by last watched. Only shown if user has in-progress items. Card shows: thumbnail at pause point, title, S01E05 format for episodes, progress bar in accent color.

3. **Recently Added** — poster cards (2:3) of content added in the last 30 days. "New" badge on cards.

4. **Movies** — poster cards carousel of all movies.

5. **Series** — poster cards carousel of all series.

### Interactions

- Clicking a poster card navigates to the Detail page
- Clicking "Play" on hero or continue watching card starts playback
- "See All" links navigate to the Browse page with pre-applied filter
- Scroll arrows appear on carousel hover (desktop)

---

## 2. Browse

Grid view of all content with filters and sorting.

### Layout

```
+--------+--------------------------------------------------+
|        |  [Logo]              [Search]          [Settings] |
|        |--------------------------------------------------|
|  Side  |                                                  |
|  bar   |  Browse                                          |
|        |                                                  |
|        |  [All] [Movies] [Series]     Sort: [Recently Added v] |
|        |                                                  |
|        |  Genre: [All v]  Year: [All v]  Status: [All v]  |
|        |                                                  |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  |poster| |poster| |poster| |poster| |poster|  |
|        |  | title| | title| | title| | title| | title|  |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  |poster| |poster| |poster| |poster| |poster|  |
|        |  | title| | title| | title| | title| | title|  |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  |poster| |poster| |poster| |poster| |poster|  |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |                                                  |
|        |  [Load More]                                     |
|        |                                                  |
+--------+--------------------------------------------------+
```

### Filters Bar

- **Type Tabs:** All | Movies | Series (pill buttons, accent for active)
- **Sort Dropdown:** Recently Added, Title A-Z, Title Z-A, Year (newest), Year (oldest), Duration
- **Genre Filter:** dropdown with multi-select
- **Year Filter:** dropdown with range
- **Watch Status:** All, Unwatched, In Progress, Watched

### Grid

- Responsive columns (2-8 depending on breakpoint)
- Poster cards (2:3) with title and year below
- Infinite scroll or "Load More" button
- Skeleton loading on initial load

---

## 3. Movie Detail

Full detail page for a movie.

### Layout

```
+--------+--------------------------------------------------+
|        |  [Logo]              [Search]          [Settings] |
|        |--------------------------------------------------|
|  Side  |                                                  |
|  bar   |  +------ Backdrop (blurred, gradient) ---------+ |
|        |  |                                             | |
|        |  |  +--------+  Title (H1)                     | |
|        |  |  | Poster |  2010  |  2h 28min  |  PG-13    | |
|        |  |  | (2:3)  |  Sci-Fi, Action, Thriller        | |
|        |  |  |        |                                  | |
|        |  |  +--------+  [Play]  [+ List]  [Heart]       | |
|        |  |                                             | |
|        |  +---------------------------------------------+ |
|        |                                                  |
|        |  Synopsis                                        |
|        |  A thief who steals corporate secrets through    |
|        |  the use of dream-sharing technology...          |
|        |  [Show more]                                     |
|        |                                                  |
|        |  File Variants                                   |
|        |  +-------------------------------------------+   |
|        |  | 4K HDR  |  HEVC  |  15.2 GB  | [Primary] |   |
|        |  | 1080p   |  H264  |   4.1 GB  | [Play]    |   |
|        |  | 720p    |  H264  |   2.3 GB  | [Play]    |   |
|        |  +-------------------------------------------+   |
|        |                                                  |
|        |  Details                                         |
|        |  Original Title: Inception                       |
|        |  Audio: English 5.1, Portuguese 2.0              |
|        |  Subtitles: Portuguese, English                  |
|        |                                                  |
+--------+--------------------------------------------------+
```

### Sections

1. **Header** — backdrop image (blurred + gradient), poster overlay on left, metadata on right. Play button is primary CTA (accent).

2. **Synopsis** — full text, truncated to 3 lines with "Show more" toggle.

3. **File Variants** — table showing available resolutions, codec, HDR format, file size. Primary variant highlighted. Each row has a "Play" action.

4. **Details** — technical metadata: original title, audio tracks, subtitle tracks, TMDB/IMDb links.

---

## 4. Series Detail

Detail page for a series, including season/episode navigation.

### Layout

```
+--------+--------------------------------------------------+
|        |  [Logo]              [Search]          [Settings] |
|        |--------------------------------------------------|
|  Side  |                                                  |
|  bar   |  +------ Backdrop (blurred, gradient) ---------+ |
|        |  |                                             | |
|        |  |  +--------+  Title (H1)                     | |
|        |  |  | Poster |  2008-2013  |  5 Seasons         | |
|        |  |  | (2:3)  |  Drama, Crime, Thriller          | |
|        |  |  |        |                                  | |
|        |  |  +--------+  [Play S1E1]  [+ List]  [Heart]  | |
|        |  |                                             | |
|        |  +---------------------------------------------+ |
|        |                                                  |
|        |  Synopsis                                        |
|        |  A chemistry teacher diagnosed with lung cancer  |
|        |  turns to manufacturing methamphetamine...       |
|        |                                                  |
|        |  Season: [1] [2] [3] [4] [5]                     |
|        |                                                  |
|        |  +----------------------------------------------+|
|        |  | +-------+  S01E01 - Pilot                    ||
|        |  | | 16:9  |  58 min  |  Jan 20, 2008           ||
|        |  | | thumb  |  Walter White, a chemistry teacher ||
|        |  | |       |  [===== 45%]                       ||
|        |  | +-------+  [Play]                            ||
|        |  |----------------------------------------------|
|        |  | +-------+  S01E02 - Cat's in the Bag...      ||
|        |  | | 16:9  |  48 min  |  Jan 27, 2008           ||
|        |  | | thumb  |  Walt and Jesse try to dispose of  ||
|        |  | +-------+  [Play]                            ||
|        |  +----------------------------------------------+|
|        |                                                  |
+--------+--------------------------------------------------+
```

### Sections

1. **Header** — same pattern as Movie Detail. Play button starts the next unwatched episode (or S01E01 if none watched). Label on button shows which episode.

2. **Synopsis** — series overview.

3. **Season Selector** — horizontal tabs/pills for each season. Active season in accent. Season 0 labeled "Specials".

4. **Episode List** — vertical list of episodes for the selected season. Each episode card shows:
   - Thumbnail (16:9)
   - Episode number and title
   - Duration and air date
   - Synopsis (1 line, truncated)
   - Progress bar (if in progress)
   - Play button

### Interactions

- Season tab switch loads episodes without page reload
- Clicking episode card navigates to player
- Play button on header auto-selects next unwatched episode

---

## 5. Player

Full-screen video player.

### Layout

```
+-----------------------------------------------------------+
|                                                           |
|                                                           |
|                    Video Content                          |
|                                                           |
|                                                           |
|                      [Play Icon]                          |
|                   (on click/pause)                        |
|                                                           |
|                                                           |
|-----------------------------------------------------------+
|  00:45:30 [========|==================] 02:28:00          |
|                                                           |
|  [<<10] [Play] [>>30]   S01E01 Pilot   [Sub] [Q] [FS]   |
+-----------------------------------------------------------+
```

### Controls Bar (bottom, auto-hide after 3s)

**Row 1: Progress Bar**
- Full-width seek bar
- Played portion in accent color
- Buffered portion in gray
- Hover: timestamp preview tooltip
- Drag to seek

**Row 2: Controls**

Left:
- Skip backward 10s
- Play/Pause
- Skip forward 30s
- Current time / Total time

Center:
- Content title (movie title or "S01E05 - Episode Title")

Right:
- Subtitle selector (dropdown with available tracks)
- Quality selector (dropdown with file variants: 4K, 1080p, etc.)
- Playback speed (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)
- Volume slider
- Fullscreen toggle

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space / K | Play/Pause |
| Left Arrow | Seek -10s |
| Right Arrow | Seek +30s |
| Up Arrow | Volume up |
| Down Arrow | Volume down |
| F | Fullscreen toggle |
| M | Mute toggle |
| Esc | Exit fullscreen / Close player |
| N | Next episode |
| S | Subtitle toggle |

### Auto-play Next Episode

When an episode ends (>= 90% watched):
- Show overlay: "Next Episode in 10s" with countdown
- Poster + title of next episode
- [Play Now] and [Cancel] buttons
- Auto-advances unless cancelled

---

## 6. Search

Global search overlay.

### Layout

```
+-----------------------------------------------------------+
|                                                           |
|  +-----------------------------------------------+       |
|  |  [Search icon]  Search HomeFlix...    [X]     |       |
|  +-----------------------------------------------+       |
|                                                           |
|  Recent Searches                         [Clear All]     |
|  Breaking Bad                                             |
|  Inception                                                |
|                                                           |
|  --- (when typing) ---                                    |
|                                                           |
|  Movies (3)                                               |
|  +-------+ Inception (2010)                               |
|  | thumb | Sci-Fi, Action | 2h 28min                     |
|  +-------+                                                |
|  +-------+ Interstellar (2014)                            |
|  | thumb | Sci-Fi, Drama | 2h 49min                      |
|  +-------+                                                |
|                                                           |
|  Series (1)                                               |
|  +-------+ Breaking Bad (2008-2013)                       |
|  | thumb | Drama, Crime | 5 Seasons                      |
|  +-------+                                                |
|                                                           |
+-----------------------------------------------------------+
```

### Behavior

- Triggered by clicking search icon or pressing Ctrl+K
- Full-screen overlay with dimmed background
- Input auto-focused
- Debounce 300ms before searching
- Results appear as-you-type, grouped by type (Movies, Series)
- Each result shows mini poster, title, year, genres, duration/seasons
- Click result navigates to Detail page
- Esc or click outside closes overlay

---

## 7. My Lists

Collection management page.

### Layout

```
+--------+--------------------------------------------------+
|        |  [Logo]              [Search]          [Settings] |
|        |--------------------------------------------------|
|  Side  |                                                  |
|  bar   |  My Lists                                        |
|        |                                                  |
|        |  [Watchlist] [Favorites] [Custom Lists]          |
|        |                                                  |
|        |  --- Watchlist Tab ---                            |
|        |                                                  |
|        |  12 items                                        |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  |poster| |poster| |poster| |poster| |poster|  |
|        |  | title| | title| | title| | title| | title|  |
|        |  +------+ +------+ +------+ +------+ +------+   |
|        |  +------+ +------+ +------+                     |
|        |  |poster| |poster| |poster|                     |
|        |  +------+ +------+ +------+                     |
|        |                                                  |
+--------+--------------------------------------------------+
```

### Tabs

1. **Watchlist** — items marked "want to watch". Grid of poster cards. Remove action on hover.

2. **Favorites** — favorited items. Same grid layout. Heart icon togglable.

3. **Custom Lists** — user-created lists.
   - Shows list cards: name, item count, first 3 posters preview
   - Click opens list detail with full grid
   - "Create List" button (opens modal: name + description)
   - Drag to reorder items within a list

---

## 8. History

Watch history page.

### Layout

```
+--------+--------------------------------------------------+
|        |  [Logo]              [Search]          [Settings] |
|        |--------------------------------------------------|
|  Side  |                                                  |
|  bar   |  History                              [Clear All]|
|        |                                                  |
|        |  Today                                           |
|        |  +-------+ Inception                             |
|        |  | thumb | Watched at 14:30 | Completed          |
|        |  +-------+                                       |
|        |  +-------+ Breaking Bad S01E05                   |
|        |  | thumb | Watched at 12:15 | 45% complete       |
|        |  +-------+                                       |
|        |                                                  |
|        |  Yesterday                                       |
|        |  +-------+ Interstellar                          |
|        |  | thumb | Watched at 21:00 | Completed          |
|        |  +-------+                                       |
|        |                                                  |
|        |  March 28, 2026                                  |
|        |  +-------+ Breaking Bad S01E04                   |
|        |  | thumb | Watched at 20:30 | Completed          |
|        |  +-------+                                       |
|        |                                                  |
+--------+--------------------------------------------------+
```

### Behavior

- Grouped by date (Today, Yesterday, then specific dates)
- Each entry shows: thumbnail, title, watch time, completion status
- "Clear All" with confirmation dialog
- Individual items removable via hover action

---

## 9. Settings

Application configuration page.

### Layout

```
+--------+--------------------------------------------------+
|        |  [Logo]              [Search]          [Settings] |
|        |--------------------------------------------------|
|  Side  |                                                  |
|  bar   |  Settings                                        |
|        |                                                  |
|        |  Libraries                                       |
|        |  +---------------------------------------------+ |
|        |  | Movies         /media/movies       [Scan]   | |
|        |  | Series         /media/series       [Scan]   | |
|        |  | [+ Add Library]                             | |
|        |  +---------------------------------------------+ |
|        |                                                  |
|        |  Playback                                        |
|        |  +---------------------------------------------+ |
|        |  | Preferred Audio:     [Portuguese v]          | |
|        |  | Preferred Subtitle:  [Portuguese v]          | |
|        |  | Subtitle Mode:       [Foreign audio only v]  | |
|        |  | Default Quality:     [Best available v]      | |
|        |  +---------------------------------------------+ |
|        |                                                  |
|        |  Metadata                                        |
|        |  +---------------------------------------------+ |
|        |  | TMDB API Key:  [**********]    [Test]        | |
|        |  | Auto-enrich:   [On]                          | |
|        |  | [Enrich All]                                 | |
|        |  +---------------------------------------------+ |
|        |                                                  |
|        |  About                                           |
|        |  +---------------------------------------------+ |
|        |  | HomeFlix v0.1.0                              | |
|        |  | API Status: Healthy                          | |
|        |  +---------------------------------------------+ |
|        |                                                  |
+--------+--------------------------------------------------+
```

### Sections

1. **Libraries** — list of configured libraries with paths. Scan button triggers manual scan. Add library opens modal.

2. **Playback** — default audio/subtitle preferences. Applied when no per-media preference exists.

3. **Metadata** — TMDB API key config. Test button validates key. "Enrich All" triggers bulk enrichment.

4. **About** — version info, API health status.

---

## 10. Empty States

### No Content (after first install)

```
+------------------------------------------+
|                                          |
|        [Film Icon - xl]                  |
|                                          |
|     Welcome to HomeFlix                  |
|                                          |
|   Add a library to get started.          |
|   Point to a folder with your movies     |
|   and series, and we'll do the rest.     |
|                                          |
|        [Add Library]                     |
|                                          |
+------------------------------------------+
```

### No Search Results

```
|   No results for "query"                 |
|   Try a different search term            |
```

### Empty List

```
|   [List Icon]                            |
|   This list is empty                     |
|   Browse content to add items            |
|   [Browse]                               |
```

### No History

```
|   [Clock Icon]                           |
|   No watch history yet                   |
|   Start watching something!              |
|   [Browse]                               |
```
