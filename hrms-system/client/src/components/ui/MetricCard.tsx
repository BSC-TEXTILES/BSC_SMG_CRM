import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'navy' | 'gold' | 'emerald' | 'teal' | 'amber' | 'indigo' | 'rose';
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  trendUp,
  color = 'navy',
  onClick
}: MetricCardProps) {
  const colorStyles = {
    navy: { iconBg: 'bg-[#4A1726]/10 text-[#4A1726]', border: 'border-l-4 border-l-[#4A1726]' },
    gold: { iconBg: 'bg-[#C6A15B]/15 text-[#C6A15B]', border: 'border-l-4 border-l-[#C6A15B]' },
    emerald: { iconBg: 'bg-[#27805B]/10 text-[#27805B]', border: 'border-l-4 border-l-[#27805B]' },
    teal: { iconBg: 'bg-[#27805B]/10 text-[#27805B]', border: 'border-l-4 border-l-[#27805B]' },
    amber: { iconBg: 'bg-[#C58A24]/10 text-[#C58A24]', border: 'border-l-4 border-l-[#C58A24]' },
    indigo: { iconBg: 'bg-[#4A1726]/10 text-[#4A1726]', border: 'border-l-4 border-l-[#4A1726]' },
    rose: { iconBg: 'bg-[#C43D4B]/10 text-[#C43D4B]', border: 'border-l-4 border-l-[#C43D4B]' }
  };

  const style = colorStyles[color] || colorStyles.navy;

  return (
    <div
      onClick={onClick}
      className={`
        card-glass card-glass-hover p-5 flex flex-col justify-between transition-all duration-200 border border-[#EAE4DC] bg-white
        ${style.border} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A726D] block mb-1">
            {title}
          </span>
          <div className="text-2xl lg:text-3xl font-black text-[#4A1726] tracking-tight">
            {value}
          </div>
        </div>

        <div className={`p-3 rounded-2xl ${style.iconBg} shadow-xs flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-4 pt-3 border-t border-[#EAE4DC]/80 flex items-center justify-between text-xs">
          {subtext && <span className="text-[#7A726D] font-medium">{subtext}</span>}
          {trend && (
            <span className={`font-bold flex items-center gap-0.5 ${trendUp ? 'text-[#27805B]' : 'text-[#C58A24]'}`}>
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
