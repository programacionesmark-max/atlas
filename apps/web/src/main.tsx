import '@fontsource-variable/manrope';
import '@fontsource-variable/space-grotesk';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { soundManager } from './audio/sound-manager';
import { initializeRealtime } from './store/realtime';
import './styles.css';

initializeRealtime();
soundManager.installAutoUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
