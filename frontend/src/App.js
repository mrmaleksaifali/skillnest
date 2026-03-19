import React, { useState } from "react";
import axios from "axios";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [skill, setSkill] = useState("");
  const [skills, setSkills] = useState([]);

  // 🔐 LOGIN
  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:3000/login", {
        email,
        password,
      });

      setToken(res.data.token);
      setIsLoggedIn(true); // ✅ switch to dashboard
    } catch {
      alert("Login Failed ❌");
    }
  };

  // ➕ ADD SKILL
  const addSkill = async () => {
    try {
      await axios.post(
        "http://localhost:3000/add-skill",
        { skill_name: skill },
        {
          headers: { Authorization: token },
        }
      );
      alert("Skill added ✅");
      setSkill("");
    } catch {
      alert("Error ❌");
    }
  };

  // 👀 GET SKILLS
  const getSkills = async () => {
    const res = await axios.get("http://localhost:3000/skills");
    setSkills(res.data);
  };

  // 🔐 LOGIN PAGE
  if (!isLoggedIn) {
    return (
      <div className="container mt-5" style={{ maxWidth: "400px" }}>
        <div className="card shadow p-4">
          <h2 className="text-center mb-3">🔐 Login</h2>

          <input
            className="form-control mb-3"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="form-control mb-3"
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn btn-primary w-100" onClick={handleLogin}>
            Login
          </button>
        </div>
      </div>
    );
  }

  // 📊 DASHBOARD PAGE
  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">🚀 SkillNest Dashboard</h1>

      <div className="row">
        {/* ADD SKILL */}
        <div className="col-md-6">
          <div className="card shadow p-4">
            <h4>➕ Add Skill</h4>

            <input
              className="form-control mb-3"
              placeholder="Enter skill"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            />

            <button className="btn btn-success w-100" onClick={addSkill}>
              Add Skill
            </button>
          </div>
        </div>

        {/* VIEW SKILLS */}
        <div className="col-md-6">
          <div className="card shadow p-4">
            <h4>📚 All Skills</h4>

            <button className="btn btn-dark w-100 mb-3" onClick={getSkills}>
              Load Skills
            </button>

            <ul className="list-group">
              {skills.map((s) => (
                <li key={s.id} className="list-group-item">
                  {s.skill_name} - <b>{s.name}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* TOKEN */}
      <div className="card mt-4 p-3 shadow">
        <h6>🔐 Token</h6>
        <p style={{ fontSize: "12px", wordBreak: "break-all" }}>{token}</p>
      </div>
    </div>
  );
}

export default App;