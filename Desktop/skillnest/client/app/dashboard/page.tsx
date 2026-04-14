'use client';

import { useEffect, useState, useRef } from 'react';
import { getAuthToken, requireAuth } from '../lib/auth';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import NotificationBell from '../components/NotificationBell';
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0, connections: 0, endorsements: 0 });
  const [recentConnections, setRecentConnections] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifVisible, setNotifVisible] = useState(false);
  const [newMsgNotif, setNewMsgNotif] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const prevMsgCount = useRef(0);

  const getToken = getAuthToken;

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const token = await requireAuth(router);
      const headers = { Authorization: `Bearer ${token}` };

      const meRes = await axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/users/me', { headers });
      const me = meRes.data;

      const [usersRes, connRes, followCountRes, endorseRes, pendingRes] = await Promise.all([
        axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/users/all', { headers }),
        axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/connect/status', { headers }),
        axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/follow/following', { headers }),
        axios.get(`https://d2tf8c984u0s6x.cloudfront.net/api/users/endorsements/${me.cognito_sub}`, { headers }).catch(() => ({ data: [] })),
        axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/connect/requests', { headers }).catch(() => ({ data: [] })),
      ]);

      setUser(me);
      setAllUsers(usersRes.data);
      setPendingCount(pendingRes.data.length || 0);

      // Fetch MY follower count from follow-service
      const myFollowCount = await axios.get(
        `https://d2tf8c984u0s6x.cloudfront.net/api/follow/count/${me.cognito_sub}`,
        { headers }
      ).catch(() => ({ data: { followers: 0, following: 0 } }));

      const acceptedConns = connRes.data.filter((c: any) => c.status === 'accepted');
      const endorseCount = Array.isArray(endorseRes.data) ? endorseRes.data.reduce((sum: number, e: any) => sum + parseInt(e.count || 0), 0) : 0;

      setStats({
        followers: myFollowCount.data.followers || 0,
        following: followCountRes.data.length || 0,
        connections: acceptedConns.length,
        endorsements: endorseCount,
      });

      // Recent connections — find user objects
      const recentConns = acceptedConns.slice(0, 4).map((conn: any) => {
        const otherId = conn.sender_id === me.cognito_sub ? conn.receiver_id : conn.sender_id;
        return usersRes.data.find((u: any) => u.cognito_sub === otherId);
      }).filter(Boolean);

      setRecentConnections(recentConns);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pollMessages = async () => {
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const convRes = await axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/chat/conversations', { headers }).catch(() => ({ data: [] }));
      if (!convRes.data.length) return;

      let totalNew = 0;
      const newNotifs: any[] = [];

      for (const conv of convRes.data.slice(0, 3)) {
        const msgRes = await axios.get(
          `https://d2tf8c984u0s6x.cloudfront.net/api/chat/messages/${conv.other_user_id}`,
          { headers }
        ).catch(() => ({ data: [] }));

        totalNew += msgRes.data.length;
        const lastMsg = msgRes.data[msgRes.data.length - 1];
        if (lastMsg && lastMsg.sender_id !== user?.cognito_sub) {
          const sender = allUsers.find((u: any) => u.cognito_sub === lastMsg.sender_id);
          if (sender) newNotifs.push({ name: sender.name, message: lastMsg.message });
        }
      }

      // Only notify on NEW messages (not on first load)
      if (prevMsgCount.current !== 0 && totalNew > prevMsgCount.current) {
        setNewMsgNotif(newNotifs);
        setNotifVisible(true);
        setTimeout(() => setNotifVisible(false), 5000);
      }
      prevMsgCount.current = totalNew;
    } catch { }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (allUsers.length > 0 && user) {
      pollMessages();
      const interval = setInterval(pollMessages, 8000);
      return () => clearInterval(interval);
    }
  }, [allUsers, user]);

  // Profile completion
  const completionFields = [
    { label: 'Name', done: !!user?.name },
    { label: 'Bio', done: !!user?.bio },
    { label: 'Skills', done: user?.skills?.length > 0 },
    { label: 'GitHub', done: !!user?.github_url },
    { label: 'LinkedIn', done: !!user?.linkedin_url },
    { label: 'Location', done: !!user?.location },
    { label: 'Domain', done: !!user?.domain },
    { label: 'Experience', done: !!user?.experience_level },
  ];
  const completionPct = Math.round((completionFields.filter(f => f.done).length / completionFields.length) * 100);
  const completionColor = completionPct >= 80 ? '#22c55e' : completionPct >= 50 ? '#f59e0b' : '#ef4444';

  function getInitials(name: string) {
    return name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }
  function getAvatarColor(name: string) {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
    let hash = 0;
    for (const c of name || '') hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  const statCards = [
    { label: 'Followers', value: stats.followers, icon: '👥', color: '#38bdf8', path: '/users', desc: 'People following you' },
    { label: 'Following', value: stats.following, icon: '➕', color: '#a78bfa', path: '/users', desc: 'People you follow' },
    { label: 'Connections', value: stats.connections, icon: '🤝', color: '#22c55e', path: '/users', desc: 'Your network' },
    { label: 'Endorsements', value: stats.endorsements, icon: '❤️', color: '#f472b6', path: '/users', desc: 'Skill endorsements' },
  ];

  const quickActions = [
    { label: '🔍 Discover People', desc: 'Find and connect with professionals', path: '/users', color: '#6366f1' },
    { label: '💬 Open Chat', desc: `${pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''}` : 'Message your connections'}`, path: '/chat', color: '#22c55e' },
    { label: '⚙️ Edit Profile', desc: `${completionPct}% complete`, path: '/profile', color: '#f59e0b' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif' }}>

      {/* Message Notification Toast */}
      {notifVisible && newMsgNotif.length > 0 && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 999, background: '#1e293b', border: '1px solid #38bdf8', borderRadius: 12, padding: '16px 20px', maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: '#38bdf8' }}>💬 New Message{newMsgNotif.length > 1 ? 's' : ''}</div>
            <button onClick={() => setNotifVisible(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
          {newMsgNotif.map((n, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{n.name}</div>
              <div style={{ color: '#94a3b8', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { router.push('/chat'); setNotifVisible(false); }}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              Open Chat →
            </button>
            <button onClick={() => setNotifVisible(false)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
              Ignore
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
{/* Top Bar with Bell */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
  <div style={{ fontSize: 22, fontWeight: 800 }}>Dashboard</div>
  <NotificationBell userId={user?.cognito_sub || ''} />
</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Loading dashboard...</div>
        ) : (
          <>
            {/* Top row: Profile Card + Completion */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

              {/* Profile Card */}
              <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: getAvatarColor(user?.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>
                    {getInitials(user?.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{user?.name}</div>
                    <div style={{ color: '#64748b', fontSize: 14 }}>{user?.email}</div>
                    {user?.domain && <div style={{ color: '#38bdf8', fontSize: 13, marginTop: 2 }}>🏷️ {user.domain}</div>}
                    {user?.location && <div style={{ color: '#64748b', fontSize: 13 }}>📍 {user.location}</div>}
                  </div>
                </div>
                {user?.bio && <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{user.bio}</p>}
                {user?.skills?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {user.skills.map((s: string) => (
                      <span key={s} style={{ background: '#1e3a5f', color: '#60a5fa', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>{s}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  {user?.github_url && <a href={user.github_url} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>🐙 GitHub</a>}
                  {user?.linkedin_url && <a href={user.linkedin_url} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>💼 LinkedIn</a>}
                </div>
              </div>

              {/* Profile Completion */}
              <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, border: '1px solid #334155' }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
                  {completionPct === 100 ? '✅ Profile Complete!' : '📊 Profile Completion'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 10, background: '#0f172a', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${completionPct}%`, background: completionColor, borderRadius: 10, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontWeight: 700, color: completionColor, fontSize: 18 }}>{completionPct}%</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {completionFields.map(f => (
                    <span key={f.label} onClick={() => router.push('/profile')} style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      background: f.done ? '#064e3b' : '#3f1a1a',
                      color: f.done ? '#34d399' : '#f87171',
                      border: `1px solid ${f.done ? '#065f46' : '#7f1d1d'}`
                    }}>
                      {f.done ? '✓' : '+'} {f.label}
                    </span>
                  ))}
                </div>
                {completionPct < 100 && (
                  <button onClick={() => router.push('/profile')}
                    style={{ marginTop: 16, width: '100%', padding: '10px', background: '#6366f1', border: 'none', borderRadius: 10, color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                    Complete Profile →
                  </button>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {statCards.map((stat, i) => (
                <div key={`stat-${i}`} onClick={() => router.push(stat.path)}
                  style={{ background: '#1e293b', borderRadius: 14, padding: '20px 24px', border: `1px solid ${stat.color}22`, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = stat.color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = stat.color + '22')}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{stat.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{stat.desc}</div>
                </div>
              ))}
            </div>

            {/* Bottom row: Recent Connections + Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Recent Connections */}
              <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155' }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🤝 Recent Connections</div>
                {recentConnections.length === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
                    No connections yet.<br />
                    <span onClick={() => router.push('/users')} style={{ color: '#6366f1', cursor: 'pointer' }}>Discover people →</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {recentConnections.map((u: any, idx: number) => (
                      <div key={`conn-${u.cognito_sub}-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: getAvatarColor(u.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                            {getInitials(u.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{u.domain || (u.skills || []).slice(0, 2).join(', ')}</div>
                          </div>
                        </div>
                        <button onClick={() => router.push('/chat')}
                          style={{ padding: '6px 14px', background: '#1e3a5f', border: '1px solid #38bdf8', borderRadius: 8, color: '#38bdf8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          💬 Chat
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155' }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>⚡ Quick Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {quickActions.map((action, i) => (
                    <div key={`action-${i}`} onClick={() => router.push(action.path)}
                      style={{ padding: '14px 18px', background: '#0f172a', border: `1px solid ${action.color}44`, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = action.color)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = action.color + '44')}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{action.label}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{action.desc}</div>
                      </div>
                      <span style={{ color: action.color, fontSize: 18 }}>→</span>
                    </div>
                  ))}
                </div>

                {/* Pending requests alert */}
                {pendingCount > 0 && (
                  <div onClick={() => router.push('/users')}
                    style={{ marginTop: 12, padding: '12px 16px', background: '#422006', border: '1px solid #fbbf24', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>📩</span>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: 14 }}>{pendingCount} Pending Connection{pendingCount > 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 12, color: '#92400e' }}>Click to review</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

