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
        <label htmlFor={inputId} className="block text-[10.5px] font-extrabold uppercase text-[#1B2A3B] tracking-wider">
          {label} {isRequired && <span className="text-[#C43D4B]">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3.5 py-2.5 rounded-xl border bg-white text-[#1B2A3B] font-medium transition-all shadow-xs placeholder-[#8896A6]
          focus:outline-none focus:border-[#4E8ABF] focus:ring-2 focus:ring-[#4E8ABF]/20
          ${error ? 'border-[#C43D4B] bg-[#FDF0F2]' : 'border-[#E2E8F0]'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-[10px] text-[#C43D4B] font-semibold">{error}</p>}
      {helperText && !error && <p className="text-[10px] text-[#5F6E7E]">{helperText}</p>}
    </div>
  );
}
