import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { gentleSpring } from '../../lib/motion';

export interface EmptyStateAnimatedProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
}

/**
 * Empty state featuring smooth interactive SVG floating physics and clean typography.
 */
export function EmptyStateAnimated({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
}: EmptyStateAnimatedProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-line bg-surface/50 max-w-md mx-auto"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={gentleSpring}
    >
      {icon && (
        <motion.div
          className="w-16 h-16 rounded-2xl bg-surface-sunken border border-line flex items-center justify-center text-content-muted mb-4 shadow-xs"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {icon}
        </motion.div>
      )}

      <h3 className="text-base font-bold text-content tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-content-muted leading-relaxed max-w-xs">{description}</p>

      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="primary" size="md" onClick={onAction} leftIcon={actionIcon}>
            {actionLabel}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
