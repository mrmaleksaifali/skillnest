'use client';

import { useEffect, useState, useRef } from 'react';
import { getAuthToken, requireAuth } from '../lib/auth';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

interface Message {
  id?: number;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  seen?: boolean;
}

interface User {
  id: string;
  cognito_sub: string;
  name: string;
  email: string;
  bio?: string;
  skills?: string[];
  domain?: string;
  location?: string;
  github_url?: string;
  linkedin_url?: string;
  experience_level?: string;
  avatar_url?: string;
}

const EMOJIS = ['😊','😂','❤️','👍','🔥','🎉','😎','🤝','💡','👏','🚀','💪','😅','🙏','✅','😍','🤔','👀','💯','🎯'];

function getInitials(name: string) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function getAvatarColor(name: string) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
  let hash = 0;
  for (const c of name || '') hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function ChatPage() {
  const router = useRouter();
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [searchChat, setSearchChat] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [socketConnected, setSocketConnected] = useState(false);

  // Profile panel state
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getToken = getAuthToken;

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const init = async () => {
      try {
        const token = await requireAuth(router);
        const headers = { Authorization: `Bearer ${token}` };

        const [meRes, allRes, connRes] = await Promise.all([
          axios.get('https://d2wd5c91egufsr.cloudfront.net/api/users/me', { headers }),
          axios.get('https://d2wd5c91egufsr.cloudfront.net/api/users/all', { headers }),
          axios.get('https://d2wd5c91egufsr.cloudfront.net/api/connect/status', { headers }),
        ]);

        const me = meRes.data;
        setMyId(me.cognito_sub);
        setMyName(me.name);

        const accepted = connRes.data.filter((c: any) => c.status === 'accepted');
        const seen = new Set<string>();
        const chatUsers: User[] = [];

        accepted.forEach((conn: any) => {
          const otherId = conn.sender_id === me.cognito_sub ? conn.receiver_id : conn.sender_id;
          if (!seen.has(otherId)) {
            seen.add(otherId);
            const user = allRes.data.find((u: User) => u.cognito_sub === otherId);
            if (user) chatUsers.push(user);
          }
        });

        setConnectedUsers(chatUsers);

        const socket = io('http://15.206.124.18:4004', { transports: ['polling', 'websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
          setSocketConnected(true);
          socket.emit('user_online', me.cognito_sub);
        });

        socket.on('disconnect', () => setSocketConnected(false));

        socket.on('online_users', (users: string[]) => setOnlineUsers(users));

        socket.on('receive_message', (msg: Message) => {
          setMessages(prev => {
            const exists = prev.some(m =>
              m.sender_id === msg.sender_id &&
              m.message === msg.message &&
              Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 2000
            );
            if (exists) return prev;
            return [...prev, msg];
          });

          setSelectedUser(current => {
            if (!current || current.cognito_sub !== msg.sender_id) {
              setUnreadCounts(prev => ({
                ...prev,
                [msg.sender_id]: (prev[msg.sender_id] || 0) + 1
              }));
            }
            return current;
          });
        });

        socket.on('user_typing', ({ userId }: { userId: string }) => {
          setSelectedUser(current => {
            if (current?.cognito_sub === userId) setIsTyping(true);
            return current;
          });
        });

        socket.on('user_stop_typing', ({ userId }: { userId: string }) => {
          setSelectedUser(current => {
            if (current?.cognito_sub === userId) setIsTyping(false);
            return current;
          });
        });

      } catch (err) {
        console.error('Chat init error:', err);
      }
    };

    init();
    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    if (!selectedUser || !myId) return;
    const roomId = [myId, selectedUser.cognito_sub].sort().join('_');
    socketRef.current?.emit('join_room', roomId);
    setUnreadCounts(prev => ({ ...prev, [selectedUser.cognito_sub]: 0 }));
    loadMessages();
    inputRef.current?.focus();
  }, [selectedUser?.cognito_sub, myId]);

  const loadMessages = async () => {
    if (!selectedUser) return;
    try {
      const token = await getToken();
      const res = await axios.get(
        `https://d2wd5c91egufsr.cloudfront.net/api/chat/messages/${selectedUser.cognito_sub}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(res.data);
      setTimeout(() => scrollToBottom(false), 50);
    } catch (err) {
      console.error('Load messages error:', err);
    }
  };

  // Load profile panel data
  const openProfilePanel = async (user: User) => {
    setShowProfile(true);
    setProfileLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [profileRes, followStatusRes, followCountRes] = await Promise.all([
        axios.get(`https://d2wd5c91egufsr.cloudfront.net/api/users/profile/${user.cognito_sub}`, { headers }).catch(() => ({ data: user })),
        axios.get(`https://d2wd5c91egufsr.cloudfront.net/api/follow/status/${user.cognito_sub}`, { headers }).catch(() => ({ data: { isFollowing: false } })),
        axios.get(`https://d2wd5c91egufsr.cloudfront.net/api/follow/count/${user.cognito_sub}`, { headers }).catch(() => ({ data: { followers: 0, following: 0 } })),
      ]);
      setProfileData(profileRes.data);
      setIsFollowing(followStatusRes.data.isFollowing);
      setFollowCounts(followCountRes.data);
    } catch (err) {
      setProfileData(user);
    } finally {
      setProfileLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (!profileData) return;
    setFollowLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      if (isFollowing) {
        await axios.post('https://d2wd5c91egufsr.cloudfront.net/api/follow/unfollow', { following_id: profileData.cognito_sub }, { headers });
        setIsFollowing(false);
        setFollowCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await axios.post('https://d2wd5c91egufsr.cloudfront.net/api/follow/follow',
          { following_id: profileData.cognito_sub },
          { headers }
        );
        setIsFollowing(true);
        setFollowCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (err) {
      console.error('Follow/unfollow error:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    const token = await getToken();
    const msgData: Message = {
      sender_id: myId,
      receiver_id: selectedUser.cognito_sub,
      message: newMessage.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, msgData]);
    setNewMessage('');
    setShowEmoji(false);

    try {
      await axios.post(
        'https://d2wd5c91egufsr.cloudfront.net/api/chat/send',
        { receiver_id: selectedUser.cognito_sub, message: msgData.message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error('Send error:', err);
    }

    const roomId = [myId, selectedUser.cognito_sub].sort().join('_');
    socketRef.current?.emit('send_message', { ...msgData, sender_name: myName, room: roomId });
    socketRef.current?.emit('stop_typing', { sender_id: myId, receiver_id: selectedUser.cognito_sub });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!selectedUser) return;
    socketRef.current?.emit('typing', { sender_id: myId, receiver_id: selectedUser.cognito_sub });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop_typing', { sender_id: myId, receiver_id: selectedUser.cognito_sub });
    }, 1500);
  };

  const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, msg) => {
    const date = formatDate(msg.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  const filteredUsers = connectedUsers.filter(u =>
    u.name.toLowerCase().includes(searchChat.toLowerCase())
  );

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 57px)', background: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif', position: 'relative' }}>

      {/* SIDEBAR */}
      <div style={{ width: 280, borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', background: '#0a1628', flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              💬 Messages
              {totalUnread > 0 && (
                <span style={{ marginLeft: 8, background: '#ef4444', color: 'white', borderRadius: 10, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                  {totalUnread}
                </span>
              )}
            </h3>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: socketConnected ? '#22c55e' : '#ef4444', border: '2px solid #0a1628' }} />
          </div>
          <input
            placeholder="Search chats..."
            value={searchChat}
            onChange={e => setSearchChat(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredUsers.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>
              No connected users yet.
            </div>
          ) : (
            filteredUsers.map(user => {
              const isOnline = onlineUsers.includes(user.cognito_sub);
              const isSelected = selectedUser?.cognito_sub === user.cognito_sub;
              const unread = unreadCounts[user.cognito_sub] || 0;
              return (
                <div key={user.cognito_sub} onClick={() => setSelectedUser(user)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer',
                    background: isSelected ? '#1e3a5f' : 'transparent',
                    borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ position: 'relative', marginRight: 12, flexShrink: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: getAvatarColor(user.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
                      {getInitials(user.name)}
                    </div>
                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: isOnline ? '#22c55e' : '#475569', border: '2px solid #0a1628' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{user.name}</span>
                      {unread > 0 && (
                        <span style={{ background: '#3b82f6', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                          {unread}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: isOnline ? '#22c55e' : '#475569' }}>
                      {isOnline ? '🟢 Online' : '⚫ Offline'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedUser ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#475569' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Select a conversation</div>
            <div style={{ fontSize: 14 }}>Choose a connected user to start chatting</div>
          </div>
        ) : (
          <>
            {/* Chat Header — clickable name opens profile */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => openProfilePanel(selectedUser)}
                title="Click to view profile"
              >
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: getAvatarColor(selectedUser.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                    {getInitials(selectedUser.name)}
                  </div>
                  <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: onlineUsers.includes(selectedUser.cognito_sub) ? '#22c55e' : '#475569', border: '2px solid #0a1628' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selectedUser.name}
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 400 }}>· tap to view profile</span>
                  </div>
                  <div style={{ fontSize: 12, color: isTyping ? '#f59e0b' : onlineUsers.includes(selectedUser.cognito_sub) ? '#22c55e' : '#475569' }}>
                    {isTyping ? '✏️ typing...' : onlineUsers.includes(selectedUser.cognito_sub) ? '🟢 Online' : '⚫ Offline'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                {socketConnected ? '⚡ Real-time' : '⏳ Connecting...'}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#475569', margin: 'auto' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
                  <div>Say hello to {selectedUser.name}!</div>
                </div>
              )}

              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                    <span style={{ background: '#1e293b', padding: '4px 14px', borderRadius: 12, fontSize: 11, color: '#64748b', border: '1px solid #334155' }}>
                      {date}
                    </span>
                  </div>
                  {msgs.map((msg, i) => {
                    const isMine = msg.sender_id === myId;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 4, alignItems: 'flex-end', gap: 6 }}>
                        {!isMine && (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(selectedUser.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {getInitials(selectedUser.name)}
                          </div>
                        )}
                        <div style={{
                          maxWidth: '65%', padding: '10px 14px',
                          borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: isMine ? '#3b82f6' : '#1e293b',
                          border: isMine ? 'none' : '1px solid #334155',
                          fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                        }}>
                          <div>{msg.message}</div>
                          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: isMine ? 'right' : 'left', display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'center', gap: 4 }}>
                            <span>{formatTime(msg.created_at)}</span>
                            {isMine && (
                              <span style={{ color: lastSeen[selectedUser.cognito_sub] ? '#38bdf8' : 'rgba(255,255,255,0.5)' }}>
                                {lastSeen[selectedUser.cognito_sub] ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {isTyping && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(selectedUser.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                    {getInitials(selectedUser.name)}
                  </div>
                  <div style={{ padding: '10px 16px', borderRadius: '18px 18px 18px 4px', background: '#1e293b', border: '1px solid #334155', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Emoji picker */}
            {showEmoji && (
              <div style={{ padding: '8px 20px', background: '#0a1628', borderTop: '1px solid #1e293b', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => setNewMessage(prev => prev + emoji)}
                    style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', padding: '4px', borderRadius: 6 }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #1e293b', display: 'flex', gap: 10, background: '#0a1628', alignItems: 'center' }}>
              <button onClick={() => setShowEmoji(prev => !prev)}
                style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', padding: '6px', borderRadius: 8, color: showEmoji ? '#f59e0b' : '#64748b' }}>
                😊
              </button>
              <input
                ref={inputRef}
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={`Message ${selectedUser.name}...`}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: '1px solid #334155', background: '#1e293b', color: 'white', fontSize: 14, outline: 'none' }}
              />
              <button onClick={sendMessage} disabled={!newMessage.trim()}
                style={{ padding: '10px 20px', background: newMessage.trim() ? '#3b82f6' : '#1e293b', border: 'none', borderRadius: 24, color: 'white', fontWeight: 700, fontSize: 14, cursor: newMessage.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}>
                Send ➤
              </button>
            </div>
          </>
        )}
      </div>

      {/* USER PROFILE PANEL — slides in from right */}
      {showProfile && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowProfile(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 340,
            background: '#0f172a',
            borderLeft: '1px solid #1e293b',
            zIndex: 101,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.25s ease',
            overflowY: 'auto',
          }}>

            {/* Panel Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Profile</div>
              <button onClick={() => setShowProfile(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>
                ×
              </button>
            </div>

            {profileLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Loading...
              </div>
            ) : profileData ? (
              <div style={{ padding: 24 }}>

                {/* Avatar + Name */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: getAvatarColor(profileData.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 30, marginBottom: 14 }}>
                    {getInitials(profileData.name)}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'center' }}>{profileData.name}</div>
                  {profileData.domain && (
                    <div style={{ color: '#38bdf8', fontSize: 13, marginTop: 4 }}>🏷️ {profileData.domain}</div>
                  )}
                  {profileData.location && (
                    <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>📍 {profileData.location}</div>
                  )}
                  {profileData.experience_level && (
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>⭐ {profileData.experience_level}</div>
                  )}

                  {/* Online status */}
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: onlineUsers.includes(profileData.cognito_sub) ? '#22c55e' : '#475569' }} />
                    <span style={{ fontSize: 12, color: onlineUsers.includes(profileData.cognito_sub) ? '#22c55e' : '#475569' }}>
                      {onlineUsers.includes(profileData.cognito_sub) ? 'Online now' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Follow stats */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, background: '#1e293b', borderRadius: 12, padding: '12px', textAlign: 'center', border: '1px solid #334155' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8' }}>{followCounts.followers}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Followers</div>
                  </div>
                  <div style={{ flex: 1, background: '#1e293b', borderRadius: 12, padding: '12px', textAlign: 'center', border: '1px solid #334155' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#a78bfa' }}>{followCounts.following}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Following</div>
                  </div>
                </div>

                {/* Follow button */}
                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: isFollowing ? '#1e293b' : '#3b82f6',
                    color: isFollowing ? '#94a3b8' : 'white',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    marginBottom: 20,
                    border: isFollowing ? '1px solid #334155' : 'none',
                    transition: 'all 0.2s',
                  } as any}
                >
                  {followLoading ? '...' : isFollowing ? '✓ Following' : '+ Follow'}
                </button>

                {/* Bio */}
                {profileData.bio && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>About</div>
                    <div style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, background: '#1e293b', borderRadius: 10, padding: 14, border: '1px solid #334155' }}>
                      {profileData.bio}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {profileData.skills && profileData.skills.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Skills</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {profileData.skills.map((skill: string) => (
                        <span key={skill} style={{ background: '#1e3a5f', color: '#60a5fa', padding: '4px 12px', borderRadius: 20, fontSize: 12, border: '1px solid #1e4a7f' }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                {(profileData.github_url || profileData.linkedin_url) && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Links</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {profileData.github_url && (
                        <a href={profileData.github_url} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1e293b', borderRadius: 10, color: '#94a3b8', textDecoration: 'none', fontSize: 13, border: '1px solid #334155' }}>
                          <span>🐙</span> GitHub
                        </a>
                      )}
                      {profileData.linkedin_url && (
                        <a href={profileData.linkedin_url} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1e293b', borderRadius: 10, color: '#94a3b8', textDecoration: 'none', fontSize: 13, border: '1px solid #334155' }}>
                          <span>💼</span> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Email */}
                <div style={{ padding: '12px 14px', background: '#1e293b', borderRadius: 10, border: '1px solid #334155', fontSize: 13, color: '#64748b' }}>
                  ✉️ {profileData.email}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

