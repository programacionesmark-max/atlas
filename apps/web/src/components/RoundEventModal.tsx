import type { PendingRoundEvent, RoundEventResult } from '@circuit/game-engine';
import { Gift, Landmark, Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect } from 'react';

interface RoundEventModalProps {
  pendingEvent: PendingRoundEvent | null;
  result: RoundEventResult | null;
  playerName: string;
  canReveal: boolean;
  pending: boolean;
  onReveal: (cardIndex: number) => void;
  onDismiss: () => void;
}

const CARD_LABELS = ['Suerte', 'Azar', 'Premio'] as const;

export function RoundEventModal({
  pendingEvent,
  result,
  playerName,
  canReveal,
  pending,
  onReveal,
  onDismiss
}: RoundEventModalProps) {
  useEffect(() => {
    if (!result || pendingEvent) return;
    const timer = window.setTimeout(onDismiss, 5_500);
    return () => window.clearTimeout(timer);
  }, [onDismiss, pendingEvent, result]);

  return (
    <motion.div
      className="modal-backdrop round-event-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-event-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.section
        className="round-event-modal"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <div className="round-event-orbit" aria-hidden="true">
          <Sparkles />
        </div>
        <span className="round-event-kicker">
          <Landmark /> Carta de suerte · Ronda {pendingEvent?.round ?? result?.round}
        </span>
        <h2 id="round-event-title">
          {pendingEvent ? `${playerName}, elige una carta` : 'Resultado de la carta'}
        </h2>
        {pendingEvent ? (
          <>
            <p>Puedes ganar o perder dinero, una ciudad o una mejora.</p>
            <div className="round-event-cards">
              {CARD_LABELS.map((label, index) => (
                <motion.button
                  key={label}
                  type="button"
                  disabled={!canReveal || pending}
                  onClick={() => onReveal(index)}
                  {...(canReveal
                    ? {
                        whileHover: { y: -8, rotate: index - 1 },
                        whileTap: { scale: 0.96 }
                      }
                    : {})}
                >
                  <span>?</span>
                  <strong>{label}</strong>
                  <small>Carta {index + 1}</small>
                </motion.button>
              ))}
            </div>
            <small className="round-event-waiting">
              {canReveal ? 'Elige una carta' : `Esperando a ${playerName}`}
            </small>
          </>
        ) : result ? (
          <div className={`round-event-result is-${result.outcome.toLowerCase()}`}>
            <Gift />
            <strong>{result.message}</strong>
            <p>El resultado ya se ha aplicado.</p>
            <button className="button button--primary" type="button" onClick={onDismiss}>
              <X /> Continuar partida
            </button>
          </div>
        ) : null}
      </motion.section>
    </motion.div>
  );
}
