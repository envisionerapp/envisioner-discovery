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
};

const LABEL_MAP: Record<string, string> = {
  costa_rica: 'Costa Rica',
  el_salvador: 'El Salvador',
  dominican_republic: 'Dominican Republic',
  puerto_rico: 'Puerto Rico',
};

const titleCase = (s: string) => s.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '').join(' ');

export const flagFor = (region: string): string => {
  if (!region) return '🏳️';
  const key = region.toLowerCase();
  return FLAG_MAP[key] || '🏳️';
};

export const regionLabel = (region: string): string => {
  if (!region) return '';
  const key = region.toLowerCase();
  return LABEL_MAP[key] || titleCase(key);
};
