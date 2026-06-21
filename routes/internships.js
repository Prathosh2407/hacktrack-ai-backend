const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const db = req.app.locals.db;
  const rows = db
    .prepare('SELECT * FROM internships WHERE user_id = ? ORDER BY applied_date DESC')
    .all(req.user.id);
  res.json(rows);
});

router.post('/', auth, (req, res) => {
  const db = req.app.locals.db;
  const { company, role, applied_date, status } = req.body;

  if (!company || !role || !applied_date) {
    return res.status(400).json({ error: 'Company, role, and applied date are required' });
  }

  const result = db
    .prepare(
      `INSERT INTO internships (user_id, company, role, applied_date, status)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(req.user.id, company, role, applied_date, status || 'applied');

  const internship = db.prepare('SELECT * FROM internships WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(internship);
});

router.put('/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const existing = db
    .prepare('SELECT * FROM internships WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Internship not found' });

  const { company, role, applied_date, status } = req.body;

  db.prepare(
    `UPDATE internships SET company = ?, role = ?, applied_date = ?, status = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    company ?? existing.company,
    role ?? existing.role,
    applied_date ?? existing.applied_date,
    status ?? existing.status,
    req.params.id,
    req.user.id
  );

  const internship = db.prepare('SELECT * FROM internships WHERE id = ?').get(req.params.id);
  res.json(internship);
});

router.delete('/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const result = db
    .prepare('DELETE FROM internships WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Internship not found' });
  res.json({ message: 'Internship deleted' });
});

module.exports = router;
