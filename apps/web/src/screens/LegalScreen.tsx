import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { Brand } from '../components/Brand';
import { ScreenTransition } from '../components/ScreenTransition';

const documents = {
  privacy: {
    title: 'Privacy Policy',
    paragraphs: [
      'Atlas Estates stores the nickname and technical session data needed to reconnect you to a room. Finished-match statistics may be retained so a recap can be reopened.',
      'We do not sell personal data. Operational logs are limited to reliability and security diagnostics and must not include reconnect tokens, passwords or message contents.',
      'You may request deletion of account-linked data from the operator shown on the production site. Guest match records may be retained in anonymized form for game integrity.'
    ]
  },
  terms: {
    title: 'Terms of Play',
    paragraphs: [
      'Atlas Estates is an original online strategy game provided as-is. Do not abuse rooms, automate disruptive traffic, impersonate others or attempt to alter another player’s session.',
      'Game availability may be interrupted for maintenance or provider limits. Virtual money and properties have no real-world monetary value.',
      'Players remain responsible for the nickname and chat messages they submit. Access may be limited when necessary to protect other players or the service.'
    ]
  },
  cookies: {
    title: 'Cookies & Local Storage',
    paragraphs: [
      'The game uses local browser storage for the reconnect credential, nickname, sound preferences and graphics preset. These are functional settings required for continuity and do not create advertising profiles.',
      'Hosting providers may set strictly necessary security or load-balancing cookies. Optional analytics must remain disabled until a consent mechanism and provider details are added.',
      'Clearing site data signs the guest session out and removes local preferences; it does not automatically erase an already persisted match result.'
    ]
  }
} as const;

export function LegalScreen() {
  const { document = 'privacy' } = useParams();
  const content = documents[document as keyof typeof documents] ?? documents.privacy;

  return (
    <ScreenTransition className="legal-screen">
      <header>
        <Brand compact />
        <Link className="back-link" to="/">
          <ArrowLeft /> Back home
        </Link>
      </header>
      <main>
        <p className="section-label">Atlas Estates</p>
        <h1>{content.title}</h1>
        <p className="legal-screen__date">Effective 9 August 2026</p>
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <nav aria-label="Legal documents">
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/cookies">Cookies</Link>
        </nav>
      </main>
    </ScreenTransition>
  );
}
