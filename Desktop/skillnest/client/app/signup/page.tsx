'use client';
import { useState } from 'react';
import { Amplify } from '@aws-amplify/core';
import { confirmSignUp, signUp } from '@aws-amplify/auth';
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

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'signup' | 'verify'>('signup');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const passwordStrength = () => {
    const p = form.password;
    if (p.length === 0) return { score: 0, label: '', color: '#334155' };
    if (p.length < 6) return { score: 1, label: 'Too short', color: '#ef4444' };
    if (p.length < 8) return { score: 2, label: 'Weak', color: '#f97316' };
    if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { score: 3, label: 'Medium', color: '#f59e0b' };
    return { score: 4, label: 'Strong 💪', color: '#22c55e' };
  };
  const strength = passwordStrength();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signUp({
        username: form.email,
        password: form.password,
        options: { userAttributes: { email: form.email, name: form.name } },
      });
      setStep('verify');
    } catch (err: any) { setError(err.message || 'Signup failed.'); }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await confirmSignUp({ username: form.email, confirmationCode: code });
      router.push('/login');
    } catch (err: any) { setError(err.message || 'Verification failed.'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .su-input { width: 100%; padding: 14px 16px; background: #1e293b; border: 1.5px solid #334155; border-radius: 12px; color: white; font-size: 15px; outline: none; box-sizing: border-box; transition: all 0.2s; }
        .su-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .su-input::placeholder { color: #475569; }
        .su-btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 12px; color: white; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .su-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(99,102,241,0.4); }
        .su-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>

      {/* Left Panel */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #0c1a3a 0%, #1a1a4e 50%, #0c1a3a 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.6s ease', width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🪺</div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: 'white', margin: '0 0 10px' }}>Join SkillNest</h1>
          <p style={{ color: '#7c87c4', fontSize: 16, marginBottom: 48, lineHeight: 1.6 }}>Build your skill profile and connect with talented professionals.</p>
          {[{ icon: '✍️', title: 'Create your profile', desc: 'Add your skills, bio, and experience' },
            { icon: '🔍', title: 'Discover people', desc: 'Find professionals who match your skills' },
            { icon: '🤝', title: 'Connect & grow', desc: 'Chat, collaborate, and exchange skills' }
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 20px', textAlign: 'left', marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: 'white', fontSize: 14 }}>{s.title}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: '#0f172a', borderLeft: '1px solid #1e293b' }}>
        <div style={{ width: '100%', animation: 'fadeUp 0.5s ease' }}>
          {step === 'signup' ? (
            <>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: 'white', margin: '0 0 8px' }}>Create your account ✨</h2>
                <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>It's free and takes less than a minute</p>
              </div>
              {error && <div style={{ background: '#3f1a1a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: 14 }}>⚠️ {error}</div>}
              <form onSubmit={handleSignup}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Full Name</label>
                  <input className="su-input" type="text" placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Email Address</label>
                  <input className="su-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="su-input" type={showPass ? 'text' : 'password'} placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required style={{ paddingRight: 48 }} />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, padding: 0 }}>
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                {form.password.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength.score ? strength.color : '#1e293b' }} />)}
                    </div>
                    <div style={{ fontSize: 12, color: strength.color, fontWeight: 600 }}>{strength.label}</div>
                  </div>
                )}
                {form.password.length === 0 && <div style={{ marginBottom: 24 }} />}
                <button className="su-btn" type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create Account →'}</button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <span style={{ color: '#475569', fontSize: 14 }}>Already have an account? </span>
                <a href="/login" style={{ color: '#818cf8', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Sign in →</a>
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 10px' }}>Check your email</h2>
                <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>We sent a 6-digit code to<br /><span style={{ color: '#818cf8', fontWeight: 600 }}>{form.email}</span></p>
              </div>
              {error && <div style={{ background: '#3f1a1a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: 14 }}>⚠️ {error}</div>}
              <form onSubmit={handleVerify}>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Verification Code</label>
                  <input className="su-input" type="text" placeholder="Enter 6-digit code" value={code} onChange={e => setCode(e.target.value)} maxLength={6} required style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: 700 }} />
                </div>
                <button className="su-btn" type="submit" disabled={loading}>{loading ? 'Verifying...' : '✅ Verify & Continue'}</button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <button onClick={() => setStep('signup')} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer' }}>← Use a different email</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
