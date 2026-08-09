import { motion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

export function ScreenTransition({
  children,
  className = ''
}: PropsWithChildren<{ className?: string }>) {
  return (
    <motion.main
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.main>
  );
}
