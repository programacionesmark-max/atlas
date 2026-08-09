import { Flag, ShieldAlert, X } from 'lucide-react';
import { motion } from 'framer-motion';

export function BankruptcyConfirm({
  pending,
  onConfirm,
  onClose
}: {
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="modal-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="bankruptcy-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.section
        className="bankruptcy-modal"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
      >
        <div className="bankruptcy-icon">
          <ShieldAlert />
        </div>
        <span className="section-label">Decisión irreversible</span>
        <h2 id="bankruptcy-title">¿Declararte en bancarrota?</h2>
        <p>
          Abandonarás la competición, devolverás tus ciudades al banco y continuarás viendo la
          partida como jugador eliminado.
        </p>
        <div className="bankruptcy-actions">
          <button className="button button--ghost" type="button" onClick={onClose}>
            <X /> Seguir jugando
          </button>
          <button
            className="button button--danger"
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            <Flag /> Abandonar partida
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
