/**
 * Character appearance options.
 *
 * Characters are drawn procedurally from these palettes, so an appearance is
 * just six small integers - cheap to store, cheap to send to every other
 * player in view.
 */

export const SKIN_TONES = ['#f3d2b3', '#e8b98d', '#c98d5f', '#a06a3f', '#7a4a2a', '#5a3520'];
export const HAIR_COLOURS = ['#2b2118', '#5b3a1e', '#a45a2a', '#d9b26b', '#8d8d8d', '#e6e6e6', '#3b6ea5', '#7a4a8a'];
export const SHIRT_COLOURS = ['#c0392b', '#2e86c1', '#27ae60', '#8e44ad', '#d68910', '#16a085', '#5d6d7e', '#e6e6e6'];
export const LEG_COLOURS = ['#34495e', '#6e4b3a', '#2c3e50', '#7f8c8d', '#4a3f6b', '#1e6b52', '#8b5a2b', '#3d3d3d'];
export const HAIR_STYLES = ['short', 'long', 'bun', 'braids', 'curly', 'cropped', 'ponytail', 'bald'];
export const BUILDS = ['slim', 'sturdy'];

export const APPEARANCE_FIELDS = Object.freeze({
  skin: SKIN_TONES.length,
  hair: HAIR_STYLES.length,
  hairColour: HAIR_COLOURS.length,
  shirt: SHIRT_COLOURS.length,
  legs: LEG_COLOURS.length,
  build: BUILDS.length
});

export function defaultAppearance() {
  return { skin: 1, hair: 0, hairColour: 1, shirt: 1, legs: 0, build: 0 };
}

export function sanitizeAppearance(input) {
  const out = defaultAppearance();
  if (!input || typeof input !== 'object') return out;
  for (const [field, size] of Object.entries(APPEARANCE_FIELDS)) {
    const value = Number(input[field]);
    if (Number.isFinite(value)) out[field] = ((Math.floor(value) % size) + size) % size;
  }
  return out;
}

export function randomAppearance(rng = Math.random) {
  const out = {};
  for (const [field, size] of Object.entries(APPEARANCE_FIELDS)) {
    out[field] = Math.floor(rng() * size);
  }
  return out;
}

export function appearanceColours(appearance) {
  const a = sanitizeAppearance(appearance);
  return {
    skin: SKIN_TONES[a.skin],
    hair: HAIR_COLOURS[a.hairColour],
    hairStyle: HAIR_STYLES[a.hair],
    shirt: SHIRT_COLOURS[a.shirt],
    legs: LEG_COLOURS[a.legs],
    build: BUILDS[a.build]
  };
}
