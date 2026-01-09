import React, { useMemo, CSSProperties } from 'react';
import twitchRaw from '@/assets/platforms/twitch.svg?raw';
import youtubeRaw from '@/assets/platforms/youtube.svg?raw';
import kickRaw from '@/assets/platforms/kick.svg?raw';

type Platform = 'twitch' | 'youtube' | 'kick';

export const PlatformIcon: React.FC<{ name: Platform; className?: string; style?: CSSProperties }>= ({ name, className, style }) => {
  const raw = name === 'twitch' ? twitchRaw : name === 'youtube' ? youtubeRaw : kickRaw;

  const colored = useMemo(() => {
    // Ensure the root svg scales to container and paths inherit currentColor
    let svg = raw
      .replace('<svg ', '<svg width="100%" height="100%" ')
      .replace(/<path /g, '<path fill="currentColor" ');
    return svg;
  }, [raw]);

  // Wrap in a span so tailwind size classes apply to the box
  return (
    <span
      className={className}
      style={style}
      // color comes from parent (e.g., brand-twitch), svg fills use currentColor
      dangerouslySetInnerHTML={{ __html: colored }}
    />
  );
};
