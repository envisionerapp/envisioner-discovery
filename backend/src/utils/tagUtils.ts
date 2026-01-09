/**
 * Tag utility functions for managing category tags
 */

/**
 * Category tags used internally by AI for broad matching
 * These should not be displayed to users
 */
export const CATEGORY_TAGS = [
  '_CAT_GAMBLING',
  '_CAT_GAMING',
  '_CAT_LIFESTYLE',
  '_CAT_CREATIVE',
  '_CAT_EDUCATIONAL',
  // Old category tags (for backward compatibility)
  'GAMING'
] as const;

/**
 * Check if a tag is a category tag (starts with _CAT_ or is a generic category)
 */
export function isCategoryTag(tag: string): boolean {
  // New category tags start with _CAT_
  if (tag.startsWith('_CAT_')) return true;

  // Filter out generic old category tags
  const oldCategoryTags = ['GAMING', 'LIFESTYLE', 'CREATIVE', 'EDUCATIONAL'];
  return oldCategoryTags.includes(tag);
}

/**
 * Filter out category tags from an array of tags
 * Returns only user-facing tags
 */
export function filterCategoryTags(tags: string[]): string[] {
  return tags.filter(tag => !isCategoryTag(tag));
}

/**
 * Add category tags to existing tags based on content
 */
export function addCategoryTags(tags: string[]): string[] {
  const newTags = [...tags];

  // Add _CAT_GAMBLING if any gambling tags present
  const gamblingTags = ['CASINO', 'SLOTS', 'BETTING', 'POKER', 'BLACKJACK', 'ROULETTE', 'GAMBLING', 'IGAMING'];
  if (tags.some(t => gamblingTags.includes(t)) && !tags.includes('_CAT_GAMBLING')) {
    newTags.push('_CAT_GAMBLING');
  }

  // Add _CAT_GAMING if any gaming tags present
  const gamingTags = ['GAMING', 'RPG', 'FPS', 'STRATEGY', 'SIMULATION', 'HORROR', 'ADVENTURE'];
  if (tags.some(t => gamingTags.includes(t)) && !tags.includes('_CAT_GAMING')) {
    newTags.push('_CAT_GAMING');
  }

  // Add _CAT_LIFESTYLE if any lifestyle tags present
  const lifestyleTags = ['IRL', 'COOKING', 'FITNESS', 'FASHION', 'TRAVEL'];
  if (tags.some(t => lifestyleTags.includes(t)) && !tags.includes('_CAT_LIFESTYLE')) {
    newTags.push('_CAT_LIFESTYLE');
  }

  // Add _CAT_CREATIVE if any creative tags present
  const creativeTags = ['MUSIC', 'ART', 'COMEDY', 'VARIETY'];
  if (tags.some(t => creativeTags.includes(t)) && !tags.includes('_CAT_CREATIVE')) {
    newTags.push('_CAT_CREATIVE');
  }

  // Add _CAT_EDUCATIONAL if any educational tags present
  const educationalTags = ['EDUCATION', 'TECHNOLOGY', 'SPORTS'];
  if (tags.some(t => educationalTags.includes(t)) && !tags.includes('_CAT_EDUCATIONAL')) {
    newTags.push('_CAT_EDUCATIONAL');
  }

  return newTags;
}

/**
 * Map category tag to user-friendly display name
 */
export function categoryTagToDisplayName(categoryTag: string): string {
  const map: Record<string, string> = {
    '_CAT_GAMBLING': 'Gambling & Betting',
    '_CAT_GAMING': 'Gaming',
    '_CAT_LIFESTYLE': 'Lifestyle',
    '_CAT_CREATIVE': 'Creative',
    '_CAT_EDUCATIONAL': 'Educational'
  };

  return map[categoryTag] || categoryTag;
}

/**
 * Adding local StreamerTags to existing tags based on content
 */
export enum StreamerTag {
  GAMING='GAMING',
  IRL='IRL',
  MUSIC='MUSIC',
  ART='ART',
  COOKING='COOKING',
  FITNESS='FITNESS',
  EDUCATION='EDUCATION',
  TECHNOLOGY='TECHNOLOGY',
  FASHION='FASHION',
  TRAVEL='TRAVEL',
  SPORTS='SPORTS',
  COMEDY='COMEDY',
  VARIETY='VARIETY',
  RPG='RPG',
  FPS='FPS',
  STRATEGY='STRATEGY',
  SIMULATION='SIMULATION',
  HORROR='HORROR',
  ADVENTURE='ADVENTURE',
  CASINO='CASINO',
  SLOTS='SLOTS',
  BETTING='BETTING',
  POKER='POKER',
  BLACKJACK='BLACKJACK',
  ROULETTE='ROULETTE',
  GAMBLING='GAMBLING',
  IGAMING='IGAMING'
}