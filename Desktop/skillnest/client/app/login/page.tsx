'use client';
import { useEffect, useState } from 'react';
import { Amplify } from '@aws-amplify/core';
import { getCurrentUser, signIn, signOut } from '@aws-amplify/auth';
import { useRouter } from 'next/navigation';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_TCheqKNUA',
      userPoolClientId: '797pd77i4irdf3oavq17glgvr0',
      loginWith: { email: true },
    }
  }
});

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        await getCurrentUser();
        router.push('/dashboard');
      } catch { }
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const attemptSignIn = async () => {
      await signIn({ username: form.email, password: form.password, options: { authFlowType: 'USER_PASSWORD_AUTH' } });
      router.push('/dashboard');
    };
    try {
      await attemptSignIn();
    } catch (err: any) {
      const message = err?.message || '';
      if (message.toLowerCase().includes('already a signed in user')) {
        try { await signOut(); await attemptSignIn(); return; }
        catch (e: any) { setError(e?.message || 'Login failed'); setLoading(false); return; }
      }
      setError(message || 'Login failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .login-input { width: 100%; padding: 14px 16px; background: #1e293b; border: 1.5px solid #334155; border-radius: 12px; color: white; font-size: 15px; outline: none; box-sizing: border-box; transition: border-color 0.2s; }
        .login-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .login-input::placeholder { color: #475569; }
        .login-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border: none; border-radius: 12px; color: white; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .login-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(99,102,241,0.4); }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>

      {/* Left Panel */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '15%', left: '10%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', filter: 'blur(40px)', animation: 'pulse 4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '22%', right: '12%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#c4b5fd', animation: 'float 4s ease-in-out infinite', backdropFilter: 'blur(8px)' }}>🚀 React Developer</div>
        <div style={{ position: 'absolute', bottom: '30%', left: '8%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#a5f3fc', animation: 'float 5s ease-in-out infinite 1s', backdropFilter: 'blur(8px)' }}>☁️ Cloud Engineer</div>
        <div style={{ position: 'relative', textAlign: 'center', animation: 'fadeUp 0.6s ease' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🪺</div>
          <h1 style={{ fontSize: 42, fontWeight: 900, color: 'white', margin: '0 0 12px', letterSpacing: -1 }}>SkillNest</h1>
          <p style={{ fontSize: 18, color: '#a5b4fc', marginBottom: 40, lineHeight: 1.5 }}>Where skills meet opportunity.<br />Connect, learn, and grow together.</p>
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
            {[{ num: '500+', label: 'Professionals' }, { num: '50+', label: 'Skills' }, { num: '100%', label: 'Free' }].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#c4b5fd' }}>{s.num}</div>
                <div style={{ fontSize: 12, color: '#6d7fc4', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: '#0f172a', borderLeft: '1px solid #1e293b' }}>
        <div style={{ width: '100%', animation: 'fadeUp 0.5s ease' }}>
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: '0 0 8px' }}>Welcome back 👋</h2>
            <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>Sign in to your SkillNest account</p>
          </div>
          {error && <div style={{ background: '#3f1a1a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: 14 }}>⚠️ {error}</div>}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Email Address</label>
              <input className="login-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input className="login-input" type={showPass ? 'text' : 'password'} placeholder="Enter your password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required style={{ paddingRight: 48 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 0 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button className="login-btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In →'}</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <span style={{ color: '#475569', fontSize: 14 }}>Don't have an account? </span>
            <a href="/signup" style={{ color: '#818cf8', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Create one free →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
