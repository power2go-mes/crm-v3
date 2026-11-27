import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
}

export function PageContainer({
  children,
  className = '',
  maxWidth = '7xl',
}: PageContainerProps) {
  const maxClass = maxWidth === 'full' ? 'w-full' : `max-w-${maxWidth} mx-auto`;

  return (
    <div className={`w-full min-w-0 ${maxClass} px-4 sm:px-6 lg:px-8 py-6 space-y-6 page-transition ${className}`}>
      {children}
    </div>
  );
}
