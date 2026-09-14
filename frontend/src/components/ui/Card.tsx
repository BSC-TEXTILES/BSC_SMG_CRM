import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export default function Card({ children, className = '', title, subtitle, headerAction }: CardProps) {
  return (
    <div className={`card-glass bg-white p-5 space-y-4 border border-[#E2E8F0] ${className}`}>
      {(title || subtitle || headerAction) && (
        <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div>
            {title && <h3 className="font-extrabold text-[#1B2A3B] text-sm leading-tight">{title}</h3>}
            {subtitle && <p className="text-[11px] text-[#5F6E7E] mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
