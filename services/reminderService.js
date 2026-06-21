const REMINDER_DAYS = [7, 3, 1];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function scheduleRemindersForHackathon(db, hackathon, userId) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO reminders (user_id, hackathon_id, reminder_type, message, trigger_date, sent)
     VALUES (?, ?, ?, ?, ?, 0)`
  );

  for (const days of REMINDER_DAYS) {
    const triggerDate = addDays(hackathon.registration_deadline, days);
    const message = `${days}-day reminder: "${hackathon.name}" registration deadline is on ${hackathon.registration_deadline}`;
    insert.run(userId, hackathon.id, `${days}day`, message, triggerDate);
  }
}

function processReminders(db) {
  const today = new Date().toISOString().split('T')[0];
  const due = db
    .prepare('SELECT * FROM reminders WHERE sent = 0 AND trigger_date <= ?')
    .all(today);

  const markSent = db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?');

  for (const reminder of due) {
    markSent.run(reminder.id);
    console.log(`[Reminder] User ${reminder.user_id}: ${reminder.message}`);
  }

  return due.length;
}

function startReminderCron(cron, db) {
  cron.schedule('0 8 * * *', () => {
    const count = processReminders(db);
    if (count > 0) console.log(`Processed ${count} reminder(s)`);
  });

  processReminders(db);
}

module.exports = {
  scheduleRemindersForHackathon,
  processReminders,
  startReminderCron,
};
