import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  icon: Icon,
  actions
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-black text-[#1B2A3B] tracking-tight flex items-center gap-2.5">
          {Icon && <Icon className="w-6 h-6 text-[#4E8ABF]" />}
          <span>{title}</span>
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-[#5F6E7E] font-medium mt-1">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
