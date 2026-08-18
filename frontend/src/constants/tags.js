// Canonical tag vocabulary — must match what the backend stores in each column.
// Landscape = geographic features. Activities = things you do there.

export const WILDLIFE_TAGS = [
  'bear', 'deer', 'snake', 'alligator', 'turkey', 'fox', 'coyote',
  'raccoon', 'bobcat', 'wild boar', 'wild horse', 'hawk', 'eagle',
  'osprey', 'owl', 'firefly', 'elk', 'river otter', 'beaver',
  'armadillo', 'bat',
]

export const LANDSCAPE_TAGS = [
  'waterfall', 'lake', 'pond', 'river', 'creek', 'mountain', 'ridge',
  'valley', 'forest', 'meadow', 'beach', 'canyon', 'cave', 'hot spring',
  'swamp', 'island', 'waterfront', 'shaded',
]

// kept for backend compat (terrain_tags column still uses these values)
export const TERRAIN_TAGS = LANDSCAPE_TAGS

export const ACTIVITY_TAGS = [
  'fishing', 'hunting', 'hiking', 'trail', 'walk-in',
  'swimming', 'boating', 'boat ramp', 'primitive',
]
