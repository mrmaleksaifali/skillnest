const express = require('express');
const router = express.Router();
const pool = require('../db.js');

// ✅ FOLLOW USER
router.post('/follow', async (req, res) => {
  try {
    const follower_id = req.headers['x-user-sub'];
    const { following_id } = req.body;

    console.log("🔥 FOLLOW:", follower_id, "->", following_id);

    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [follower_id, following_id]
    );

    res.json({ message: 'Followed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Follow failed' });
  }
});

// ✅ UNFOLLOW USER
router.delete('/unfollow', async (req, res) => {
  try {
    const follower_id = req.headers['x-user-sub'];
    const following_id = req.body?.following_id;

    await pool.query(
      'DELETE FROM follows WHERE follower_id=$1 AND following_id=$2',
      [follower_id, following_id]
    );

    res.json({ message: 'Unfollowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unfollow failed' });
  }
});

// ✅ UNFOLLOW USER (POST alias for clients that don't support DELETE with body)
router.post('/unfollow', async (req, res) => {
  try {
    const follower_id = req.headers['x-user-sub'];
    const following_id = req.body?.following_id;

    await pool.query(
      'DELETE FROM follows WHERE follower_id=$1 AND following_id=$2',
      [follower_id, following_id]
    );

    res.json({ message: 'Unfollowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unfollow failed' });
  }
});

// ✅ GET FOLLOWING LIST (who I follow)
router.get('/following', async (req, res) => {
  try {
    const follower_id = req.headers['x-user-sub'];

    const result = await pool.query(
      'SELECT following_id FROM follows WHERE follower_id=$1',
      [follower_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// ✅ GET FOLLOWERS LIST (who follows me) — NEW
router.get('/followers', async (req, res) => {
  try {
    const following_id = req.headers['x-user-sub'];

    const result = await pool.query(
      'SELECT follower_id FROM follows WHERE following_id=$1',
      [following_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// ✅ GET FOLLOWER COUNT FOR ANY USER — NEW
router.get('/count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const followersRes = await pool.query(
      'SELECT COUNT(*) FROM follows WHERE following_id=$1',
      [userId]
    );
    const followingRes = await pool.query(
      'SELECT COUNT(*) FROM follows WHERE follower_id=$1',
      [userId]
    );

    res.json({
      followers: parseInt(followersRes.rows[0].count),
      following: parseInt(followingRes.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch follow counts' });
  }
});

// ✅ STATUS CHECK — am I following this user?
router.get('/status/:userId', async (req, res) => {
  try {
    const follower_id = req.headers['x-user-sub'];
    const { userId } = req.params;

    const result = await pool.query(
      'SELECT id FROM follows WHERE follower_id=$1 AND following_id=$2',
      [follower_id, userId]
    );

    res.json({ isFollowing: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;