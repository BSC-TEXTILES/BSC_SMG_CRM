import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary: 'bg-[#4A1726] text-white hover:bg-[#5C1D30] active:scale-[0.99] border-transparent shadow-sm',
    secondary: 'bg-[#C6A15B] text-[#321923] hover:bg-[#B5914B] active:scale-[0.99] border-transparent shadow-sm font-black',
    outline: 'bg-white text-[#4A1726] border-[#C6A15B] hover:bg-[#F8F5F1]',
    danger: 'bg-[#C43D4B] text-white hover:bg-[#A82D3B] active:scale-[0.99] border-transparent shadow-sm',
    success: 'bg-[#27805B] text-white hover:bg-[#1E6849] active:scale-[0.99] border-transparent shadow-sm',
    warning: 'bg-[#C58A24] text-white hover:bg-[#B27B1E] active:scale-[0.99] border-transparent shadow-sm',
    ghost: 'bg-transparent text-[#321923] hover:bg-[#F8F5F1] border-transparent'
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-[11px] rounded-md font-bold',
    md: 'px-4 py-2 text-xs rounded-xl font-bold',
    lg: 'px-6 py-3 text-sm rounded-xl font-bold'
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-1.5 border transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
}
