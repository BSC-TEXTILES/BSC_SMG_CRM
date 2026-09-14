import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export default function EmptyState({
  title = 'No records found',
  description = 'There are no items matching your criteria at the moment.',
  icon: Icon = Inbox,
  action
}: EmptyStateProps) {
  return (
    <div className="card-glass p-8 sm:p-12 text-center flex flex-col items-center justify-center my-4">
      <div className="w-16 h-16 rounded-2xl bg-[#163B5C]/5 border border-[#163B5C]/10 flex items-center justify-center text-[#163B5C] mb-4 shadow-sm">
        <Icon className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-extrabold text-[#163B5C]">{title}</h3>
      <p className="text-xs text-[#5F6E7E] max-w-sm mt-1 mb-5 font-medium leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
