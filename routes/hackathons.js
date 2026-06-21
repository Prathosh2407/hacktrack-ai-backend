const express = require('express');
const auth = require('../middleware/auth');
const { scheduleRemindersForHackathon } = require('../services/reminderService');

const router = express.Router();

function parseHackathon(row) {
  return {
    ...row,
    team_members: JSON.parse(row.team_members || '[]'),
  };
}

router.get('/', auth, (req, res) => {
  const db = req.app.locals.db;
  const rows = db
    .prepare('SELECT * FROM hackathons WHERE user_id = ? ORDER BY registration_deadline ASC')
    .all(req.user.id);
  res.json(rows.map(parseHackathon));
});

router.get('/upcoming', auth, (req, res) => {
  const db = req.app.locals.db;
  const today = new Date().toISOString().split('T')[0];
  const rows = db
    .prepare(
      `SELECT * FROM hackathons
       WHERE user_id = ? AND registration_deadline >= ?
       ORDER BY registration_deadline ASC`
    )
    .all(req.user.id, today);
  res.json(rows.map(parseHackathon));
});

router.get('/registered', auth, (req, res) => {
  const db = req.app.locals.db;
  const rows = db
    .prepare(
      `SELECT * FROM hackathons
       WHERE user_id = ? AND status IN ('registered', 'submitted', 'completed')
       ORDER BY event_date ASC`
    )
    .all(req.user.id);
  res.json(rows.map(parseHackathon));
});

router.get('/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const row = db
    .prepare('SELECT * FROM hackathons WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Hackathon not found' });
  res.json(parseHackathon(row));
});

router.post('/', auth, (req, res) => {
  const db = req.app.locals.db;
  const { name, registration_deadline, event_date, team_members, status } = req.body;

  if (!name || !registration_deadline || !event_date) {
    return res.status(400).json({ error: 'Name, registration deadline, and event date are required' });
  }

  const members = Array.isArray(team_members) ? team_members : [];
  const result = db
    .prepare(
      `INSERT INTO hackathons (user_id, name, registration_deadline, event_date, team_members, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      name,
      registration_deadline,
      event_date,
      JSON.stringify(members),
      status || 'planning'
    );

  const hackathon = parseHackathon(
    db.prepare('SELECT * FROM hackathons WHERE id = ?').get(result.lastInsertRowid)
  );

  scheduleRemindersForHackathon(db, hackathon, req.user.id);

  res.status(201).json(hackathon);
});

router.put('/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const existing = db
    .prepare('SELECT * FROM hackathons WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Hackathon not found' });

  const { name, registration_deadline, event_date, team_members, status } = req.body;
  const members = team_members !== undefined ? team_members : JSON.parse(existing.team_members || '[]');

  db.prepare(
    `UPDATE hackathons SET
      name = ?, registration_deadline = ?, event_date = ?,
      team_members = ?, status = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    name ?? existing.name,
    registration_deadline ?? existing.registration_deadline,
    event_date ?? existing.event_date,
    JSON.stringify(Array.isArray(members) ? members : []),
    status ?? existing.status,
    req.params.id,
    req.user.id
  );

  const hackathon = parseHackathon(
    db.prepare('SELECT * FROM hackathons WHERE id = ?').get(req.params.id)
  );

  db.prepare('DELETE FROM reminders WHERE hackathon_id = ?').run(req.params.id);
  scheduleRemindersForHackathon(db, hackathon, req.user.id);

  res.json(hackathon);
});

router.delete('/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const result = db
    .prepare('DELETE FROM hackathons WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Hackathon not found' });
  res.json({ message: 'Hackathon deleted' });
});

module.exports = router;
