/**
 * Join a list of genre names for prose: comma-separated, with the
 * localized conjunction before the last one.
 *
 *   ["Sci-fi"]                        → "Sci-fi"
 *   ["Sci-fi", "Adventure"]           → "Sci-fi and Adventure"
 *   ["Sci-fi", "Adventure", "Drama"]  → "Sci-fi, Adventure and Drama"
 *
 * ``conjunction`` comes from i18n (``hero.listConjunction``) so the
 * caller decides the language; an empty list yields "".
 */
export function formatGenreList(genres: readonly string[], conjunction: string): string {
  const names = genres.filter((g) => g.trim() !== "");
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  const head = names.slice(0, -1).join(", ");
  return `${head} ${conjunction} ${names[names.length - 1]}`;
}
