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
    navy: { iconBg: 'bg-primary/10 text-primary', border: 'border-l-4 border-l-primary' },
    gold: { iconBg: 'bg-accent/15 text-accent', border: 'border-l-4 border-l-accent' },
    emerald: { iconBg: 'bg-[#2D8659]/10 text-[#2D8659]', border: 'border-l-4 border-l-[#2D8659]' },
    teal: { iconBg: 'bg-[#2D8659]/10 text-[#2D8659]', border: 'border-l-4 border-l-[#2D8659]' },
    amber: { iconBg: 'bg-[#B8860B]/10 text-[#B8860B]', border: 'border-l-4 border-l-[#B8860B]' },
    indigo: { iconBg: 'bg-primary/10 text-primary', border: 'border-l-4 border-l-primary' },
    rose: { iconBg: 'bg-[#C0392B]/10 text-[#C0392B]', border: 'border-l-4 border-l-[#C0392B]' }
  };

  const style = colorStyles[color] || colorStyles.navy;

  return (
    <div
      onClick={onClick}
      className={`
        card-glass card-glass-hover p-5 flex flex-col justify-between transition-all duration-200 border border-accent-soft bg-white
        ${style.border} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary block mb-1">
            {title}
          </span>
          <div className="text-2xl lg:text-3xl font-black text-primary tracking-tight">
            {value}
          </div>
        </div>

        <div className={`p-3 rounded-2xl ${style.iconBg} shadow-xs flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-4 pt-3 border-t border-accent-soft/80 flex items-center justify-between text-xs">
          {subtext && <span className="text-primary font-medium">{subtext}</span>}
          {trend && (
            <span className={`font-bold flex items-center gap-0.5 ${trendUp ? 'text-[#2D8659]' : 'text-[#B8860B]'}`}>
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
