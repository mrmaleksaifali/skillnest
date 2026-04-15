const express = require('express');
const router = express.Router();
const pool = require('../db.js');

async function checkAndCleanExisting(sender_id, receiver_id) {
  const existing = await pool.query(
    "SELECT id, status FROM connections WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)",
    [sender_id, receiver_id]
  );
  if (existing.rows.length > 0) {
    const status = existing.rows[0].status;
    if (status === 'pending' || status === 'accepted') return false;
    await pool.query('DELETE FROM connections WHERE id=$1', [existing.rows[0].id]);
  }
  return true;
}

router.post('/send', async (req, res) => {
  try {
    const sender_id = req.headers['x-user-sub'];
    const { receiver_id } = req.body;
    if (!sender_id || !receiver_id) return res.status(400).json({ error: 'sender_id and receiver_id required' });
    const canSend = await checkAndCleanExisting(sender_id, receiver_id);
    if (!canSend) return res.json({ message: 'Request already exists' });
    await pool.query('INSERT INTO connections (sender_id, receiver_id, status) VALUES ($1, $2, $3)', [sender_id, receiver_id, 'pending']);
    res.json({ message: 'Request sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/request', async (req, res) => {
  try {
    const sender_id = req.headers['x-user-sub'];
    const { receiver_id } = req.body;
    if (!sender_id || !receiver_id) return res.status(400).json({ error: 'sender_id and receiver_id required' });
    const canSend = await checkAndCleanExisting(sender_id, receiver_id);
    if (!canSend) return res.json({ message: 'Request already exists' });
    await pool.query('INSERT INTO connections (sender_id, receiver_id, status) VALUES ($1, $2, $3)', [sender_id, receiver_id, 'pending']);
    res.json({ message: 'Request sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/accept', async (req, res) => {
  try {
    const receiver_id = req.headers['x-user-sub'];
    const { sender_id } = req.body;
    await pool.query('UPDATE connections SET status=$1 WHERE sender_id=$2 AND receiver_id=$3', ['accepted', sender_id, receiver_id]);
    res.json({ message: 'Request accepted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/reject', async (req, res) => {
  try {
    const receiver_id = req.headers['x-user-sub'];
    const { sender_id } = req.body;
    await pool.query('UPDATE connections SET status=$1 WHERE sender_id=$2 AND receiver_id=$3', ['rejected', sender_id, receiver_id]);
    res.json({ message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const user_id = req.headers['x-user-sub'];
    const result = await pool.query('SELECT * FROM connections WHERE sender_id=$1 OR receiver_id=$1', [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const user_id = req.headers['x-user-sub'];
    const result = await pool.query(
      `SELECT c.id, c.sender_id as requester_id, c.receiver_id, c.status, c.created_at
       FROM connections c WHERE c.sender_id=$1 OR c.receiver_id=$1`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const user_id = req.headers['x-user-sub'];
    const result = await pool.query("SELECT * FROM connections WHERE receiver_id=$1 AND status='pending'", [user_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/connected', async (req, res) => {
  try {
    const user_id = req.headers['x-user-sub'];
    const result = await pool.query(
      `SELECT CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END as connected_user_id, status, created_at
       FROM connections WHERE (sender_id=$1 OR receiver_id=$1) AND status='accepted'`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
