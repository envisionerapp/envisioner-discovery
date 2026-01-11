// Region enum to flag mapping (legacy format)
const FLAG_MAP: Record<string, string> = {
  mexico: '🇲🇽',
  colombia: '🇨🇴',
  chile: '🇨🇱',
  argentina: '🇦🇷',
  peru: '🇵🇪',
  venezuela: '🇻🇪',
  uruguay: '🇺🇾',
  paraguay: '🇵🇾',
  bolivia: '🇧🇴',
  brazil: '🇧🇷',
  ecuador: '🇪🇨',
  costa_rica: '🇨🇷',
  panama: '🇵🇦',
  guatemala: '🇬🇹',
  el_salvador: '🇸🇻',
  honduras: '🇭🇳',
  nicaragua: '🇳🇮',
  dominican_republic: '🇩🇴',
  puerto_rico: '🇵🇷',
  usa: '🇺🇸',
  canada: '🇨🇦',
  uk: '🇬🇧',
  spain: '🇪🇸',
  germany: '🇩🇪',
  france: '🇫🇷',
  italy: '🇮🇹',
  portugal: '🇵🇹',
  japan: '🇯🇵',
  korea: '🇰🇷',
  worldwide: '🌎',
};

// ISO country code to flag mapping (from inferredCountry)
const ISO_FLAG_MAP: Record<string, string> = {
  MX: '🇲🇽',
  CO: '🇨🇴',
  CL: '🇨🇱',
  AR: '🇦🇷',
  PE: '🇵🇪',
  VE: '🇻🇪',
  UY: '🇺🇾',
  PY: '🇵🇾',
  BO: '🇧🇴',
  BR: '🇧🇷',
  EC: '🇪🇨',
  CR: '🇨🇷',
  PA: '🇵🇦',
  GT: '🇬🇹',
  SV: '🇸🇻',
  HN: '🇭🇳',
  NI: '🇳🇮',
  DO: '🇩🇴',
  PR: '🇵🇷',
  US: '🇺🇸',
  CA: '🇨🇦',
  GB: '🇬🇧',
  ES: '🇪🇸',
  DE: '🇩🇪',
  FR: '🇫🇷',
  IT: '🇮🇹',
  PT: '🇵🇹',
  JP: '🇯🇵',
  KR: '🇰🇷',
};

// ISO country code to label mapping
const ISO_LABEL_MAP: Record<string, string> = {
  MX: 'Mexico',
  CO: 'Colombia',
  CL: 'Chile',
  AR: 'Argentina',
  PE: 'Peru',
  VE: 'Venezuela',
  UY: 'Uruguay',
  PY: 'Paraguay',
  BO: 'Bolivia',
  BR: 'Brazil',
  EC: 'Ecuador',
  CR: 'Costa Rica',
  PA: 'Panama',
  GT: 'Guatemala',
  SV: 'El Salvador',
  HN: 'Honduras',
  NI: 'Nicaragua',
  DO: 'Dominican Republic',
  PR: 'Puerto Rico',
  US: 'USA',
  CA: 'Canada',
  GB: 'UK',
  ES: 'Spain',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  PT: 'Portugal',
  JP: 'Japan',
  KR: 'Korea',
};

const LABEL_MAP: Record<string, string> = {
  costa_rica: 'Costa Rica',
  el_salvador: 'El Salvador',
  dominican_republic: 'Dominican Republic',
  puerto_rico: 'Puerto Rico',
};

const titleCase = (s: string) => s.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '').join(' ');

/**
 * Get flag emoji for a region or ISO country code
 * Supports both legacy region format (mexico, colombia) and ISO codes (MX, CO)
 */
export const flagFor = (region: string): string => {
  if (!region) return '🏳️';

  // Check if it's an ISO code (2 uppercase letters)
  if (region.length === 2 && region === region.toUpperCase()) {
    return ISO_FLAG_MAP[region] || '🏳️';
  }

  const key = region.toLowerCase();
  return FLAG_MAP[key] || '🏳️';
};

/**
 * Get human-readable label for a region or ISO country code
 * Supports both legacy region format (mexico, colombia) and ISO codes (MX, CO)
 */
export const regionLabel = (region: string): string => {
  if (!region) return '';

  // Check if it's an ISO code (2 uppercase letters)
  if (region.length === 2 && region === region.toUpperCase()) {
    return ISO_LABEL_MAP[region] || region;
  }

  const key = region.toLowerCase();
  return LABEL_MAP[key] || titleCase(key);
};

/**
 * Get the best country display for a streamer
 * Prefers inferredCountry (from cross-platform unification) over region
 */
export const getCountryDisplay = (streamer: { inferredCountry?: string | null; region?: string | null }): { flag: string; label: string } => {
  const country = streamer.inferredCountry || streamer.region;
  if (!country) {
    return { flag: '🏳️', label: '' };
  }
  return {
    flag: flagFor(country),
    label: regionLabel(country),
  };
};
