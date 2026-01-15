// Region enum to flag mapping (legacy format)
const FLAG_MAP: Record<string, string> = {
  // Latin America
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
  // North America
  usa: '🇺🇸',
  canada: '🇨🇦',
  // Europe
  uk: '🇬🇧',
  spain: '🇪🇸',
  germany: '🇩🇪',
  france: '🇫🇷',
  italy: '🇮🇹',
  portugal: '🇵🇹',
  netherlands: '🇳🇱',
  sweden: '🇸🇪',
  norway: '🇳🇴',
  denmark: '🇩🇰',
  finland: '🇫🇮',
  poland: '🇵🇱',
  russia: '🇷🇺',
  // Asia
  japan: '🇯🇵',
  korea: '🇰🇷',
  china: '🇨🇳',
  india: '🇮🇳',
  indonesia: '🇮🇩',
  philippines: '🇵🇭',
  thailand: '🇹🇭',
  vietnam: '🇻🇳',
  malaysia: '🇲🇾',
  singapore: '🇸🇬',
  // Oceania
  australia: '🇦🇺',
  new_zealand: '🇳🇿',
  // Other
  worldwide: '🌎',
  other: '🏳️',
};

// ISO country code to flag mapping (from inferredCountry)
const ISO_FLAG_MAP: Record<string, string> = {
  // Latin America
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
  // North America
  US: '🇺🇸',
  CA: '🇨🇦',
  // Europe
  GB: '🇬🇧',
  ES: '🇪🇸',
  DE: '🇩🇪',
  FR: '🇫🇷',
  IT: '🇮🇹',
  PT: '🇵🇹',
  NL: '🇳🇱',
  SE: '🇸🇪',
  NO: '🇳🇴',
  DK: '🇩🇰',
  FI: '🇫🇮',
  PL: '🇵🇱',
  RU: '🇷🇺',
  // Asia
  JP: '🇯🇵',
  KR: '🇰🇷',
  CN: '🇨🇳',
  IN: '🇮🇳',
  ID: '🇮🇩',
  PH: '🇵🇭',
  TH: '🇹🇭',
  VN: '🇻🇳',
  MY: '🇲🇾',
  SG: '🇸🇬',
  // Oceania
  AU: '🇦🇺',
  NZ: '🇳🇿',
};

// ISO country code to label mapping
const ISO_LABEL_MAP: Record<string, string> = {
  // Latin America
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
  // North America
  US: 'USA',
  CA: 'Canada',
  // Europe
  GB: 'UK',
  ES: 'Spain',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  PT: 'Portugal',
  NL: 'Netherlands',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  RU: 'Russia',
  // Asia
  JP: 'Japan',
  KR: 'Korea',
  CN: 'China',
  IN: 'India',
  ID: 'Indonesia',
  PH: 'Philippines',
  TH: 'Thailand',
  VN: 'Vietnam',
  MY: 'Malaysia',
  SG: 'Singapore',
  // Oceania
  AU: 'Australia',
  NZ: 'New Zealand',
};

const LABEL_MAP: Record<string, string> = {
  costa_rica: 'Costa Rica',
  el_salvador: 'El Salvador',
  dominican_republic: 'Dominican Republic',
  puerto_rico: 'Puerto Rico',
  new_zealand: 'New Zealand',
};

const titleCase = (s: string) => s.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '').join(' ');

/**
 * Get flag emoji for a region or ISO country code
 * Supports both legacy region format (mexico, colombia) and ISO codes (MX, CO)
 * Returns empty string for unknown/OTHER regions
 */
export const flagFor = (region: string): string => {
  if (!region) return '';

  // Check if it's an ISO code (2 uppercase letters)
  if (region.length === 2 && region === region.toUpperCase()) {
    return ISO_FLAG_MAP[region] || '';
  }

  // Convert to lowercase for Region enum values (DOMINICAN_REPUBLIC -> dominican_republic)
  const key = region.toLowerCase();

  // Don't show flag for OTHER/unknown regions
  if (key === 'other' || key === 'worldwide') return '';

  return FLAG_MAP[key] || '';
};

/**
 * Get human-readable label for a region or ISO country code
 * Supports both legacy region format (mexico, colombia) and ISO codes (MX, CO)
 * Returns empty string for unknown/OTHER regions
 */
export const regionLabel = (region: string): string => {
  if (!region) return '';

  // Check if it's an ISO code (2 uppercase letters)
  if (region.length === 2 && region === region.toUpperCase()) {
    return ISO_LABEL_MAP[region] || '';
  }

  const key = region.toLowerCase();

  // Don't show label for OTHER/unknown regions
  if (key === 'other' || key === 'worldwide') return '';

  return LABEL_MAP[key] || titleCase(key);
};

/**
 * Get the best country display for a streamer
 * Prefers inferredCountry (from cross-platform unification) over region
 * Returns empty values for unknown/OTHER regions
 */
export const getCountryDisplay = (streamer: { inferredCountry?: string | null; region?: string | null }): { flag: string; label: string } => {
  const country = streamer.inferredCountry || streamer.region;
  if (!country) {
    return { flag: '', label: '' };
  }

  // Return empty for OTHER/unknown regions
  const key = country.toLowerCase();
  if (key === 'other' || key === 'worldwide') {
    return { flag: '', label: '' };
  }

  return {
    flag: flagFor(country),
    label: regionLabel(country),
  };
};
