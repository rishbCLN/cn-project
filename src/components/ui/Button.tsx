import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const variants = {
  primary: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25',
  secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-glass)]',
  danger: 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
};

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export const Button: React.FC<ButtonProps> = ({
  children, onClick, variant = 'primary', size = 'md',
  disabled = false, icon, fullWidth = false, className = '',
}) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-200 cursor-pointer
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </motion.button>
  );
};
