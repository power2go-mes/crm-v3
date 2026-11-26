'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { ChevronDown, ChevronUp, LogOut, Shield, User, Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function UserProfileMenu() {
  const { user, profile, roles, signOut, isSuperAdmin, hasPermission } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Outside click listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : user?.email?.split('@')[0] || 'User';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const primaryRole = roles[0]?.name || (isSuperAdmin ? 'SUPER_ADMIN' : 'Standard Access');
  const roleCode = roles[0]?.id || (isSuperAdmin ? 'SUPER_ADMIN' : 'USER');

  const getRoleBadgeStyle = (code: string) => {
    switch (code) {
      case 'SUPER_ADMIN':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'HEAD_OF_SALES':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'RSM':
      case 'SSM':
      case 'ASM':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'BDO':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User profile menu"
        className="flex h-10 items-center space-x-2 pl-2 pr-3 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white transition-all text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
          {initials || <User className="h-4 w-4" />}
        </div>
        <div className="hidden sm:block text-left min-w-0 max-w-[130px]">
          <p className="text-xs font-bold text-slate-900 leading-tight truncate">
            {displayName}
          </p>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">
            {primaryRole}
          </p>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in divide-y divide-slate-100">
          <div className="px-4 py-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Authenticated Operator
            </p>
            <p className="text-xs font-bold text-slate-900 mt-1 truncate">{displayName}</p>
            <p className="text-[11px] text-slate-500 font-mono truncate">{user?.email || '—'}</p>
            {profile?.department && (
              <p className="text-[11px] text-slate-400 mt-0.5">{profile.department}</p>
            )}
          </div>

          <div className="px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-slate-400" /> Assigned Role
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${getRoleBadgeStyle(
                roleCode
              )}`}
            >
              {roleCode.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="p-1.5">
            <Link href="/my-settings/mcp" onClick={() => setIsOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition"><Bot className="h-4 w-4 text-emerald-600" />AI & MCP Agent Access</Link>
            <Link href="/my-settings/password" onClick={() => setIsOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><User className="h-4 w-4" />Password Management</Link>
            {(hasPermission('login_history.view_own') || hasPermission('login_history.view_team')) && <Link href="/my-settings/login-history" onClick={() => setIsOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">My Login History</Link>}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
            >
              <LogOut className="h-4 w-4 text-slate-400 hover:text-red-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
