const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(express.json());
app.use(cors());

/* =========================
   TEST ROUTE
========================= */
app.get("/", (req, res) => {
  res.send("SkillNest API Running");
});

/* =========================
   DB TEST
========================= */
app.get("/testdb", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows);
});

/* =========================
   REGISTER
========================= */
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashedPassword]
    );

    res.send("User registered successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error registering user");
  }
});

/* =========================
   LOGIN (JWT)
========================= */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).send("User not found");
    }

    const validPassword = await bcrypt.compare(
      password,
      user.rows[0].password
    );

    if (!validPassword) {
      return res.status(400).send("Invalid password");
    }

    const token = jwt.sign(
      { id: user.rows[0].id },
      "secretkey",
      { expiresIn: "1h" }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).send("Login error");
  }
});

/* =========================
   AUTH MIDDLEWARE
========================= */
const auth = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) return res.status(401).send("Access denied");

  try {
    const verified = jwt.verify(token, "secretkey");
    req.user = verified;
    next();
  } catch {
    res.status(400).send("Invalid token");
  }
};

/* =========================
   PROFILE (PROTECTED)
========================= */
app.get("/profile", auth, (req, res) => {
  res.send(`Welcome user ${req.user.id}`);
});

/* =========================
   ADD SKILL
========================= */
app.post("/add-skill", auth, async (req, res) => {
  try {
    const { skill_name } = req.body;

    await pool.query(
      "INSERT INTO skills (user_id, skill_name) VALUES ($1, $2)",
      [req.user.id, skill_name]
    );

    res.send("Skill added");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding skill");
  }
});

/* =========================
   GET ALL SKILLS
========================= */
app.get("/skills", async (req, res) => {
  try {
    const skills = await pool.query(`
      SELECT skills.id, skills.skill_name, users.name 
      FROM skills 
      JOIN users ON skills.user_id = users.id
    `);

    res.json(skills.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching skills");
  }
});

/* =========================
   SEND REQUEST
========================= */
app.post("/request", auth, async (req, res) => {
  try {
    const { receiver_id, skill_id } = req.body;

    await pool.query(
      "INSERT INTO requests (sender_id, receiver_id, skill_id) VALUES ($1, $2, $3)",
      [req.user.id, receiver_id, skill_id]
    );

    res.send("Request sent");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending request");
  }
});

/* =========================
   VIEW MY REQUESTS
========================= */
app.get("/my-requests", auth, async (req, res) => {
  try {
    const requests = await pool.query(
      "SELECT * FROM requests WHERE sender_id=$1",
      [req.user.id]
    );

    res.json(requests.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching requests");
  }
});

/* =========================
   SERVER START
========================= */
app.listen(3000, () => {
  console.log("Server running on port 3000");
});