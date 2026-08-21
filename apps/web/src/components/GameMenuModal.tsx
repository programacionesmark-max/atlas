import { ArrowLeftRight, BookOpen, Copy, Flag, Landmark, Play, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface GameMenuModalProps {
  roomCode: string;
  tradesEnabled: boolean;
  onClose: () => void;
  onOpenEmpire: () => void;
  onOpenTrade: () => void;
  onBankruptcy: () => void;
}

export function GameMenuModal({
  roomCode,
  tradesEnabled,
  onClose,
  onOpenEmpire,
  onOpenTrade,
  onBankruptcy
}: GameMenuModalProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function copyInvite(): Promise<void> {
    await navigator.clipboard.writeText(`${window.location.origin}/join/${roomCode}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <motion.div
      className="modal-backdrop game-menu-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-menu-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        className="game-menu-modal"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <header>
          <div>
            <span className="modal-kicker">Partida · {roomCode}</span>
            <h2 id="game-menu-title">Menú de partida</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar menú">
            <X />
          </button>
        </header>

        {showGuide ? (
          <div className="game-guide">
            <button className="game-guide__back" type="button" onClick={() => setShowGuide(false)}>
              ← Volver al menú
            </button>
            <h3>Cómo conquistar el mundo</h3>
            <ol>
              <li>
                <b>1</b>
                <span>
                  <strong>Tira y muévete</strong>La ruta iluminada muestra tu recorrido.
                </span>
              </li>
              <li>
                <b>2</b>
                <span>
                  <strong>Compra ciudades</strong>Si no compras, la ciudad sale a subasta.
                </span>
              </li>
              <li>
                <b>3</b>
                <span>
                  <strong>Completa países</strong>Consigue sus 2 o 3 ciudades para construir.
                </span>
              </li>
              <li>
                <b>4</b>
                <span>
                  <strong>Elige tus vuelos</strong>En aeropuertos puedes pagar por cambiar de ruta.
                </span>
              </li>
              <li>
                <b>5</b>
                <span>
                  <strong>Negocia y resiste</strong>Intercambia para cerrar países y evita la
                  bancarrota.
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <nav className="game-menu-list" aria-label="Opciones de partida">
            <button type="button" className="is-primary" onClick={onClose}>
              <Play />
              <span>
                <strong>Continuar</strong>
                <small>Volver al tablero</small>
              </span>
            </button>
            <button type="button" onClick={onOpenEmpire}>
              <Landmark />
              <span>
                <strong>Mi imperio</strong>
                <small>Países, ciudades y construcciones</small>
              </span>
            </button>
            <button type="button" disabled={!tradesEnabled} onClick={onOpenTrade}>
              <ArrowLeftRight />
              <span>
                <strong>Intercambiar</strong>
                <small>Negociar dinero y ciudades</small>
              </span>
            </button>
            <button type="button" onClick={() => setShowGuide(true)}>
              <BookOpen />
              <span>
                <strong>Cómo jugar</strong>
                <small>Las cinco reglas esenciales</small>
              </span>
            </button>
            <button type="button" onClick={() => void copyInvite()}>
              <Copy />
              <span>
                <strong>{copied ? 'Enlace copiado' : 'Copiar invitación'}</strong>
                <small>Invitar a otra persona</small>
              </span>
            </button>
          </nav>
        )}

        {!showGuide ? (
          <button className="game-menu-bankruptcy" type="button" onClick={onBankruptcy}>
            <Flag /> Declarar bancarrota
          </button>
        ) : null}
      </motion.section>
    </motion.div>
  );
}
