const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const db = req.app.locals.db;
  const { date } = req.query;
  let rows;

  if (date) {
    rows = db
      .prepare('SELECT * FROM daily_tasks WHERE user_id = ? AND due_date = ? ORDER BY completed ASC, id ASC')
      .all(req.user.id, date);
  } else {
    rows = db
      .prepare('SELECT * FROM daily_tasks WHERE user_id = ? ORDER BY due_date ASC, completed ASC')
      .all(req.user.id);
  }

  res.json(rows.map((r) => ({ ...r, completed: !!r.completed })));
});

router.post('/', auth, (req, res) => {
  const db = req.app.locals.db;
  const { title, description, due_date } = req.body;

  if (!title || !due_date) {
    return res.status(400).json({ error: 'Title and due date are required' });
  }

  const result = db
    .prepare(
      `INSERT INTO daily_tasks (user_id, title, description, due_date)
       VALUES (?, ?, ?, ?)`
    )
    .run(req.user.id, title, description || '', due_date);

  const task = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...task, completed: !!task.completed });
});

router.patch('/:id/toggle', auth, (req, res) => {
  const db = req.app.locals.db;
  const task = db
    .prepare('SELECT * FROM daily_tasks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const completed = task.completed ? 0 : 1;
  db.prepare('UPDATE daily_tasks SET completed = ? WHERE id = ?').run(completed, req.params.id);

  const updated = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(req.params.id);
  res.json({ ...updated, completed: !!updated.completed });
});

router.delete('/:id', auth, (req, res) => {
  const db = req.app.locals.db;
  const result = db
    .prepare('DELETE FROM daily_tasks WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ message: 'Task deleted' });
});

module.exports = router;
