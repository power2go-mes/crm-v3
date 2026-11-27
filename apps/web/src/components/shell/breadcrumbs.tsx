'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { getBreadcrumbs, type BreadcrumbItem } from '@/lib/navigation/config';

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const pathname = usePathname();
  const breadcrumbItems = items || getBreadcrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-1.5 text-xs text-slate-500 ${className}`}>
      <Link
        href="/"
        className="flex items-center text-slate-400 hover:text-slate-700 transition"
        title="Dashboard"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;

        return (
          <div key={item.label + index} className="flex items-center space-x-1.5">
            <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-[#4361ee] font-medium transition"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`font-semibold ${isLast ? 'text-red-700 border-b-2 border-red-600 pb-0.5' : 'text-slate-500'}`}>
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
