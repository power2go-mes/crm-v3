'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  X,
  UserPlus,
  CheckSquare,
  Phone,
  Calendar,
  DollarSign,
  Megaphone,
  Building,
  Users,
  Info,
  Clock,
} from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import type { CrmNotification, NotificationCategory } from '@/types/notifications';

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'lead':
      return <UserPlus className="h-4 w-4 text-emerald-600" />;
    case 'task':
      return <CheckSquare className="h-4 w-4 text-blue-600" />;
    case 'call':
      return <Phone className="h-4 w-4 text-amber-600" />;
    case 'meeting':
      return <Calendar className="h-4 w-4 text-purple-600" />;
    case 'deal':
      return <DollarSign className="h-4 w-4 text-green-600" />;
    case 'campaign':
      return <Megaphone className="h-4 w-4 text-pink-600" />;
    case 'account':
      return <Building className="h-4 w-4 text-indigo-600" />;
    case 'contact':
      return <Users className="h-4 w-4 text-teal-600" />;
    case 'system':
    default:
      return <Info className="h-4 w-4 text-slate-600" />;
  }
}

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('unread');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    unreadCount,
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
    deleteNotification,
  } = useNotifications(activeTab);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (item: CrmNotification) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    if (item.url) {
      setIsOpen(false);
      setIsDrawerOpen(false);
      router.push(item.url);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={
          unreadCount > 0
            ? `${unreadCount > 30 ? '30+' : unreadCount} unread notifications`
            : 'Notifications'
        }
        title="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition focus:outline-hidden focus:ring-2 focus:ring-primary/20"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-xs">
            {unreadCount > 30 ? '30+' : unreadCount}
          </span>
        ) : (
          <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-slate-300" />
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Notifications</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => markAllAsRead()}
                disabled={isMarkingAllRead || unreadCount === 0}
                title="Mark all as read"
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCheck className="h-3.5 w-3.5 text-primary" />
                <span>Mark all read</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-3 bg-white text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`py-2 px-3 border-b-2 transition ${
                activeTab === 'unread'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`py-2 px-3 border-b-2 transition ${
                activeTab === 'all'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              All
            </button>
          </div>

          {/* Notification List Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-slate-700">No {activeTab === 'unread' ? 'unread ' : ''}notifications</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You are completely up to date.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`group relative flex items-start gap-3 p-3 text-left transition hover:bg-slate-50 cursor-pointer ${
                    !item.read ? 'bg-blue-50/30' : 'bg-white'
                  }`}
                >
                  {/* Category icon avatar */}
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-white border border-slate-200/60 shadow-2xs">
                    {getCategoryIcon(item.category)}
                  </div>

                  {/* Text content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-medium truncate ${!item.read ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTimeAgo(item.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                      <span>
                        {item.sender
                          ? `By ${item.sender.first_name || ''} ${item.sender.last_name || ''}`.trim()
                          : 'By System'}
                      </span>
                      {item.url && (
                        <span className="text-primary flex items-center gap-0.5 hover:underline">
                          View details <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions (Mark read / Delete) */}
                  <div className="flex flex-col items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(item.id);
                        }}
                        title="Mark as read"
                        className="h-6 w-6 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-primary transition"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(item.id);
                      }}
                      title="Dismiss"
                      className="h-6 w-6 rounded-md hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsDrawerOpen(true);
              }}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition py-1 px-3 rounded-lg hover:bg-primary/5"
            >
              View all in Alerts Drawer
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Full Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-slate-900">Notification Center</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-bold">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition ${
                    activeTab === 'all'
                      ? 'bg-white shadow-xs text-primary font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Notifications
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('unread')}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition ${
                    activeTab === 'unread'
                      ? 'bg-white shadow-xs text-primary font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => markAllAsRead()}
                disabled={isMarkingAllRead || unreadCount === 0}
                className="text-xs text-slate-600 hover:text-primary font-medium flex items-center gap-1 disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            </div>

            {/* Drawer List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {notifications.length === 0 ? (
                <div className="py-20 text-center">
                  <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">No notifications found</p>
                  <p className="text-xs text-slate-400 mt-1">You do not have any pending alerts.</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3 rounded-xl transition cursor-pointer hover:bg-slate-50 flex items-start gap-3 my-1 ${
                      !item.read ? 'bg-blue-50/40 border border-blue-100' : 'bg-white'
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-2xs">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-slate-900 truncate">{item.title}</h4>
                        <span className="text-[10px] text-slate-400">{formatTimeAgo(item.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-normal">{item.message}</p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-400">
                          {item.sender
                            ? `Sender: ${item.sender.first_name || ''} ${item.sender.last_name || ''}`.trim()
                            : 'System Notification'}
                        </span>
                        {item.url && (
                          <span className="text-primary font-medium flex items-center gap-1 hover:underline">
                            Open <ExternalLink className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!item.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item.id);
                          }}
                          title="Mark as read"
                          className="h-7 w-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-primary transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        title="Delete"
                        className="h-7 w-7 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
