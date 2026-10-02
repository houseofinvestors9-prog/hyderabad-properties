'use client';

import React from 'react';

interface AelineButtonProps {
  children: React.ReactNode;
  variant?: 'lime' | 'dark' | 'outline';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  disabled?: boolean;
}

export function AelineButton({
  children,
  variant = 'lime',
  onClick,
  type = 'button',
  className = '',
  disabled = false,
}: AelineButtonProps) {
  const getButtonClass = () => {
    switch (variant) {
      case 'dark':
        return 'btn-aeline-dark';
      case 'outline':
        return 'btn-aeline-outline';
      case 'lime':
      default:
        return 'btn-aeline';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${getButtonClass()} group ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <span className="leading-none">{children}</span>
      <span className={variant === 'dark' ? 'btn-arrow-capsule-lime' : 'btn-arrow-capsule'}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="none"
          className="w-3.5 h-3.5"
        >
          <path
            d="M13.0457 8.13128L5.8733 15.3037L4.69479 14.1252L11.8672 6.95277L5.54568 6.95277L5.54568 5.28636H14.7121V14.4528L13.0457 14.4528V8.13128Z"
            fill="currentColor"
          />
        </svg>
      </span>
    </button>
  );
}
