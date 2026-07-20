// Мэдээлэл технологийн сорилын систем — offline APK client
// Fully client-side; users, sessions, and results stored in localStorage.

const app = document.getElementById('app');
const state = {
  user: null,
  section: null,
  quiz: null,
  history: []
};

// ---------- Storage helpers ----------
const STORAGE_USERS = 'itest.users';
const STORAGE_SESSION = 'itest.session';
const STORAGE_RESULTS = 'itest.results';

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_USERS)) || []; }
  catch { return []; }
}
function saveUsers(users) { localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }
function loadResults() {
  try { return JSON.parse(localStorage.getItem(STORAGE_RESULTS)) || []; }
  catch { return []; }
}
function saveResults(r) { localStorage.setItem(STORAGE_RESULTS, JSON.stringify(r)); }
function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_SESSION)) || null; }
  catch { return null; }
}
function saveSession(u) {
  if (u) localStorage.setItem(STORAGE_SESSION, JSON.stringify(u));
  else localStorage.removeItem(STORAGE_SESSION);
}

// Simple SHA-256 based password hashing (client-side; not intended for
// server-grade security — the app is offline and single-device).
async function hashPassword(pw) {
  const enc = new TextEncoder().encode('itest.salt.v1.' + pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function seedIfEmpty() {
  const users = loadUsers();
  if (users.length === 0) {
    users.push({
      id: 'demo-1',
      username: 'demo',
      fullName: 'Дэмо Хэрэглэгч',
      passwordHash: await hashPassword('demo123'),
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
  }
}

// ---------- DOM helpers ----------
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'onclick' || k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'className') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

function render(node) {
  app.innerHTML = '';
  app.appendChild(node);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- Views ----------

function loginView(mode = 'login', message = null) {
  const errorBox = h('div', { className: 'alert alert-error hidden' });
  const successBox = h('div', { className: 'alert alert-success hidden' });

  if (message) {
    successBox.textContent = message;
    successBox.classList.remove('hidden');
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
    successBox.classList.add('hidden');
  }

  async function handleLogin(e) {
    e.preventDefault();
    const username = e.target.username.value.trim();
    const password = e.target.password.value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Нэвтэрч байна...';
    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      showError('Хэрэглэгчийн нэр эсвэл нууц үг буруу');
      btn.disabled = false; btn.textContent = 'Нэвтрэх'; return;
    }
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) {
      showError('Хэрэглэгчийн нэр эсвэл нууц үг буруу');
      btn.disabled = false; btn.textContent = 'Нэвтрэх'; return;
    }
    const session = { id: user.id, username: user.username, fullName: user.fullName };
    saveSession(session);
    state.user = session;
    showDashboard();
  }

  async function handleRegister(e) {
    e.preventDefault();
    const fullName = e.target.fullName.value.trim();
    const username = e.target.username.value.trim();
    const password = e.target.password.value;
    const password2 = e.target.password2.value;
    if (password !== password2) { showError('Нууц үг таарахгүй байна'); return; }
    if (username.length < 3) { showError('Хэрэглэгчийн нэр 3-аас дээш тэмдэгттэй байна'); return; }
    if (password.length < 6) { showError('Нууц үг 6-аас дээш тэмдэгттэй байна'); return; }
    const users = loadUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      showError('Ийм нэртэй хэрэглэгч бүртгэлтэй байна'); return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Бүртгэж байна...';
    users.push({
      id: 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      username, fullName,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
    render(loginView('login', 'Амжилттай бүртгэгдлээ. Нэвтэрнэ үү.'));
  }

  const form = mode === 'login'
    ? h('form', { onsubmit: handleLogin },
        h('div', { className: 'form-group' },
          h('label', { for: 'username' }, 'Хэрэглэгчийн нэр'),
          h('input', { type: 'text', name: 'username', id: 'username', required: 'true', autocomplete: 'username' })
        ),
        h('div', { className: 'form-group' },
          h('label', { for: 'password' }, 'Нууц үг'),
          h('input', { type: 'password', name: 'password', id: 'password', required: 'true', autocomplete: 'current-password' })
        ),
        errorBox,
        successBox,
        h('button', { type: 'submit', className: 'btn btn-primary btn-block btn-lg' }, 'Нэвтрэх')
      )
    : h('form', { onsubmit: handleRegister },
        h('div', { className: 'form-group' },
          h('label', { for: 'fullName' }, 'Овог, нэр'),
          h('input', { type: 'text', name: 'fullName', id: 'fullName', required: 'true' })
        ),
        h('div', { className: 'form-group' },
          h('label', { for: 'username' }, 'Хэрэглэгчийн нэр'),
          h('input', { type: 'text', name: 'username', id: 'username', required: 'true', minlength: '3' })
        ),
        h('div', { className: 'form-group' },
          h('label', { for: 'password' }, 'Нууц үг (6+ тэмдэгт)'),
          h('input', { type: 'password', name: 'password', id: 'password', required: 'true', minlength: '6' })
        ),
        h('div', { className: 'form-group' },
          h('label', { for: 'password2' }, 'Нууц үг давтах'),
          h('input', { type: 'password', name: 'password2', id: 'password2', required: 'true', minlength: '6' })
        ),
        errorBox,
        successBox,
        h('button', { type: 'submit', className: 'btn btn-primary btn-block btn-lg' }, 'Бүртгүүлэх')
      );

  const toggle = mode === 'login'
    ? h('div', { className: 'auth-toggle' },
        'Шинэ хэрэглэгч үү? ',
        h('button', { className: 'link-btn', onclick: () => render(loginView('register')) }, 'Бүртгүүлэх')
      )
    : h('div', { className: 'auth-toggle' },
        'Бүртгэлтэй юу? ',
        h('button', { className: 'link-btn', onclick: () => render(loginView('login')) }, 'Нэвтрэх')
      );

  const demoHint = mode === 'login'
    ? h('div', { className: 'alert alert-info mt-4' }, 'Демо: demo / demo123')
    : null;

  return h('div', { className: 'center-page' },
    h('div', { className: 'card card-narrow' },
      h('div', { className: 'brand' },
        h('div', { className: 'brand-logo' }, 'МТ'),
        h('h2', {}, mode === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'),
        h('p', {}, 'Мэдээлэл технологийн сорилын систем')
      ),
      form,
      toggle,
      demoHint
    )
  );
}

function header() {
  function logout() {
    saveSession(null);
    state.user = null;
    state.section = null;
    state.quiz = null;
    render(loginView());
  }
  return h('header', { className: 'app-header' },
    h('div', {},
      h('h1', {}, 'Мэдээлэл технологийн сорил'),
      h('div', { className: 'subtitle' }, 'Төрийн албан хаагчийн мэдлэг шалгах систем')
    ),
    h('div', { className: 'user-badge' },
      h('div', {},
        h('div', { className: 'name' }, state.user.fullName),
        h('div', { style: 'font-size:12px;color:#64748b;' }, '@' + state.user.username)
      ),
      h('button', { className: 'btn btn-ghost', onclick: logout }, 'Гарах')
    )
  );
}

function showDashboard() {
  const allResults = loadResults();
  state.history = allResults.filter(r => r.userId === state.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const sections = Object.entries(QUESTIONS).map(([key, sec]) => {
    return h('div', { className: 'section-card', onclick: () => startQuiz(key) },
      h('h3', {}, sec.title),
      h('p', {}, sec.description),
      h('div', { className: 'meta' },
        h('span', {}, `${sec.questions.length} асуулт`),
        h('span', { className: 'badge' }, 'Эхлүүлэх')
      )
    );
  });

  const historyBlock = state.history.length > 0
    ? h('div', { className: 'card mt-6' },
        h('h3', { style: 'margin:0 0 16px;color:#0f172a;' }, 'Миний өмнөх дүн'),
        h('div', { className: 'history-list' },
          ...state.history.slice(0, 6).map(r => {
            const sec = QUESTIONS[r.section];
            const secTitle = sec ? sec.title : r.section;
            const pass = r.percentage >= 60;
            return h('div', { className: 'history-item' },
              h('div', { className: 'info' },
                h('div', { className: 'section-name' }, secTitle),
                h('div', { className: 'date' }, `${fmtDate(r.createdAt)}  ·  ${r.correct}/${r.total} · ${fmtTime(r.durationSec || 0)}`)
              ),
              h('div', { className: 'score ' + (pass ? 'pass' : 'fail') }, r.percentage + '%')
            );
          })
        )
      )
    : null;

  render(h('div', {},
    header(),
    h('div', { className: 'container' },
      h('div', { className: 'welcome' },
        h('h2', {}, `Сайн байна уу, ${state.user.fullName}!`),
        h('p', {}, 'Сорилын нэг бүлгийг сонгож эхлүүлнэ үү.')
      ),
      h('div', { className: 'section-grid' }, ...sections),
      historyBlock
    )
  ));
}

function startQuiz(sectionKey) {
  const sec = QUESTIONS[sectionKey];
  const questions = shuffle(sec.questions).map(q => {
    const indexed = q.options.map((opt, idx) => ({ opt, isCorrect: idx === q.answer }));
    const shuffled = shuffle(indexed);
    const newAnswer = shuffled.findIndex(x => x.isCorrect);
    return {
      q: q.q,
      options: shuffled.map(x => x.opt),
      answer: newAnswer
    };
  });

  state.section = sectionKey;
  state.quiz = {
    questions,
    current: 0,
    answers: new Array(questions.length).fill(null),
    startedAt: Date.now(),
    finished: false
  };
  renderQuiz();
}

function renderQuiz() {
  const q = state.quiz;
  const question = q.questions[q.current];
  const total = q.questions.length;
  const answered = q.answers.filter(a => a !== null).length;
  const progress = ((q.current + 1) / total) * 100;

  const elapsed = Math.floor((Date.now() - q.startedAt) / 1000);
  const timerEl = h('div', { className: 'timer', id: 'timer' }, fmtTime(elapsed));

  if (window._timerInterval) clearInterval(window._timerInterval);
  window._timerInterval = setInterval(() => {
    const el = document.getElementById('timer');
    if (!el) return clearInterval(window._timerInterval);
    const s = Math.floor((Date.now() - q.startedAt) / 1000);
    el.textContent = fmtTime(s);
  }, 1000);

  const optionEls = question.options.map((opt, idx) => {
    const letter = ['А', 'Б', 'В', 'Г'][idx] || String.fromCharCode(65 + idx);
    const isSelected = q.answers[q.current] === idx;
    return h('label', {
      className: 'option' + (isSelected ? ' selected' : ''),
      onclick: () => {
        q.answers[q.current] = idx;
        renderQuiz();
      }
    },
      h('input', { type: 'radio', name: 'opt', checked: isSelected ? 'true' : undefined }),
      h('span', { className: 'option-label' }, letter + '.'),
      h('span', { className: 'option-text' }, opt)
    );
  });

  const nav = h('div', { className: 'quiz-nav' },
    h('button', {
      className: 'btn btn-secondary',
      disabled: q.current === 0 ? 'true' : undefined,
      onclick: () => { q.current--; renderQuiz(); }
    }, '← Өмнөх'),
    q.current === total - 1
      ? h('button', { className: 'btn btn-primary', onclick: submitQuiz }, 'Сорилыг дуусгах')
      : h('button', {
          className: 'btn btn-primary',
          onclick: () => { q.current++; renderQuiz(); }
        }, 'Дараах →')
  );

  render(h('div', {},
    header(),
    h('div', { className: 'container' },
      h('div', { className: 'quiz-header' },
        h('h2', {}, QUESTIONS[state.section].title),
        h('div', { className: 'stats' },
          h('div', { className: 'stat' },
            h('div', { className: 'stat-value' }, `${q.current + 1}/${total}`),
            h('div', { className: 'stat-label' }, 'Асуулт')
          ),
          h('div', { className: 'stat' },
            h('div', { className: 'stat-value' }, `${answered}`),
            h('div', { className: 'stat-label' }, 'Хариулсан')
          ),
          timerEl
        )
      ),
      h('div', { className: 'progress-bar' },
        h('div', { className: 'progress-fill', style: `width: ${progress}%` })
      ),
      h('div', { className: 'question-card' },
        h('div', { className: 'question-number' }, `Асуулт №${q.current + 1}`),
        h('div', { className: 'question-text' }, question.q),
        h('div', { className: 'options' }, ...optionEls),
        nav
      )
    )
  ));
}

function submitQuiz() {
  const q = state.quiz;
  const unanswered = q.answers.filter(a => a === null).length;
  if (unanswered > 0) {
    if (!confirm(`${unanswered} асуултад хариулаагүй байна. Дуусгах уу?`)) return;
  }
  clearInterval(window._timerInterval);
  q.finished = true;
  const durationSec = Math.floor((Date.now() - q.startedAt) / 1000);
  let correct = 0;
  q.questions.forEach((question, i) => {
    if (q.answers[i] === question.answer) correct++;
  });
  q.correct = correct;
  q.durationSec = durationSec;

  const results = loadResults();
  results.push({
    id: 'r-' + Date.now(),
    userId: state.user.id,
    username: state.user.username,
    section: state.section,
    total: q.questions.length,
    correct,
    percentage: Math.round((correct / q.questions.length) * 100),
    durationSec,
    createdAt: new Date().toISOString()
  });
  saveResults(results);

  renderResult();
}

function renderResult() {
  const q = state.quiz;
  const total = q.questions.length;
  const pct = Math.round((q.correct / total) * 100);
  const pass = pct >= 60;
  const message = pct >= 90 ? 'Гайхалтай!' : pct >= 75 ? 'Сайн!' : pct >= 60 ? 'Тэнцлээ.' : 'Дахин оролдоно уу.';

  render(h('div', {},
    header(),
    h('div', { className: 'container' },
      h('div', { className: 'card' },
        h('div', { className: 'result-summary' },
          h('div', { className: 'result-label' }, message),
          h('div', { className: 'result-score ' + (pass ? '' : 'fail') }, pct + '%'),
          h('div', { style: 'color:#64748b;margin-top:8px;' }, `${QUESTIONS[state.section].title}`)
        ),
        h('div', { className: 'result-stats' },
          h('div', { className: 'result-stat' },
            h('div', { className: 'num', style: 'color:#16a34a;' }, q.correct),
            h('div', { className: 'lbl' }, 'Зөв')
          ),
          h('div', { className: 'result-stat' },
            h('div', { className: 'num', style: 'color:#dc2626;' }, total - q.correct),
            h('div', { className: 'lbl' }, 'Буруу')
          ),
          h('div', { className: 'result-stat' },
            h('div', { className: 'num' }, fmtTime(q.durationSec)),
            h('div', { className: 'lbl' }, 'Хугацаа')
          )
        ),
        h('div', { className: 'quiz-nav' },
          h('button', { className: 'btn btn-secondary', onclick: showDashboard }, 'Нүүр хуудас'),
          h('button', { className: 'btn btn-primary', onclick: showReview }, 'Хариулт харах')
        )
      )
    )
  ));
}

function showReview() {
  const q = state.quiz;
  const cards = q.questions.map((question, i) => {
    const userAns = q.answers[i];
    const correctIdx = question.answer;
    const optionEls = question.options.map((opt, idx) => {
      const letter = ['А', 'Б', 'В', 'Г'][idx] || String.fromCharCode(65 + idx);
      let cls = 'option';
      if (idx === correctIdx) cls += ' correct';
      else if (idx === userAns) cls += ' incorrect';
      return h('div', { className: cls },
        h('span', { className: 'option-label' }, letter + '.'),
        h('span', { className: 'option-text' }, opt)
      );
    });
    const wasCorrect = userAns === correctIdx;
    return h('div', { className: 'question-card' },
      h('div', {
        className: 'question-number',
        style: wasCorrect ? 'background:#16a34a;' : (userAns === null ? 'background:#64748b;' : 'background:#dc2626;')
      },
        `Асуулт №${i + 1}  ·  ` + (wasCorrect ? 'Зөв' : (userAns === null ? 'Хариулаагүй' : 'Буруу'))
      ),
      h('div', { className: 'question-text' }, question.q),
      h('div', { className: 'options' }, ...optionEls)
    );
  });

  render(h('div', {},
    header(),
    h('div', { className: 'container' },
      h('div', { className: 'quiz-header' },
        h('h2', {}, 'Хариултын дэлгэрэнгүй'),
        h('button', { className: 'btn btn-secondary', onclick: showDashboard }, 'Нүүр хуудас')
      ),
      ...cards
    )
  ));
}

// ---------- Boot ----------
async function boot() {
  await seedIfEmpty();
  const session = loadSession();
  if (session) {
    state.user = session;
    showDashboard();
  } else {
    render(loginView());
  }
}

boot();
