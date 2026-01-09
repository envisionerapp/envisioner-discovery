import React, { useState, useEffect } from 'react';

interface StreamDurationTimerProps {
  startTime: Date;
  isLive: boolean;
}

export const StreamDurationTimer: React.FC<StreamDurationTimerProps> = ({ startTime, isLive }) => {
  const [duration, setDuration] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!isLive) return;

    const updateDuration = () => {
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const totalSeconds = Math.floor(diffMs / 1000);

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setDuration({ hours, minutes, seconds });
    };

    // Update immediately
    updateDuration();

    // Update every second
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [startTime, isLive]);

  if (!isLive) {
    return (
      <span className="text-[10px] text-gray-500">-</span>
    );
  }

  const formatNumber = (num: number) => String(num).padStart(2, '0');

  return (
    <span
      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg font-mono text-xs font-bold"
      style={{
        background: '#fdc600',
        color: '#000000'
      }}
    >
      {duration.hours > 0 && (
        <>
          <span>{formatNumber(duration.hours)}</span>
          <span>:</span>
        </>
      )}
      <span>{formatNumber(duration.minutes)}</span>
      <span>:</span>
      <span>{formatNumber(duration.seconds)}</span>
    </span>
  );
};
