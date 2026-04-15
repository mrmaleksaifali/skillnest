'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthSub, getAuthToken, requireAuth } from '../lib/auth';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  cognito_sub: string;
  name: string;
  email: string;
  bio?: string;
  skills?: string[];
  domain?: string;
  experience?: string;
  location?: string;
  github_url?: string;
  linkedin_url?: string;
  created_at?: string;
  matchScore?: number;
  connectionStatus?: string;
  isFollowing?: boolean;
}

interface IncomingRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  // enriched
  senderName?: string;
  senderDomain?: string;
  senderBio?: string;
  senderSkills?: string[];
}

function BlockModal({ user, action, onConfirm, onCancel }: {
  user: User; action: 'block' | 'unblock'; onConfirm: () => void; onCancel: () => void;
}) {
  const isBlock = action === 'block';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 18,
        padding: '36px 40px', maxWidth: 420, width: '90%',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        animation: 'popIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>{isBlock ? '🚫' : '✅'}</div>
        <h2 style={{ color: '#fff', textAlign: 'center', margin: '0 0 10px', fontSize: 21, fontWeight: 800 }}>
          {isBlock ? 'Block User?' : 'Unblock User?'}
        </h2>
        <p style={{ color: '#9ca3af', textAlign: 'center', margin: '0 0 30px', lineHeight: 1.65, fontSize: 14 }}>
          {isBlock
            ? <><strong style={{ color: '#e5e7eb' }}>{user.name}</strong> will no longer appear in your feed.</>
            : <>Unblocking <strong style={{ color: '#e5e7eb' }}>{user.name}</strong> will allow them to appear again.</>}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '13px 0', borderRadius: 12, background: '#2a2a4a',
            border: '1px solid #3a3a5a', color: '#9ca3af', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '13px 0', borderRadius: 12,
            background: isBlock ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#10b981,#059669)',
            border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
          }}>{isBlock ? 'Yes, Block' : 'Yes, Unblock'}</button>
        </div>
      </div>
      <style>{`@keyframes popIn{from{transform:scale(0.82);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

const API = 'https://d2wd5c91egufsr.cloudfront.net/api';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [myId, setMyId] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'pending' | 'saved' | 'trending'>('discover');
  const [domainFilter, setDomainFilter] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const [sortBy, setSortBy] = useState('match');

  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});
  const [connectLoading, setConnectLoading] = useState<Record<string, boolean>>({});
  const [requestLoading, setRequestLoading] = useState<Record<string, string>>({});

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [savedUsers, setSavedUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [blockModal, setBlockModal] = useState<{ user: User; action: 'block' | 'unblock' } | null>(null);

  useEffect(() => { initPage(); }, []);

  async function initPage() {
    try {
      const token = await requireAuth(router);
      const sub = await getAuthSub();
      setToken(token);
      setMyId(sub);
      await Promise.all([
        fetchUsers(token, sub),
        fetchIncomingRequests(token),
      ]);
      fetchSaved(token);
      fetchBlocked(token);
    } catch (err) {
      console.error('Init error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers(t: string, sub: string) {
    try {
      const [usersRes, followingRes, connectionsRes] = await Promise.allSettled([
        axios.get(`${API}/users/all`, { headers: { Authorization: `Bearer ${t}` } }),
        axios.get(`${API}/follow/following`, { headers: { Authorization: `Bearer ${t}` } }),
        axios.get(`${API}/connections/list`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);

      const usersData = usersRes.status === 'fulfilled' ? usersRes.value.data : [];
      const followingData = followingRes.status === 'fulfilled' ? followingRes.value.data : [];
      const connectionsData = connectionsRes.status === 'fulfilled' ? connectionsRes.value.data : [];

      const followingIds = new Set((followingData || []).map((f: any) => f.following_id));
      const connectionMap: Record<string, string> = {};
      (connectionsData || []).forEach((c: any) => {
        const otherId = (c.requester_id === sub || c.sender_id === sub)
          ? c.receiver_id
          : (c.requester_id || c.sender_id);
        connectionMap[otherId] = c.status;
      });

      const enriched: User[] = (usersData || [])
        .filter((u: User) => u.cognito_sub !== sub)
        .map((u: User) => ({
          ...u,
          isFollowing: followingIds.has(u.cognito_sub),
          connectionStatus: connectionMap[u.cognito_sub] || 'none',
        }));

      setAllUsers(enriched);
      setUsers(enriched);
    } catch (err) {
      console.error('fetchUsers error:', err);
    }
  }

  // Fetch incoming connection requests (where I am the receiver)
  async function fetchIncomingRequests(t: string) {
    try {
      const res = await axios.get(`${API}/connections/requests`, { headers: { Authorization: `Bearer ${t}` } });
      const requests: IncomingRequest[] = res.data || [];

      // Enrich with sender names by cross-referencing users
      // We'll re-enrich after users are loaded
      setIncomingRequests(requests);
    } catch (err) {
      console.warn('Could not fetch incoming requests:', err);
    }
  }

  async function fetchSaved(t: string) {
    try {
      const res = await axios.get(`${API}/users/saved`, { headers: { Authorization: `Bearer ${t}` } });
      setSavedUsers(new Set((res.data || []).map((u: any) => u.cognito_sub || u.saved_id)));
    } catch { }
  }

  async function fetchBlocked(t: string) {
    try {
      const res = await axios.get(`${API}/users/blocked`, { headers: { Authorization: `Bearer ${t}` } });
      const ids = new Set<string>((res.data || []).map((u: any) => u.cognito_sub || u.blocked_id));
      setBlockedUsers(ids);
      setUsers(prev => prev.filter(u => !ids.has(u.cognito_sub)));
    } catch { }
  }

  // ─── ACCEPT / REJECT incoming request ────────────────────────────────────
  async function handleRequest(senderId: string, action: 'accept' | 'reject') {
    setRequestLoading(p => ({ ...p, [senderId]: action }));
    try {
      await axios.put(
        `${API}/connections/${action}`,
        { sender_id: senderId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Remove from incoming requests list
      setIncomingRequests(prev => prev.filter(r => r.sender_id !== senderId));
      if (action === 'accept') {
        // Update user card to show Connected
        const upd = (list: User[]) =>
          list.map(u => u.cognito_sub === senderId ? { ...u, connectionStatus: 'accepted' } : u);
        setUsers(upd);
        setAllUsers(upd);
      }
    } catch (err: any) {
      console.error(`${action} error:`, err?.response?.data || err.message);
    } finally {
      setRequestLoading(p => { const n = { ...p }; delete n[senderId]; return n; });
    }
  }

  // ─── FOLLOW / UNFOLLOW ────────────────────────────────────────────────────
  async function toggleFollow(user: User) {
    const uid = user.cognito_sub;
    setFollowLoading(p => ({ ...p, [uid]: true }));
    try {
      if (user.isFollowing) {
        await axios.post(`${API}/follow/unfollow`, { following_id: uid }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const upd = (list: User[]) => list.map(u => u.cognito_sub === uid ? { ...u, isFollowing: false } : u);
        setUsers(upd); setAllUsers(upd);
        if (selectedUser?.cognito_sub === uid) setSelectedUser(p => p ? { ...p, isFollowing: false } : null);
      } else {
        await axios.post(`${API}/follow/follow`, { following_id: uid }, { headers: { Authorization: `Bearer ${token}` } });
        const upd = (list: User[]) => list.map(u => u.cognito_sub === uid ? { ...u, isFollowing: true } : u);
        setUsers(upd); setAllUsers(upd);
        if (selectedUser?.cognito_sub === uid) setSelectedUser(p => p ? { ...p, isFollowing: true } : null);
      }
    } catch (err: any) {
      console.error('Follow error:', err?.response?.data || err.message);
    } finally {
      setFollowLoading(p => { const n = { ...p }; delete n[uid]; return n; });
    }
  }

  // ─── CONNECT ──────────────────────────────────────────────────────────────
  async function sendConnect(user: User) {
    const uid = user.cognito_sub;
    setConnectLoading(p => ({ ...p, [uid]: true }));
    try {
      await axios.post(`${API}/connections/request`, { receiver_id: uid }, { headers: { Authorization: `Bearer ${token}` } });
      const upd = (list: User[]) => list.map(u => u.cognito_sub === uid ? { ...u, connectionStatus: 'pending' } : u);
      setUsers(upd); setAllUsers(upd);
      if (selectedUser?.cognito_sub === uid) setSelectedUser(p => p ? { ...p, connectionStatus: 'pending' } : null);
    } catch (err: any) {
      console.error('Connect error:', err?.response?.data || err.message);
    } finally {
      setConnectLoading(p => { const n = { ...p }; delete n[uid]; return n; });
    }
  }

  // ─── SAVE ─────────────────────────────────────────────────────────────────
  async function toggleSave(uid: string) {
    const isSaved = savedUsers.has(uid);
    try {
      if (isSaved) {
        await axios.delete(`${API}/users/save/${uid}`, { headers: { Authorization: `Bearer ${token}` } });
        setSavedUsers(p => { const n = new Set(p); n.delete(uid); return n; });
      } else {
        await axios.post(`${API}/users/save/${uid}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setSavedUsers(p => new Set([...p, uid]));
      }
    } catch { }
  }

  // ─── BLOCK ────────────────────────────────────────────────────────────────
  function openBlockModal(user: User) {
    setBlockModal({ user, action: blockedUsers.has(user.cognito_sub) ? 'unblock' : 'block' });
  }

  async function confirmBlockAction() {
    if (!blockModal) return;
    const { user, action } = blockModal;
    setBlockModal(null);
    try {
      if (action === 'block') {
        await axios.post(`${API}/users/block/${user.cognito_sub}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setBlockedUsers(p => new Set([...p, user.cognito_sub]));
        setUsers(prev => prev.filter(u => u.cognito_sub !== user.cognito_sub));
        if (selectedUser?.cognito_sub === user.cognito_sub) setSelectedUser(null);
      } else {
        await axios.delete(`${API}/users/block/${user.cognito_sub}`, { headers: { Authorization: `Bearer ${token}` } });
        setBlockedUsers(p => { const n = new Set(p); n.delete(user.cognito_sub); return n; });
        const restored = allUsers.find(u => u.cognito_sub === user.cognito_sub);
        if (restored) setUsers(prev => [restored, ...prev]);
      }
    } catch (err: any) {
      console.error('Block error:', err?.response?.data || err.message);
    }
  }

  function getInitials(name: string) {
    return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  function getAvatarColor(name: string) {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
    let h = 0; for (const c of name || '') h += c.charCodeAt(0);
    return colors[h % colors.length];
  }

  // Enrich incoming requests with user names from users list
  const enrichedRequests = incomingRequests.map(req => {
    const sender = allUsers.find(u => u.cognito_sub === req.sender_id);
    return {
      ...req,
      senderName: sender?.name || req.sender_id.slice(0, 8) + '...',
      senderDomain: sender?.domain || '',
      senderBio: sender?.bio || '',
      senderSkills: sender?.skills || [],
    };
  });

  const filtered = users.filter(u => {
    if (blockedUsers.has(u.cognito_sub)) return false;
    if (activeTab === 'saved') return savedUsers.has(u.cognito_sub);
    if (activeTab === 'trending') return true;
    if (domainFilter && u.domain !== domainFilter) return false;
    if (experienceFilter && u.experience !== experienceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.bio?.toLowerCase().includes(q) ||
        u.location?.toLowerCase().includes(q) ||
        u.skills?.some(s => s.toLowerCase().includes(q))
      );
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    return (b.matchScore || 0) - (a.matchScore || 0);
  });

  // ─── INCOMING REQUEST CARD ────────────────────────────────────────────────
  function RequestCard({ req }: { req: IncomingRequest & { senderName?: string; senderDomain?: string; senderBio?: string; senderSkills?: string[] } }) {
    const accepting = requestLoading[req.sender_id] === 'accept';
    const rejecting = requestLoading[req.sender_id] === 'reject';
    const busy = !!requestLoading[req.sender_id];

    return (
      <div style={{
        background: '#11111e', border: '1px solid #2a2a4a', borderRadius: 16,
        padding: '20px 22px', marginBottom: 10,
        boxShadow: '0 0 0 1px rgba(99,102,241,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: getAvatarColor(req.senderName || ''),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: '#fff',
          }}>{getInitials(req.senderName || '')}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{req.senderName}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)',
              }}>Wants to connect</span>
            </div>
            {req.senderDomain && <div style={{ color: '#6366f1', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{req.senderDomain}</div>}
            {req.senderBio && <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 6px', lineHeight: 1.5 }}>{req.senderBio.slice(0, 100)}{req.senderBio.length > 100 ? '...' : ''}</p>}
            {req.senderSkills && req.senderSkills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {req.senderSkills.slice(0, 4).map(s => (
                  <span key={s} style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)',
                  }}>{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Accept / Reject buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => handleRequest(req.sender_id, 'accept')}
              disabled={busy}
              style={{
                padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
                background: accepting ? '#059669' : 'linear-gradient(135deg,#10b981,#059669)',
                border: 'none', color: '#fff',
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy && !accepting ? 0.5 : 1,
                minWidth: 90, transition: 'all 0.2s',
              }}
            >{accepting ? '✓ Accepted!' : '✅ Accept'}</button>

            <button
              onClick={() => handleRequest(req.sender_id, 'reject')}
              disabled={busy}
              style={{
                padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13,
                background: 'transparent',
                border: '1px solid #4b5563',
                color: rejecting ? '#ef4444' : '#9ca3af',
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy && !rejecting ? 0.5 : 1,
                minWidth: 90, transition: 'all 0.2s',
              }}
            >{rejecting ? 'Declined' : '✕ Decline'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── USER CARD ────────────────────────────────────────────────────────────
  function UserCard({ user }: { user: User }) {
    const isSaved = savedUsers.has(user.cognito_sub);
    const isBlocked = blockedUsers.has(user.cognito_sub);
    const fl = followLoading[user.cognito_sub];
    const cl = connectLoading[user.cognito_sub];

    return (
      <div style={{
        background: '#11111e', border: '1px solid #1c1c32', borderRadius: 16,
        padding: '18px 20px', marginBottom: 10, transition: 'border-color 0.2s',
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a2a4a')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#1c1c32')}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div onClick={() => setSelectedUser(user)} style={{
            width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
            background: getAvatarColor(user.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800, color: '#fff', cursor: 'pointer',
          }}>{getInitials(user.name)}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span onClick={() => setSelectedUser(user)} style={{ color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                {user.name}
              </span>
              {user.connectionStatus === 'accepted' && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#10b98120', color: '#10b981', border: '1px solid #10b98140' }}>Connected</span>
              )}
              {user.connectionStatus === 'pending' && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}>Pending</span>
              )}
            </div>
            {user.domain && <div style={{ color: '#6366f1', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{user.domain}</div>}
            {user.bio && (
              <p style={{
                color: '#9ca3af', fontSize: 13, margin: '0 0 6px', lineHeight: 1.5,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
              }}>{user.bio}</p>
            )}
            {user.skills && user.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {user.skills.slice(0, 5).map(s => (
                  <span key={s} style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)',
                  }}>{s}</span>
                ))}
                {user.skills.length > 5 && <span style={{ color: '#6b7280', fontSize: 11, padding: '2px 4px' }}>+{user.skills.length - 5}</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <button onClick={() => toggleSave(user.cognito_sub)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 16, opacity: isSaved ? 1 : 0.35, transition: 'opacity 0.2s',
            }} title={isSaved ? 'Unsave' : 'Save'}>📌</button>

            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => toggleFollow(user)} disabled={fl} style={{
                padding: '7px 15px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: fl ? 'not-allowed' : 'pointer', opacity: fl ? 0.65 : 1,
                background: user.isFollowing ? 'transparent' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border: user.isFollowing ? '1px solid #4b5563' : 'none',
                color: user.isFollowing ? '#9ca3af' : '#fff',
                transition: 'all 0.2s', whiteSpace: 'nowrap', minWidth: 84,
              }}>
                {fl ? 'Wait...' : user.isFollowing ? 'Unfollow' : 'Follow'}
              </button>

              {user.connectionStatus === 'accepted' ? (
                <button onClick={() => router.push(`/chat?userId=${user.cognito_sub}`)} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', cursor: 'pointer',
                }}>Chat</button>
              ) : (
                <button onClick={() => sendConnect(user)} disabled={cl || user.connectionStatus === 'pending'} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: user.connectionStatus === 'pending' ? '#1e1e35' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
                  border: user.connectionStatus === 'pending' ? '1px solid #4b5563' : 'none',
                  color: user.connectionStatus === 'pending' ? '#6b7280' : '#fff',
                  cursor: (cl || user.connectionStatus === 'pending') ? 'not-allowed' : 'pointer',
                }}>{cl ? '...' : user.connectionStatus === 'pending' ? 'Pending' : 'Connect'}</button>
              )}
            </div>

            <button onClick={() => openBlockModal(user)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, padding: '2px 4px', transition: 'color 0.2s',
              color: isBlocked ? '#10b981' : '#4b5563',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = isBlocked ? '#34d399' : '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = isBlocked ? '#10b981' : '#4b5563')}
            >{isBlocked ? '✅ Unblock' : '🚫 Block'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── PROFILE PANEL ────────────────────────────────────────────────────────
  function ProfilePanel({ user }: { user: User }) {
    const isBlocked = blockedUsers.has(user.cognito_sub);
    const fl = followLoading[user.cognito_sub];
    const cl = connectLoading[user.cognito_sub];
    return (
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 370,
        background: '#0d0d1a', borderLeft: '1px solid #1e1e3a',
        zIndex: 1000, overflowY: 'auto', padding: '28px 24px',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.6)', animation: 'slideIn 0.22s ease',
      }}>
        <button onClick={() => setSelectedUser(null)} style={{
          background: '#1e1e35', border: 'none', color: '#9ca3af',
          width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>×</button>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            width: 76, height: 76, borderRadius: '50%', margin: '0 auto 10px',
            background: getAvatarColor(user.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: '#fff',
          }}>{getInitials(user.name)}</div>
          <h2 style={{ color: '#fff', margin: '0 0 4px', fontSize: 19, fontWeight: 700 }}>{user.name}</h2>
          {user.domain && <div style={{ color: '#6366f1', fontSize: 12, fontWeight: 600 }}>{user.domain}</div>}
          {user.location && <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>📍 {user.location}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={() => toggleFollow(user)} disabled={fl} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, fontWeight: 700, fontSize: 13,
            cursor: fl ? 'not-allowed' : 'pointer', opacity: fl ? 0.7 : 1,
            background: user.isFollowing ? 'transparent' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: user.isFollowing ? '1px solid #4b5563' : 'none',
            color: user.isFollowing ? '#9ca3af' : '#fff',
          }}>{fl ? 'Please wait...' : user.isFollowing ? 'Unfollow' : 'Follow'}</button>
          {user.connectionStatus === 'accepted' ? (
            <button onClick={() => router.push(`/chat?userId=${user.cognito_sub}`)} style={{
              flex: 1, padding: '11px 0', borderRadius: 10, fontWeight: 700, fontSize: 13,
              background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', cursor: 'pointer',
            }}>💬 Chat</button>
          ) : (
            <button onClick={() => sendConnect(user)} disabled={cl || user.connectionStatus === 'pending'} style={{
              flex: 1, padding: '11px 0', borderRadius: 10, fontWeight: 700, fontSize: 13,
              background: user.connectionStatus === 'pending' ? '#1e1e35' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
              border: user.connectionStatus === 'pending' ? '1px solid #4b5563' : 'none',
              color: user.connectionStatus === 'pending' ? '#6b7280' : '#fff',
              cursor: (cl || user.connectionStatus === 'pending') ? 'not-allowed' : 'pointer',
            }}>{cl ? '...' : user.connectionStatus === 'pending' ? 'Pending' : 'Connect'}</button>
          )}
        </div>
        <button onClick={() => openBlockModal(user)} style={{
          width: '100%', padding: '10px 0', borderRadius: 10, marginBottom: 22,
          background: 'transparent', border: `1px solid ${isBlocked ? '#10b981' : '#ef4444'}`,
          color: isBlocked ? '#10b981' : '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>{isBlocked ? '✅ Unblock User' : '🚫 Block User'}</button>
        {user.bio && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>About</div>
            <p style={{ color: '#d1d5db', fontSize: 13, lineHeight: 1.65, margin: 0 }}>{user.bio}</p>
          </div>
        )}
        {user.skills && user.skills.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Skills</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {user.skills.map(s => (
                <span key={s} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)',
                }}>{s}</span>
              ))}
            </div>
          </div>
        )}
        {(user.github_url || user.linkedin_url) && (
          <div style={{ display: 'flex', gap: 8 }}>
            {user.github_url && <a href={user.github_url} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center', background: '#1e1e35', color: '#e5e7eb', fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid #2a2a4a' }}>🔗 GitHub</a>}
            {user.linkedin_url && <a href={user.linkedin_url} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '10px 0', borderRadius: 10, textAlign: 'center', background: '#1e1e35', color: '#e5e7eb', fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid #2a2a4a' }}>💼 LinkedIn</a>}
          </div>
        )}
        <style>{`@keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      </div>
    );
  }

  if (loading) return (
    <div style={{ background: '#0a0a15', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6366f1', fontSize: 16, fontWeight: 600 }}>Loading professionals...</div>
    </div>
  );

  return (
    <div style={{ background: '#0a0a15', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {blockModal && <BlockModal user={blockModal.user} action={blockModal.action} onConfirm={confirmBlockAction} onCancel={() => setBlockModal(null)} />}
      {selectedUser && <ProfilePanel user={selectedUser} />}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 26 }}>
          <h1 style={{ color: '#fff', fontSize: 27, fontWeight: 800, margin: '0 0 4px' }}>Discover People 🌐</h1>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>
            {activeTab === 'pending' ? `${enrichedRequests.length} pending request${enrichedRequests.length !== 1 ? 's' : ''}` : `${filtered.length} professionals on SkillNest`}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[
            { key: 'discover', label: '⚡ Discover' },
            { key: 'pending', label: `📨 Requests (${enrichedRequests.length})` },
            { key: 'saved', label: `⭐ Saved (${savedUsers.size})` },
            { key: 'trending', label: '🔥 Trending' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeTab === tab.key ? '#6366f1' : '#141428',
              border: activeTab === tab.key ? 'none' : '1px solid #252540',
              color: activeTab === tab.key ? '#fff' : '#9ca3af', transition: 'all 0.2s',
              position: 'relative',
            }}>
              {tab.label}
              {tab.key === 'pending' && enrichedRequests.length > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#ef4444', color: '#fff', borderRadius: '50%',
                  width: 18, height: 18, fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{enrichedRequests.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Pending Tab — Incoming Requests */}
        {activeTab === 'pending' ? (
          <div>
            {enrichedRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: '#4b5563' }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📭</div>
                <p style={{ fontSize: 15 }}>No pending connection requests.</p>
              </div>
            ) : (
              enrichedRequests.map(req => <RequestCard key={req.id || req.sender_id} req={req} />)
            )}
          </div>
        ) : (
          <>
            {/* Search */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="🔍 Search by name, skill, location..."
                style={{ flex: 1, padding: '11px 16px', borderRadius: 12, background: '#111125', border: '1px solid #252540', color: '#fff', fontSize: 14, outline: 'none' }} />
              <button style={{
                padding: '11px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13,
                background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', border: 'none', color: '#fff', cursor: 'pointer',
              }}>🔮 AI Search</button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)} style={{
                padding: '8px 12px', borderRadius: 10, background: '#111125', border: '1px solid #252540',
                color: domainFilter ? '#fff' : '#6b7280', fontSize: 13, cursor: 'pointer', outline: 'none',
              }}>
                <option value="">All Domains</option>
                {['Web Dev', 'Data Science', 'DevOps', 'Mobile', 'Design', 'AI/ML', 'Cybersecurity'].map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <select value={experienceFilter} onChange={e => setExperienceFilter(e.target.value)} style={{
                padding: '8px 12px', borderRadius: 10, background: '#111125', border: '1px solid #252540',
                color: experienceFilter ? '#fff' : '#6b7280', fontSize: 13, cursor: 'pointer', outline: 'none',
              }}>
                <option value="">All Experience</option>
                {['Beginner', 'Intermediate', 'Expert'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                padding: '8px 12px', borderRadius: 10, background: '#111125', border: '1px solid #252540',
                color: '#fff', fontSize: 13, cursor: 'pointer', outline: 'none',
              }}>
                <option value="match">⭐ Best Match</option>
                <option value="newest">🕒 Newest</option>
                <option value="name">🔤 Name</option>
              </select>
              {(domainFilter || experienceFilter || searchQuery) && (
                <button onClick={() => { setDomainFilter(''); setExperienceFilter(''); setSearchQuery(''); }} style={{
                  padding: '8px 14px', borderRadius: 10, background: 'transparent',
                  border: '1px solid #4b5563', color: '#9ca3af', cursor: 'pointer', fontSize: 13,
                }}>✕ Clear</button>
              )}
            </div>

            <p style={{ color: '#4b5563', fontSize: 13, marginBottom: 14 }}>Showing {filtered.length} of {users.length} professionals</p>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: '#4b5563' }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>👥</div>
                <p style={{ fontSize: 15 }}>No users found. Try different filters.</p>
              </div>
            ) : filtered.map(u => <UserCard key={u.cognito_sub} user={u} />)}
          </>
        )}
      </div>
    </div>
  );
}

