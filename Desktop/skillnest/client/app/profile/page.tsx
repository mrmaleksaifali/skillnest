'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getAuthToken, requireAuth } from '../lib/auth';
import { useRouter } from 'next/navigation';

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Expert'];

interface Experience {
  company: string;
  role: string;
  duration: string;
  description: string;
}

interface Project {
  title: string;
  description: string;
  link: string;
  tech: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const avatarRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'skills' | 'experience' | 'projects' | 'links'>('basic');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [resumeName, setResumeName] = useState('');

  const [form, setForm] = useState({
    name: '',
    bio: '',
    is_public: true,
    github_url: '',
    linkedin_url: '',
    avatar_url: '',
    resume_url: '',
    location: '',
    domain: '',
    experience: '',
  });

  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [skillLevels, setSkillLevels] = useState<Record<string, string>>({});
  const [experience, setExperience] = useState<Experience[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const getToken = getAuthToken;

  const loadUser = async () => {
    try {
      const token = await requireAuth(router);
      const res = await axios.get('http://15.206.124.18:4000/api/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      setUser(data);
      setForm({
        name: data.name || '',
        bio: data.bio || '',
        is_public: data.is_public ?? true,
        github_url: data.github_url || '',
        linkedin_url: data.linkedin_url || '',
        avatar_url: data.avatar_url || '',
        resume_url: data.resume_url || '',
        location: data.location || '',
        domain: data.domain || '',
        experience: data.experience_level || '',
      });
      setSkills(data.skills || []);
      setSkillLevels(data.skill_levels || {});
      setExperience(data.experience || []);
      setProjects(data.projects || []);
      if (data.avatar_url) setAvatarPreview(data.avatar_url);
      if (data.resume_url) setResumeName('Resume uploaded ✅');
    } catch (err) {
      console.error('Load error:', err);
    }
  };

  useEffect(() => { loadUser(); }, []);

  // Upload file to S3 via presigned URL (simulated — stores base64 locally for now)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      setForm(f => ({ ...f, avatar_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeName(file.name);
    // Store filename as resume_url for now (S3 upload would go here)
    setForm(f => ({ ...f, resume_url: `resume_${file.name}` }));
  };

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills([...skills, trimmed]);
    setSkillLevels({ ...skillLevels, [trimmed]: 'Beginner' });
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
    const updated = { ...skillLevels };
    delete updated[skill];
    setSkillLevels(updated);
  };

  const addExperience = () => {
    setExperience([...experience, { company: '', role: '', duration: '', description: '' }]);
  };

  const updateExperience = (i: number, field: keyof Experience, val: string) => {
    const updated = [...experience];
    updated[i] = { ...updated[i], [field]: val };
    setExperience(updated);
  };

  const removeExperience = (i: number) => {
    setExperience(experience.filter((_, idx) => idx !== i));
  };

  const addProject = () => {
    setProjects([...projects, { title: '', description: '', link: '', tech: '' }]);
  };

  const updateProject = (i: number, field: keyof Project, val: string) => {
    const updated = [...projects];
    updated[i] = { ...updated[i], [field]: val };
    setProjects(updated);
  };

