import { createClient } from '@libsql/client';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf-8');
let url, token;
for (const line of envText.split(/\r?\n/)) {
  const [k, ...v] = line.trim().split('=');
  if (k === 'TURSO_DATABASE_URL') url = v.join('=').trim();
  if (k === 'TURSO_AUTH_TOKEN') token = v.join('=').trim();
}
const client = createClient({ url, authToken: token });

async function checkUsers() {
  const [users, p, h, l, e, c] = await Promise.all([
    client.execute("SELECT id, username FROM users"),
    client.execute("SELECT user_id, COUNT(1) as cnt FROM pronunciation_evaluations GROUP BY user_id"),
    client.execute("SELECT user_id, COUNT(1) as cnt FROM hanzi_writing_attempts GROUP BY user_id"),
    client.execute("SELECT user_id, COUNT(1) as cnt FROM lesson_completions GROUP BY user_id"),
    client.execute("SELECT user_id, COUNT(1) as cnt FROM exam_attempts GROUP BY user_id"),
    client.execute("SELECT user_id, COUNT(1) as cnt FROM chatbot_sessions GROUP BY user_id")
  ]);

  const userMap = Object.fromEntries(users.rows.map(u => [String(u.id), u.username]));
  console.log("Users Map:", userMap);
  console.log("Pronunciation:", p.rows.map(r => ({ user: userMap[r.user_id] || r.user_id, count: r.cnt })));
  console.log("Hanzi Writing:", h.rows.map(r => ({ user: userMap[r.user_id] || r.user_id, count: r.cnt })));
  console.log("Lesson Completions:", l.rows.map(r => ({ user: userMap[r.user_id] || r.user_id, count: r.cnt })));
  console.log("Exams:", e.rows);
  console.log("Chatbot:", c.rows);
}
checkUsers();

