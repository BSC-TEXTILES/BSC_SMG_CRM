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
        <label htmlFor={inputId} className="block text-[10.5px] font-extrabold uppercase text-[#321923] tracking-wider">
          {label} {isRequired && <span className="text-[#C43D4B]">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3.5 py-2.5 rounded-xl border bg-white text-[#321923] font-medium transition-all shadow-xs placeholder-[#8E8883]
          focus:outline-none focus:border-[#C6A15B] focus:ring-2 focus:ring-[#C6A15B]/20
          ${error ? 'border-[#C43D4B] bg-[#FDF0F2]' : 'border-[#EAE4DC]'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-[10px] text-[#C43D4B] font-semibold">{error}</p>}
      {helperText && !error && <p className="text-[10px] text-[#7A726D]">{helperText}</p>}
    </div>
  );
}
