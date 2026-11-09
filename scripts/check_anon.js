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

async function checkAnon() {
  const [p, h, l, e, c] = await Promise.all([
    client.execute("SELECT COUNT(1) as c FROM pronunciation_evaluations WHERE user_id = 'anonymous'"),
    client.execute("SELECT COUNT(1) as c FROM hanzi_writing_attempts WHERE user_id = 'anonymous'"),
    client.execute("SELECT COUNT(1) as c FROM lesson_completions WHERE user_id = 'anonymous'"),
    client.execute("SELECT COUNT(1) as c FROM exam_attempts WHERE user_id = 'anonymous'"),
    client.execute("SELECT COUNT(1) as c FROM chatbot_sessions WHERE user_id = 'anonymous'")
  ]);
  console.log({
    pEvalsAnon: p.rows[0].c,
    hanziAnon: h.rows[0].c,
    lessonAnon: l.rows[0].c,
    examAnon: e.rows[0].c,
    chatAnon: c.rows[0].c
  });
}
checkAnon();
