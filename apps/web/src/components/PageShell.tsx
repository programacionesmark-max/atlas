import { UserRound } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

import { Brand } from './Brand';

export function PageShell({ children, quiet = false }: PropsWithChildren<{ quiet?: boolean }>) {
  return (
    <div className="app-shell">
      <header className={quiet ? 'site-header site-header--quiet' : 'site-header'}>
        <Brand compact />
        <nav className="site-nav" aria-label="Primary navigation">
          <Link className="nav-link" to="/profile">
            <UserRound aria-hidden="true" /> <span>Profile</span>
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
