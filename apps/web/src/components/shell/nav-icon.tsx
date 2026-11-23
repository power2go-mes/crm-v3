import React from 'react';
import {
  LayoutDashboard,
  Home,
  Target,
  Megaphone,
  Building2,
  Contact,
  TrendingUp,
  LineChart,
  BarChart3,
  LayoutGrid,
  Calendar,
  Clock,
  Briefcase,
  CheckSquare,
  PhoneCall,
  Users,
  ShieldCheck,
  Settings,
  Circle,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Home,
  Target,
  Megaphone,
  Building2,
  Contact,
  TrendingUp,
  LineChart,
  BarChart3,
  LayoutGrid,
  Calendar,
  Clock,
  Briefcase,
  CheckSquare,
  PhoneCall,
  Users,
  ShieldCheck,
  Settings,
};

export function NavIcon({
  name,
  className = 'w-4 h-4 shrink-0',
}: {
  name: string;
  className?: string;
}) {
  const IconComponent = ICON_MAP[name] || Circle;
  return <IconComponent className={className} />;
}