  const removeProject = (i: number) => {
    setProjects(projects.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await getToken();
      await axios.put('http://15.206.124.18:4000/api/users/update', {
        ...form,
        skills,
        skill_levels: skillLevels,
        experience_entries: experience,
        experience: form.experience,
        location: form.location,
        domain: form.domain,
        projects,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('✅ Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ Update failed');
    } finally {
      setSaving(false);
    }
  };

  const getLevelColor = (level: string) => {
    if (level === 'Expert') return '#22c55e';
    if (level === 'Intermediate') return '#f59e0b';
    return '#64748b';
  };

  const getProfileCompletion = () => {
    const checks = [
      !!form.name, !!form.bio, skills.length > 0,
      !!form.github_url, !!form.linkedin_url,
      experience.length > 0, projects.length > 0,
      !!form.avatar_url, !!form.resume_url,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  };

  const completion = getProfileCompletion();

  const tabs = [
    { id: 'basic', label: '👤 Basic' },
    { id: 'skills', label: '🎯 Skills' },
    { id: 'experience', label: '💼 Experience' },
    { id: 'projects', label: '🚀 Projects' },
    { id: 'links', label: '🔗 Links' },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', padding: '32px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px' }}>⚙️ Profile Settings</h1>
            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
              LinkedIn-level profile for SkillNest
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: saving ? '#334155' : '#22c55e', color: 'white', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
            {saving ? 'Saving...' : '💾 Save Profile'}
          </button>
        </div>

        {message && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', background: message.includes('✅') ? '#22c55e22' : '#ef444422', border: `1px solid ${message.includes('✅') ? '#22c55e' : '#ef4444'}`, color: message.includes('✅') ? '#22c55e' : '#ef4444', marginBottom: '16px', fontSize: '14px' }}>
            {message}
          </div>
        )}

        {/* Profile Completion */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Profile Completion</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: completion >= 80 ? '#22c55e' : completion >= 50 ? '#f59e0b' : '#38bdf8' }}>{completion}%</span>
          </div>
          <div style={{ background: '#0f172a', borderRadius: '99px', height: '6px' }}>
            <div style={{ height: '100%', borderRadius: '99px', width: `${completion}%`, background: completion >= 80 ? '#22c55e' : completion >= 50 ? '#f59e0b' : '#38bdf8', transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* Avatar + Name preview */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ position: 'relative' }}>
            <div onClick={() => avatarRef.current?.click()}
              style={{ width: 80, height: 80, borderRadius: '50%', background: avatarPreview ? 'transparent' : 'linear-gradient(135deg, #38bdf8, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', border: '2px solid #334155' }}>
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 28, fontWeight: 'bold' }}>{form.name?.[0]?.toUpperCase() || '?'}</span>
              }
            </div>
            <div onClick={() => avatarRef.current?.click()}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>
              📷
            </div>
            <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>{form.name || 'Your Name'}</div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>{form.bio || 'Add a bio...'}</div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{user?.email}</div>
          </div>
          <div>
            <button onClick={() => resumeRef.current?.click()}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: resumeName ? '#22c55e' : '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>
              📄 {resumeName || 'Upload Resume'}
            </button>
            <input ref={resumeRef} type="file" accept=".pdf" onChange={handleResumeChange} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#1e293b', padding: '4px', borderRadius: '10px' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: activeTab === tab.id ? '#0f172a' : 'transparent', color: activeTab === tab.id ? 'white' : '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: activeTab === tab.id ? '600' : '400' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>

          {/* BASIC TAB */}
          {activeTab === 'basic' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Your full name" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Bio</label>
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} style={{ ...inputStyle, height: '100px', resize: 'vertical' as const }} placeholder="Tell people about yourself..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} placeholder="Mumbai, India" />
                </div>
                <div>
                  <label style={labelStyle}>Domain</label>
                  <select value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Select Domain</option>
                    {['Web Dev', 'Data Science', 'DevOps', 'Mobile', 'Design', 'AI/ML', 'Cybersecurity'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Experience Level</label>
                <select value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select Level</option>
                  {['Beginner', 'Intermediate', 'Expert'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={labelStyle}>Public Profile</label>
                <div onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
                  style={{ width: 44, height: 24, borderRadius: '99px', background: form.is_public ? '#22c55e' : '#334155', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: form.is_public ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </div>
                <span style={{ color: '#64748b', fontSize: '13px' }}>{form.is_public ? 'Visible to everyone' : 'Only connections'}</span>
              </div>
            </div>
          )}

          {/* SKILLS TAB */}
          {activeTab === 'skills' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input value={newSkill} onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSkill()}
                  style={{ ...inputStyle, margin: 0, flex: 1 }} placeholder="Add a skill (e.g. React, AWS)..." />
                <button onClick={addSkill}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: '600', cursor: 'pointer' }}>
                  + Add
                </button>
              </div>

              {skills.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>No skills yet. Add your first skill above!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {skills.map((skill, i) => (
                    <div key={`skill-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#0f172a', borderRadius: '8px' }}>
                      <span style={{ flex: 1, fontWeight: '500' }}>{skill}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {SKILL_LEVELS.map(level => (
                          <button key={level} onClick={() => setSkillLevels(sl => ({ ...sl, [skill]: level }))}
                            style={{ padding: '4px 10px', borderRadius: '20px', border: `1px solid ${skillLevels[skill] === level ? getLevelColor(level) : '#334155'}`, background: skillLevels[skill] === level ? `${getLevelColor(level)}22` : 'transparent', color: skillLevels[skill] === level ? getLevelColor(level) : '#64748b', cursor: 'pointer', fontSize: '11px', fontWeight: '500' }}>
                            {level}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => removeSkill(skill)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EXPERIENCE TAB */}
          {activeTab === 'experience' && (
            <div>
              <button onClick={addExperience}
                style={{ marginBottom: '16px', padding: '8px 20px', borderRadius: '8px', border: '1px dashed #334155', background: 'transparent', color: '#38bdf8', cursor: 'pointer', fontSize: '13px', width: '100%' }}>
                + Add Experience
              </button>
              {experience.length === 0 && (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>No experience added yet.</div>
              )}
              {experience.map((exp, i) => (
                <div key={`exp-${i}`} style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '12px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>Experience {i + 1}</span>
                    <button onClick={() => removeExperience(i)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' }}>×</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={labelStyle}>Company</label>
                      <input value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} style={inputStyle} placeholder="Google, AWS..." />
                    </div>
                    <div>
                      <label style={labelStyle}>Role</label>
                      <input value={exp.role} onChange={e => updateExperience(i, 'role', e.target.value)} style={inputStyle} placeholder="DevOps Engineer..." />
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Duration</label>
                    <input value={exp.duration} onChange={e => updateExperience(i, 'duration', e.target.value)} style={inputStyle} placeholder="Jan 2023 - Present" />
                  </div>
                  <div>
                    <label style={labelStyle}>Description</label>
                    <textarea value={exp.description} onChange={e => updateExperience(i, 'description', e.target.value)} style={{ ...inputStyle, height: '70px', resize: 'vertical' as const }} placeholder="What did you do?" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PROJECTS TAB */}
          {activeTab === 'projects' && (
            <div>
              <button onClick={addProject}
                style={{ marginBottom: '16px', padding: '8px 20px', borderRadius: '8px', border: '1px dashed #334155', background: 'transparent', color: '#38bdf8', cursor: 'pointer', fontSize: '13px', width: '100%' }}>
                + Add Project
              </button>
              {projects.length === 0 && (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>No projects added yet.</div>
              )}
              {projects.map((proj, i) => (
                <div key={`proj-${i}`} style={{ background: '#0f172a', borderRadius: '10px', padding: '16px', marginBottom: '12px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>Project {i + 1}</span>
                    <button onClick={() => removeProject(i)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' }}>×</button>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Project Title</label>
                    <input value={proj.title} onChange={e => updateProject(i, 'title', e.target.value)} style={inputStyle} placeholder="SkillNest, K8s Dashboard..." />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Tech Stack</label>
                    <input value={proj.tech} onChange={e => updateProject(i, 'tech', e.target.value)} style={inputStyle} placeholder="React, Node.js, Docker..." />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={labelStyle}>Description</label>
                    <textarea value={proj.description} onChange={e => updateProject(i, 'description', e.target.value)} style={{ ...inputStyle, height: '70px', resize: 'vertical' as const }} placeholder="What does this project do?" />
                  </div>
                  <div>
                    <label style={labelStyle}>Project Link</label>
                    <input value={proj.link} onChange={e => updateProject(i, 'link', e.target.value)} style={inputStyle} placeholder="https://github.com/..." />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LINKS TAB */}
          {activeTab === 'links' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>🐙 GitHub URL</label>
                <input value={form.github_url} onChange={e => setForm(f => ({ ...f, github_url: e.target.value }))}
                  style={inputStyle} placeholder="https://github.com/username" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>💼 LinkedIn URL</label>
                <input value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))}
                  style={inputStyle} placeholder="https://linkedin.com/in/username" />
              </div>

              {/* Preview */}
              {(form.github_url || form.linkedin_url) && (
                <div style={{ marginTop: '20px', padding: '16px', background: '#0f172a', borderRadius: '10px' }}>
                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '10px' }}>Preview</div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {form.github_url && (
                      <a href={form.github_url} target="_blank" rel="noreferrer"
                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', color: 'white', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🐙 GitHub
                      </a>
                    )}
                    {form.linkedin_url && (
                      <a href={form.linkedin_url} target="_blank" rel="noreferrer"
                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #0077b5', color: '#0077b5', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        💼 LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save Button Bottom */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '12px 32px', borderRadius: '10px', border: 'none', background: saving ? '#334155' : '#22c55e', color: 'white', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '15px' }}>
            {saving ? 'Saving...' : '💾 Save Profile'}
          </button>
        </div>

      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: '#64748b',
  fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em'
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #334155', background: '#0f172a',
  color: 'white', fontSize: '14px', outline: 'none',
  boxSizing: 'border-box', marginBottom: '0'
};

