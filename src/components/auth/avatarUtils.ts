// Pure helpers used by ``Avatar``. Lifted out of the component
// file so React Fast Refresh stays happy (a component module that
// also exports non-component bindings breaks HMR).

const PROFILE_TONES = [
  "radial-gradient(circle at 35% 30%, #d97757, #5a2818)",
  "radial-gradient(circle at 35% 30%, #9070d9, #2a1850)",
  "radial-gradient(circle at 35% 30%, #70a8d9, #18304a)",
  "radial-gradient(circle at 35% 30%, #d99070, #4a2018)",
  "radial-gradient(circle at 35% 30%, #70d9a8, #184a30)",
  "radial-gradient(circle at 35% 30%, #d9d070, #4a4818)",
  "radial-gradient(circle at 35% 30%, #5a5a5a, #1a1a1a)",
];

/**
 * Stable per-profile-id colour. Same id always lands on the same
 * gradient so avatars don't shuffle between sessions before the
 * user uploads a real photo.
 */
export function toneForProfile(profileId: string): string {
  let acc = 0;
  for (let i = 0; i < profileId.length; i += 1) {
    acc = (acc + profileId.charCodeAt(i)) % PROFILE_TONES.length;
  }
  return PROFILE_TONES[acc]!;
}

export function initialsForName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return trimmed.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
