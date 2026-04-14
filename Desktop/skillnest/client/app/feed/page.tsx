'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { requireAuth, getAuthToken } from '../lib/auth';

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [commentText, setCommentText] = useState<{ [key: number]: string }>({});
  const [showComments, setShowComments] = useState<{ [key: number]: boolean }>({});

  const getHeaders = async () => {
    const token = await getAuthToken();
    return { Authorization: `Bearer ${token}` };
  };

  const loadFeed = async () => {
    try {
      const token = await requireAuth(router);
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, postsRes] = await Promise.all([
        axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/users/me', { headers }),
        axios.get('https://d2tf8c984u0s6x.cloudfront.net/api/posts', { headers }),
      ]);
      setMyId(meRes.data.cognito_sub);
      setMyName(meRes.data.name);
      setPosts(postsRes.data);
    } catch (err: any) {
      if (err?.message === 'Not authenticated') return;
      console.error('Feed error:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadFeed(); }, []);

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const headers = await getHeaders();
      const res = await axios.post('https://d2tf8c984u0s6x.cloudfront.net/api/posts', { content }, { headers });
      setPosts([res.data, ...posts]);
      setContent('');
    } catch (err) { console.error(err); }
    setPosting(false);
  };

  const handleLike = async (postId: number) => {
    try {
      const headers = await getHeaders();
      const res = await axios.post(`https://d2tf8c984u0s6x.cloudfront.net/api/posts/${postId}/like`, {}, { headers });
      setPosts(posts.map(p => p.id === postId ? { ...p, likes: res.data.likes } : p));
    } catch (err) { console.error(err); }
  };

  const handleComment = async (postId: number) => {
    const text = commentText[postId];
    if (!text?.trim()) return;
    try {
      const headers = await getHeaders();
      const res = await axios.post(`https://d2tf8c984u0s6x.cloudfront.net/api/posts/${postId}/comment`, { content: text }, { headers });
      setPosts(posts.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), res.data] } : p));
      setCommentText({ ...commentText, [postId]: '' });
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (postId: number) => {
    try {
      const headers = await getHeaders();
      await axios.delete(`https://d2tf8c984u0s6x.cloudfront.net/api/posts/${postId}`, { headers });
      setPosts(posts.filter(p => p.id !== postId));
    } catch (err) { console.error(err); }
  };

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }
  function getAvatarColor(name: string) {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
    let hash = 0;
    for (const c of name || '') hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
  function timeAgo(date: string) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>📰 Feed</div>

        {/* Create Post */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 20, border: '1px solid #334155', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: getAvatarColor(myName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
              {getInitials(myName)}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Share something with the community... 🚀"
              rows={3}
              style={{ flex: 1, background: '#0f172a', border: '1.5px solid #334155', borderRadius: 12, padding: '12px 16px', color: 'white', fontSize: 15, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: '#475569' }}>{content.length}/500</span>
            <button
              onClick={handlePost}
              disabled={posting || !content.trim()}
              style={{ padding: '10px 24px', background: content.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#334155', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, cursor: content.trim() ? 'pointer' : 'not-allowed', fontSize: 14 }}
            >
              {posting ? 'Posting...' : 'Post 🚀'}
            </button>
          </div>
        </div>

        {/* Posts Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading feed...</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b', background: '#1e293b', borderRadius: 16, border: '1px solid #334155' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>No posts yet</div>
            <div style={{ fontSize: 14 }}>Be the first to share something!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {posts.map(post => (
              <div key={post.id} style={{ background: '#1e293b', borderRadius: 16, padding: 20, border: '1px solid #334155' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: getAvatarColor(post.author_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
                      {getInitials(post.author_name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{post.author_name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{timeAgo(post.created_at)}</div>
                    </div>
                  </div>
                  {post.author_id === myId && (
                    <button onClick={() => handleDelete(post.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>🗑️</button>
                  )}
                </div>

                {/* Content */}
                <p style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 1.7, margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>{post.content}</p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 16, paddingTop: 12, borderTop: '1px solid #334155' }}>
                  <button onClick={() => handleLike(post.id)}
                    style={{ background: 'none', border: 'none', color: post.likes?.includes(myId) ? '#f472b6' : '#64748b', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    {post.likes?.includes(myId) ? '❤️' : '🤍'} {post.likes?.length || 0} Likes
                  </button>
                  <button onClick={() => setShowComments({ ...showComments, [post.id]: !showComments[post.id] })}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                    💬 {post.comments?.length || 0} Comments
                  </button>
                </div>

                {/* Comments */}
                {showComments[post.id] && (
                  <div style={{ marginTop: 12 }}>
                    {(post.comments || []).map((c: any) => (
                      <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: getAvatarColor(c.author_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                          {getInitials(c.author_name)}
                        </div>
                        <div style={{ background: '#0f172a', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name} <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}>{timeAgo(c.created_at)}</span></div>
                          <div style={{ fontSize: 14, color: '#cbd5e1', marginTop: 2 }}>{c.content}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        value={commentText[post.id] || ''}
                        onChange={e => setCommentText({ ...commentText, [post.id]: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleComment(post.id)}
                        placeholder="Write a comment..."
                        style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 14, outline: 'none' }}
                      />
                      <button onClick={() => handleComment(post.id)}
                        style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


