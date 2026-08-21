import { AnimatePresence } from 'framer-motion';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { ConnectionBanner } from '../components/ConnectionBanner';
import { SoundControls } from '../components/SoundControls';
import { HomeScreen } from '../screens/HomeScreen';

const RoomsScreen = lazy(() =>
  import('../screens/RoomsScreen').then(({ RoomsScreen }) => ({ default: RoomsScreen }))
);
const LobbyScreen = lazy(() =>
  import('../screens/LobbyScreen').then(({ LobbyScreen }) => ({ default: LobbyScreen }))
);
const GameScreen = lazy(() =>
  import('../screens/GameScreen').then(({ GameScreen }) => ({ default: GameScreen }))
);
const ProfileScreen = lazy(() =>
  import('../screens/ProfileScreen').then(({ ProfileScreen }) => ({ default: ProfileScreen }))
);
const MatchRecapScreen = lazy(() =>
  import('../screens/MatchRecapScreen').then(({ MatchRecapScreen }) => ({
    default: MatchRecapScreen
  }))
);
const LegalScreen = lazy(() =>
  import('../screens/LegalScreen').then(({ LegalScreen }) => ({ default: LegalScreen }))
);

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/join/:code" element={<HomeScreen />} />
        <Route path="/rooms" element={<RoomsScreen />} />
        <Route path="/room/:code" element={<LobbyScreen />} />
        <Route path="/game/:gameId" element={<GameScreen />} />
        <Route path="/match/:gameId" element={<MatchRecapScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/legal/:document" element={<LegalScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ConnectionBanner />
      <SoundControls />
      <Suspense
        fallback={
          <div className="centered-status">
            <p>Cargando Atlas Estates…</p>
          </div>
        }
      >
        <AnimatedRoutes />
      </Suspense>
    </BrowserRouter>
  );
}
