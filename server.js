require('dotenv').config();

const dbReady = require('./database');

const authRoutes = require('./routes/auth');
const hackathonRoutes = require('./routes/hackathons');
const internshipRoutes = require('./routes/internships');
const taskRoutes = require('./routes/tasks');
const reminderRoutes = require('./routes/reminders');
const auth = require('./middleware/auth');
const { startReminderCron } = require('./services/reminderService');

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'HackTrack AI' });
});

dbReady.then((db) => {
  app.locals.db = db;

  app.use('/api/auth', authRoutes);
  app.use('/api/hackathons', hackathonRoutes);
  app.use('/api/internships', internshipRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/reminders', reminderRoutes);

  app.get('/api/calendar', auth, (req, res) => {
    const { month, year } = req.query;
    const y = parseInt(year, 10) || new Date().getFullYear();
    const m = parseInt(month, 10) || new Date().getMonth() + 1;
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const endMonth = m === 12 ? 1 : m + 1;
    const endYear = m === 12 ? y + 1 : y;
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const hackathons = db
      .prepare(
        `SELECT id, name, registration_deadline, event_date, status, 'hackathon_deadline' as type
         FROM hackathons WHERE user_id = ? AND registration_deadline >= ? AND registration_deadline < ?`
      )
      .all(req.user.id, start, end);

    const events = db
      .prepare(
        `SELECT id, name, registration_deadline, event_date, status, 'hackathon_event' as type
         FROM hackathons WHERE user_id = ? AND event_date >= ? AND event_date < ?`
      )
      .all(req.user.id, start, end);

    const internships = db
      .prepare(
        `SELECT id, company as name, role, applied_date as date, status, 'internship' as type
         FROM internships WHERE user_id = ? AND applied_date >= ? AND applied_date < ?`
      )
      .all(req.user.id, start, end);

    const tasks = db
      .prepare(
        `SELECT id, title as name, due_date as date, completed, 'task' as type
         FROM daily_tasks WHERE user_id = ? AND due_date >= ? AND due_date < ?`
      )
      .all(req.user.id, start, end);

    res.json({ hackathons, events, internships, tasks });
  });

  app.get('/api/dashboard', auth, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const upcoming = db
      .prepare(
        `SELECT * FROM hackathons WHERE user_id = ? AND registration_deadline >= ?
         ORDER BY registration_deadline ASC LIMIT 5`
      )
      .all(req.user.id, today);

    const registered = db
      .prepare(
        `SELECT * FROM hackathons WHERE user_id = ? AND status IN ('registered', 'submitted', 'completed')
         ORDER BY event_date ASC LIMIT 5`
      )
      .all(req.user.id);

    const internships = db
      .prepare('SELECT * FROM internships WHERE user_id = ? ORDER BY applied_date DESC LIMIT 5')
      .all(req.user.id);

    const tasks = db
      .prepare(
        `SELECT * FROM daily_tasks WHERE user_id = ? AND due_date = ?
         ORDER BY completed ASC, id ASC`
      )
      .all(req.user.id, today);

    const reminders = db
      .prepare(
        `SELECT r.*, h.name as hackathon_name FROM reminders r
         JOIN hackathons h ON h.id = r.hackathon_id
         WHERE r.user_id = ? AND r.sent = 1 AND r.read_status = 0
         ORDER BY r.trigger_date DESC LIMIT 10`
      )
      .all(req.user.id);

    const parseHackathon = (row) => ({ ...row, team_members: JSON.parse(row.team_members || '[]') });

    res.json({
      upcoming: upcoming.map(parseHackathon),
      registered: registered.map(parseHackathon),
      internships,
      tasks: tasks.map((t) => ({ ...t, completed: !!t.completed })),
      reminders,
    });
  });

  startReminderCron(cron, db);

  app.listen(PORT, () => {
    console.log(`HackTrack AI backend running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
