import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
}

export default function Input({
  label,
  error,
  helperText,
  isRequired = false,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="space-y-1 w-full text-xs">
      {label && (
        <label htmlFor={inputId} className="block text-[10.5px] font-extrabold uppercase text-primary tracking-wider">
          {label} {isRequired && <span className="text-[#C43D4B]">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3.5 py-2.5 rounded-xl border bg-white text-primary font-medium transition-all shadow-xs placeholder-primary/60
          focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
          ${error ? 'border-[#C43D4B] bg-[#FDF0F2]' : 'border-accent-soft'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-[10px] text-[#C43D4B] font-semibold">{error}</p>}
      {helperText && !error && <p className="text-[10px] text-primary/70">{helperText}</p>}
    </div>
  );
}
