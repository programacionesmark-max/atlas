import type { CSSProperties } from 'react';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function PlayerAvatar({
  name,
  color,
  size = 46
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="player-avatar"
      style={{ '--avatar-color': color, width: size, height: size } as CSSProperties}
      aria-label={`${name} avatar`}
    >
      {initials(name)}
    </span>
  );
}
