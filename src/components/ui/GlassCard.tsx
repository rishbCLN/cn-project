import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  hover?: boolean;
  glow?: string;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children, className = '', padding = 'p-4', hover = false, glow, onClick,
}) => {
  return (
    <motion.div
      className={`glass ${padding} ${className} ${glow ? `glow-${glow}` : ''}`}
      onClick={onClick}
      whileHover={hover ? { scale: 1.02, borderColor: 'rgba(255,255,255,0.15)' } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </motion.div>
  );
};
