const express = require('express');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data/questions.js', express.static(path.join(DATA_DIR, 'questions.js')));

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const sessions = new Map();

function seedIfEmpty() {
  const users = loadJson(USERS_FILE, []);
  if (users.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    users.push({
      id: 'demo-1',
      username: 'demo',
      fullName: 'Дэмо Хэрэглэгч',
      passwordHash: bcrypt.hashSync('demo123', salt),
      createdAt: new Date().toISOString()
    });
    users.push({
      id: 'admin-1',
      username: 'admin',
      fullName: 'Админ Хэрэглэгч',
      passwordHash: bcrypt.hashSync('admin123', salt),
      createdAt: new Date().toISOString()
    });
    saveJson(USERS_FILE, users);
  }
  if (!fs.existsSync(RESULTS_FILE)) saveJson(RESULTS_FILE, []);
}
seedIfEmpty();

function authRequired(req, res, next) {
  const token = req.cookies.session;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Нэвтрэх шаардлагатай' });
  }
  req.user = sessions.get(token);
  next();
}

app.post('/api/register', (req, res) => {
  const { username, password, fullName } = req.body || {};
  if (!username || !password || !fullName) {
    return res.status(400).json({ error: 'Бүх талбарыг бөглөнө үү' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Хэрэглэгчийн нэр 3-аас дээш тэмдэгттэй байна' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Нууц үг 6-аас дээш тэмдэгттэй байна' });
  }
  const users = loadJson(USERS_FILE, []);
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: 'Ийм нэртэй хэрэглэгч бүртгэлтэй байна' });
  }
  const salt = bcrypt.genSaltSync(10);
  const user = {
    id: crypto.randomUUID(),
    username,
    fullName,
    passwordHash: bcrypt.hashSync(password, salt),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveJson(USERS_FILE, users);
  res.json({ ok: true, message: 'Амжилттай бүртгэгдлээ' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Хэрэглэгчийн нэр, нууц үгээ оруулна уу' });
  }
  const users = loadJson(USERS_FILE, []);
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Хэрэглэгчийн нэр эсвэл нууц үг буруу' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { id: user.id, username: user.username, fullName: user.fullName });
  res.cookie('session', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true, user: { username: user.username, fullName: user.fullName } });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies.session;
  if (token) sessions.delete(token);
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/api/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/results', authRequired, (req, res) => {
  const { section, total, correct, durationSec } = req.body || {};
  if (typeof total !== 'number' || typeof correct !== 'number') {
    return res.status(400).json({ error: 'Дүнгийн өгөгдөл дутуу' });
  }
  const results = loadJson(RESULTS_FILE, []);
  const record = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    username: req.user.username,
    section,
    total,
    correct,
    percentage: Math.round((correct / total) * 100),
    durationSec,
    createdAt: new Date().toISOString()
  };
  results.push(record);
  saveJson(RESULTS_FILE, results);
  res.json({ ok: true, record });
});

app.get('/api/results', authRequired, (req, res) => {
  const results = loadJson(RESULTS_FILE, []);
  const mine = results.filter(r => r.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ results: mine });
});

app.listen(PORT, () => {
  console.log(`Сорилын систем http://localhost:${PORT} дээр ажиллаж байна`);
});
