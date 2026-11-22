// 교사 비밀번호 재설정 (서버 관리자가 실행): npm run reset-teacher -- <아이디> <새비밀번호>
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
const [username, pw] = process.argv.slice(2);
if (!username || !pw || pw.length < 8) { console.log('사용법: npm run reset-teacher -- <아이디> <새 비밀번호(8자 이상)>'); process.exit(1); }
const db = new DatabaseSync(process.env.DATABASE_PATH || path.resolve('data/graph-lab.sqlite'));
const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
const r = db.prepare('UPDATE teachers SET pw_hash = ? WHERE username = ?').run(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`, username.toLowerCase());
if (!r.changes) { console.log('그 아이디의 교사를 찾지 못했어요.'); process.exit(1); }
db.prepare("DELETE FROM sessions WHERE role = 'teacher' AND user_id = (SELECT id FROM teachers WHERE username = ?)").run(username.toLowerCase());
console.log(`${username} 선생님의 비밀번호를 바꾸었어요.`);
