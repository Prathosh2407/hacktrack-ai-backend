const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const db = req.app.locals.db;
  const rows = db
    .prepare(
      `SELECT r.*, h.name as hackathon_name
       FROM reminders r
       JOIN hackathons h ON h.id = r.hackathon_id
       WHERE r.user_id = ?
       ORDER BY r.trigger_date DESC, r.id DESC`
    )
    .all(req.user.id);
  res.json(rows.map((r) => ({ ...r, sent: !!r.sent, read_status: !!r.read_status })));
});

router.get('/unread', auth, (req, res) => {
  const db = req.app.locals.db;
  const rows = db
    .prepare(
      `SELECT r.*, h.name as hackathon_name
       FROM reminders r
       JOIN hackathons h ON h.id = r.hackathon_id
       WHERE r.user_id = ? AND r.sent = 1 AND r.read_status = 0
       ORDER BY r.trigger_date DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

router.patch('/:id/read', auth, (req, res) => {
  const db = req.app.locals.db;
  const result = db
    .prepare('UPDATE reminders SET read_status = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Reminder not found' });
  res.json({ message: 'Marked as read' });
});

router.patch('/read-all', auth, (req, res) => {
  const db = req.app.locals.db;
  db.prepare('UPDATE reminders SET read_status = 1 WHERE user_id = ? AND sent = 1').run(req.user.id);
  res.json({ message: 'All reminders marked as read' });
});

module.exports = router;
