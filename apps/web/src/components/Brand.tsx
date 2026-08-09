import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="Atlas Estates home">
      <span className={compact ? 'brand__stack brand__stack--compact' : 'brand__stack'}>
        <span>ATLAS</span>
        <span>ESTATES</span>
      </span>
      <svg className="brand__circuit" viewBox="0 0 72 32" aria-hidden="true">
        <circle cx="36" cy="16" r="13" />
        <path d="M36 1v30M21 16h30M29 9c5 3 9 3 14 0M29 23c5-3 9-3 14 0M36 4l4 9 9 3-9 3-4 9-4-9-9-3 9-3z" />
      </svg>
    </Link>
  );
}
