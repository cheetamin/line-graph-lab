// 데이터베이스 구조 (SQLite). 서버(node:sqlite)와 체험판(sql.js)이 같은 SQL을 사용합니다.
export const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  settings TEXT NOT NULL DEFAULT '{}',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  pin_hash TEXT NOT NULL,
  weather_override INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(class_id, number)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  class_id INTEGER,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS student_state (
  student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS votes (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (class_id, student_id)
);
CREATE TABLE IF NOT EXISTS responses (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL,           -- value | unknown
  value REAL,
  source TEXT NOT NULL DEFAULT 'memory', -- record(실제 기록) | memory(기억 추정)
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, topic_id, month)
);
CREATE INDEX IF NOT EXISTS idx_resp_class_topic ON responses(class_id, topic_id);
CREATE TABLE IF NOT EXISTS submissions (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (student_id, topic_id)
);
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- weather | topic:<주제 번호>
  topic_id INTEGER,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft', -- draft | submitted | approved | rejected
  feedback TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  UNIQUE(student_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_works_class ON works(class_id, status);
CREATE TABLE IF NOT EXISTS surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  role TEXT NOT NULL,              -- student | teacher
  user_id INTEGER NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  UNIQUE(class_id, role, user_id)
);
`;
