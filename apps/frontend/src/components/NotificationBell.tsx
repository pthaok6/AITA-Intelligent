import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'RESULT' | 'APPEAL' | 'SYSTEM' | 'TEAM';
  link: string;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storageKey = user ? `aita:notifications:seen:${user.id}` : '';

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) {
        setSeenIds(new Set(stored));
      }
    } catch {
      setSeenIds(new Set());
    }
  }, [storageKey]);

  const fetchNotifications = async () => {
    if (!user) return;
    const res = await apiRequest<InAppNotification[]>('/notifications');
    if (res.success && res.data) {
      setNotifications(res.data);
    }
  };

  useEffect(() => {
    if (!user) return;
    void fetchNotifications();
    const timer = setInterval(() => {
      void fetchNotifications();
    }, 15000);

    return () => clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !seenIds.has(n.id)).length;

  const markAllAsRead = () => {
    const newSeen = new Set(seenIds);
    notifications.forEach(n => newSeen.add(n.id));
    setSeenIds(newSeen);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify([...newSeen].slice(-300)));
      } catch {
        // Ignore storage full errors
      }
    }
  };

  const handleNotificationClick = (item: InAppNotification) => {
    const newSeen = new Set(seenIds);
    newSeen.add(item.id);
    setSeenIds(newSeen);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify([...newSeen].slice(-300)));
      } catch {
        // Ignore
      }
    }
    setIsOpen(false);
    navigate(item.link);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return date.toLocaleDateString('vi-VN');
    } catch {
      return '';
    }
  };

  const getTypeBadge = (type: InAppNotification['type']) => {
    switch (type) {
      case 'RESULT':
        return <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Điểm số</span>;
      case 'APPEAL':
        return <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>Khiếu nại</span>;
      case 'SYSTEM':
        return <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>Hệ thống</span>;
      default:
        return <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>Nhóm</span>;
    }
  };

  if (!user) return null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Thông báo"
        className="btn btn-secondary btn-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          position: 'relative',
          padding: '0.35rem 0.65rem',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              background: '#ef4444',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 700,
              borderRadius: '9999px',
              padding: '0.1rem 0.4rem',
              minWidth: '1.2rem',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 360,
            maxWidth: '90vw',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              background: '#1e293b',
              borderBottom: '1px solid #334155',
            }}
          >
            <strong style={{ fontSize: '0.9rem', color: '#f87171' }}>
              Thông báo ({unreadCount} mới)
            </strong>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                Không có thông báo nào.
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !seenIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid #1e293b',
                      background: isUnread ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread ? 'rgba(59, 130, 246, 0.08)' : 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {getTypeBadge(item.type)}
                        <strong style={{ fontSize: '0.85rem', color: '#f1f5f9' }}>{item.title}</strong>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{formatTime(item.createdAt)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.35 }}>
                      {item.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
