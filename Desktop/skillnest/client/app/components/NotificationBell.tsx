'use client';
import { useEffect, useState, useRef } from 'react';
import { getAuthToken } from '../lib/auth';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: 'message' | 'follow' | 'connection_request' | 'connection_accepted';
  message: string;
  sender_name: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getToken = async () => {
    try {
      return await getAuthToken();
    } catch {
      return '';
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [notifsRes, countRes] = await Promise.all([
        axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/chat/notifications', { headers }),
        axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/chat/notifications/unread-count', { headers }),
      ]);
      setNotifications(notifsRes.data);
      setUnreadCount(countRes.data.count);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      const token = await getToken();
      await axios.put('https://d2tf8c984u0s6x.cloudfront.net/api/chat/notifications/mark-read', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getToken();
      await axios.delete(`https://d2tf8c984u0s6x.cloudfront.net/api/chat/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotifClick = async (notif: Notification) => {
    try {
      const token = await getToken();
      await axios.put(`https://d2tf8c984u0s6x.cloudfront.net/api/chat/notifications/${notif.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      setOpen(false);
      router.push(notif.link);
    } catch (err) {
      console.error(err);
    }
  };

  // Poll for notifications every 30 seconds instead of socket
  useEffect(() => {
    if (!userId) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (userId) fetchNotifications();
  }, [userId]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return '💬';
      case 'follow': return '👥';
      case 'connection_request': return '🤝';
      case 'connection_accepted': return '✅';
      default: return '🔔';
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <style>{`
        @keyframes bellRing {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(15deg); }
          40%  { transform: rotate(-15deg); }
          60%  { transform: rotate(10deg); }
          80%  { transform: rotate(-10deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .notif-item:hover { background: #1e3a5f !important; }
      `}</style>

      {/* Bell Button */}
      <button
        id="notif-bell"
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        style={{
          position: 'relative',
          background: open ? '#1e293b' : 'transparent',
          border: '1px solid #334155',
          borderRadius: 10,
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 20,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -6, right: -6,
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: 20, height: 20,
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #0f172a',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '110%',
          right: 0,
          width: 360,
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              🔔 Notifications {unreadCount > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: 20, padding: '2px 8px', fontSize: 11, marginLeft: 6 }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                background: 'transparent', border: 'none', color: '#38bdf8',
                fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}>
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>All caught up!</div>
                <div style={{ fontSize: 13 }}>No notifications yet</div>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="notif-item"
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #1e293b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    background: notif.is_read ? 'transparent' : '#0f2744',
                    transition: 'background 0.2s',
                    position: 'relative',
                  }}
                >
                  {/* Unread dot */}
                  {!notif.is_read && (
                    <div style={{
                      position: 'absolute', top: 18, left: 8,
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#38bdf8',
                    }} />
                  )}

                  {/* Icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: '#0f172a', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {getIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, color: notif.is_read ? '#94a3b8' : 'white',
                      fontWeight: notif.is_read ? 400 : 500,
                      lineHeight: 1.4,
                    }}>
                      {notif.message}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                      {getTimeAgo(notif.created_at)}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => deleteNotif(notif.id, e)}
                    style={{
                      background: 'transparent', border: 'none',
                      color: '#475569', cursor: 'pointer',
                      fontSize: 16, padding: '0 4px',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #334155',
              textAlign: 'center',
            }}>
              <button
                onClick={async () => {
                  try {
                    const token = await getToken();
                    await Promise.all(
                      notifications.map(n =>
                        axios.delete(`https://d2tf8c984u0s6x.cloudfront.net/api/chat/notifications/${n.id}`, {
                          headers: { Authorization: `Bearer ${token}` }
                        })
                      )
                    );
                  } catch { }
                  setNotifications([]);
                  setUnreadCount(0);
                  setOpen(false);
                }}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#64748b', fontSize: 12, cursor: 'pointer',
                }}
              >
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

