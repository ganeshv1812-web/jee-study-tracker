const STORAGE_KEYS = {
  tasks: 'jee_tasks',
  sessions: 'jee_sessions',
  streak: 'jee_streak',
  chapters: 'jee_chapters',
  seeded: 'jee_seeded',
  examDates: 'jee_exam_dates',
  goalHours: 'jee_goal_hours',
  subjectMeta: 'jee_subject_meta'
};

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const PHYSICS_CHAPTERS = [
  "Units and Measurements","Kinematics","Laws of Motion","Work, Energy and Power","Rotational Motion",
  "Gravitation","Properties of Solids and Liquids","Thermodynamics","Kinetic Theory of Gases",
  "Oscillations and Waves","Electrostatics","Current Electricity","Magnetic Effects of Current and Magnetism",
  "Electromagnetic Induction and Alternating Currents","Electromagnetic Waves","Optics",
  "Dual Nature of Matter and Radiation","Atoms and Nuclei","Electronic Devices","Experimental Skills"
];
const CHEMISTRY_CHAPTERS = [
  "Some Basic Concepts of Chemistry","Atomic Structure","Chemical Bonding and Molecular Structure",
  "States of Matter","Chemical Thermodynamics","Equilibrium","Redox Reactions and Electrochemistry",
  "Chemical Kinetics","Solutions","Classification of Elements and Periodicity","p-Block Elements",
  "d and f Block Elements","Coordination Compounds","General Principles of Metallurgy",
  "Basic Principles of Organic Chemistry","Hydrocarbons","Haloalkanes and Haloarenes",
  "Alcohols, Phenols and Ethers","Aldehydes, Ketones and Carboxylic Acids","Amines","Biomolecules and Polymers"
];
const MATH_CHAPTERS = [
  "Sets, Relations and Functions","Complex Numbers and Quadratic Equations","Matrices and Determinants",
  "Permutations and Combinations","Binomial Theorem","Sequences and Series",
  "Limits, Continuity and Differentiability","Integral Calculus","Differential Equations",
  "Coordinate Geometry","Three Dimensional Geometry","Vector Algebra","Statistics and Probability","Trigonometry"
];
const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Delayed', 'Revision Due'];

let tasks = loadData(STORAGE_KEYS.tasks, []);
let sessions = loadData(STORAGE_KEYS.sessions, []);
let streak = loadData(STORAGE_KEYS.streak, { count: 0, lastDate: null });
let chapters = loadData(STORAGE_KEYS.chapters, []);
let examDates = loadData(STORAGE_KEYS.examDates, { main: '', advanced: '' });
let goalHours = loadData(STORAGE_KEYS.goalHours, null);
let subjectMeta = loadData(STORAGE_KEYS.subjectMeta, { Physics: {}, Chemistry: {}, Mathematics: {} });

let currentSubject = 'Physics';
let currentLogSubject = 'Physics';
let selectedLogChapterId = null;

function makeChapter(subject, name) {
  return {
    id: subject + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    subject, name, subtopics: [], target: '', progress: 0, status: 'Not Started',
    revisions: [false, false, false, false], notes: ''
  };
}

function seedChaptersIfNeeded() {
  const seeded = loadData(STORAGE_KEYS.seeded, false);
  if (seeded) return;
  const existingKeys = new Set(chapters.map(c => c.subject + '::' + c.name));
  const toAdd = [];
  PHYSICS_CHAPTERS.forEach(n => { if (!existingKeys.has('Physics::' + n)) toAdd.push(makeChapter('Physics', n)); });
  CHEMISTRY_CHAPTERS.forEach(n => { if (!existingKeys.has('Chemistry::' + n)) toAdd.push(makeChapter('Chemistry', n)); });
  MATH_CHAPTERS.forEach(n => { if (!existingKeys.has('Mathematics::' + n)) toAdd.push(makeChapter('Mathematics', n)); });
  chapters = chapters.concat(toAdd);
  saveData(STORAGE_KEYS.chapters, chapters);
  saveData(STORAGE_KEYS.seeded, true);
}
seedChaptersIfNeeded();

function todayStr() { return new Date().toISOString().slice(0, 10); }

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function statusClass(status) {
  const map = {
    'Not Started': 'status-not-started', 'In Progress': 'status-in-progress',
    'Completed': 'status-completed', 'Delayed': 'status-delayed', 'Revision Due': 'status-revision'
  };
  return map[status] || 'status-not-started';
}

function updateStreak() {
  const today = todayStr();
  if (streak.lastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  streak.count = (streak.lastDate === yesterday) ? streak.count + 1 : 1;
  streak.lastDate = today;
  saveData(STORAGE_KEYS.streak, streak);
}
function renderStreak() { document.getElementById('streakCount').textContent = streak.count; }

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}
function renderCountdowns() {
  const mainDays = daysBetween(examDates.main);
  const advDays = daysBetween(examDates.advanced);
  document.getElementById('daysMain').textContent = mainDays === null ? '--' : mainDays;
  document.getElementById('daysAdvanced').textContent = advDays === null ? '--' : advDays;
  document.getElementById('examMainDate').value = examDates.main || '';
  document.getElementById('examAdvancedDate').value = examDates.advanced || '';
}
document.getElementById('examMainDate').addEventListener('change', e => {
  examDates.main = e.target.value;
  saveData(STORAGE_KEYS.examDates, examDates);
  renderCountdowns();
});
document.getElementById('examAdvancedDate').addEventListener('change', e => {
  examDates.advanced = e.target.value;
  saveData(STORAGE_KEYS.examDates, examDates);
  renderCountdowns();
});

function renderGoal() { document.getElementById('goalHours').value = goalHours === null ? '' : goalHours; }
document.getElementById('goalHours').addEventListener('change', e => {
  const val = parseFloat(e.target.value);
  goalHours = isNaN(val) ? null : val;
  saveData(STORAGE_KEYS.goalHours, goalHours);
});

function renderStats() {
  const today = todayStr();
  const todayMinutes = sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.minutes, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  document.getElementById('todayHours').textContent = (todayMinutes / 60).toFixed(1) + 'h';
  document.getElementById('totalHours').textContent = (totalMinutes / 60).toFixed(1) + 'h';

  const withProd = sessions.filter(s => s.productivity > 0);
  document.getElementById('productivityScore').textContent = withProd.length === 0
    ? '-' : (withProd.reduce((sum, s) => sum + s.productivity, 0) / withProd.length).toFixed(1) + '/10';

  const completedCount = chapters.filter(c => c.status === 'Completed').length;
  document.getElementById('chaptersDone').textContent = `${completedCount}/${chapters.length}`;
}

function renderInsight() {
  const el = document.getElementById('coachInsight');
  const today = todayStr();
  const todayMinutes = sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.minutes, 0);
  const revisionDue = chapters.filter(c => c.status === 'Revision Due');
  const delayed = chapters.filter(c => c.status === 'Delayed');
  const bySubjectProgress = {};
  ['Physics', 'Chemistry', 'Mathematics'].forEach(sub => {
    const subChapters = chapters.filter(c => c.subject === sub);
    if (subChapters.length > 0) {
      bySubjectProgress[sub] = subChapters.reduce((sum, c) => sum + c.progress, 0) / subChapters.length;
    }
  });
  let weakest = null;
  Object.keys(bySubjectProgress).forEach(sub => {
    if (weakest === null || bySubjectProgress[sub] < bySubjectProgress[weakest]) weakest = sub;
  });
  const parts = [];
  parts.push(todayMinutes === 0
    ? "You haven't logged any study time today yet."
    : `You've studied ${(todayMinutes / 60).toFixed(1)}h today.`);
  if (streak.count > 0) parts.push(`Your current streak is ${streak.count} day${streak.count > 1 ? 's' : ''}.`);
  if (delayed.length > 0) parts.push(`${delayed[0].name} is delayed and needs attention.`);
  else if (revisionDue.length > 0) parts.push(`${revisionDue[0].name} has a revision due.`);
  else if (weakest) parts.push(`${weakest} has your lowest average progress — consider prioritizing it.`);
  el.textContent = parts.join(' ');
}

function renderMiniChapterLists() {
  const inProgress = chapters.filter(c => c.status === 'In Progress');
  const inProgressEl = document.getElementById('inProgressList');
  inProgressEl.innerHTML = inProgress.length === 0
    ? '<div class="empty">No chapters in progress right now.</div>'
    : inProgress.map(ch => `
      <div class="mini-chapter">
        <div class="mini-top"><span class="mini-name">${escapeHtml(ch.name)}</span><span class="mini-percent">${ch.progress}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${ch.progress}%"></div></div>
        ${ch.notes ? `<div class="mini-note">${escapeHtml(ch.notes)}</div>` : ''}
      </div>`).join('');

  const attention = chapters.filter(c => c.status === 'Delayed' || c.status === 'Revision Due');
  const attentionEl = document.getElementById('attentionList');
  attentionEl.innerHTML = attention.length === 0
    ? '<div class="empty">Nothing needs attention right now.</div>'
    : attention.map(ch => `
      <div class="mini-chapter attention-item">
        <div class="mini-top"><span class="mini-name">${escapeHtml(ch.name)}</span><span class="mini-status ${statusClass(ch.status)}">${ch.status}</span></div>
        <div class="mini-note">${ch.target ? 'Target date was ' + ch.target + '. ' : ''}Backlog recovery needed.</div>
      </div>`).join('');
}

function renderTasks() {
  const pending = tasks.filter(t => !t.done);
  document.getElementById('pendingCount').textContent = pending.length;
  const list = document.getElementById('taskList');
  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty">No tasks yet. Add your first one above.</li>';
    return;
  }
  list.innerHTML = tasks.slice().reverse().map(task => {
    const metaBits = [];
    if (task.tag) metaBits.push(`<span class="task-tag">${escapeHtml(task.tag)}</span>`);
    if (task.minutes) metaBits.push(`<span>${task.minutes} mins</span>`);
    return `
      <li class="task-item${task.done ? ' done' : ''}">
        <label class="task-check">
          <input type="checkbox" ${task.done ? 'checked' : ''} data-id="${task.id}">
          <span class="task-body">
            <span class="task-text">${escapeHtml(task.text)}</span>
            <span class="task-meta">${metaBits.join(' ')}</span>
          </span>
        </label>
        <span class="task-right">
          <span class="priority-dot ${task.urgent ? 'urgent' : ''}"></span>
          <button class="task-delete" data-id="${task.id}">✕</button>
        </span>
      </li>`;
  }).join('');
}

document.getElementById('taskForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const textInput = document.getElementById('taskInput');
  const tagInput = document.getElementById('taskTag');
  const minutesInput = document.getElementById('taskMinutes');
  const urgentInput = document.getElementById('taskUrgent');
  const text = textInput.value.trim();
  if (!text) return;
  tasks.push({
    id: Date.now().toString(), text, tag: tagInput.value.trim(),
    minutes: parseInt(minutesInput.value, 10) || 0, urgent: urgentInput.checked, done: false
  });
  saveData(STORAGE_KEYS.tasks, tasks);
  textInput.value = ''; tagInput.value = ''; minutesInput.value = ''; urgentInput.checked = false;
  renderTasks();
});
document.getElementById('taskList').addEventListener('click', function (e) {
  const cb = e.target.matches('input[type="checkbox"]') ? e.target : null;
  const delBtn = e.target.closest('.task-delete');
  if (cb) {
    const task = tasks.find(t => t.id === cb.dataset.id);
    if (task) task.done = cb.checked;
    saveData(STORAGE_KEYS.tasks, tasks);
    renderTasks();
  } else if (delBtn) {
    tasks = tasks.filter(t => t.id !== delBtn.dataset.id);
    saveData(STORAGE_KEYS.tasks, tasks);
    renderTasks();
  }
});

function renderCommandCenter() {
  document.getElementById('commandTitle').textContent = currentSubject + ' Command Center';
  document.getElementById('subjectTarget').value = (subjectMeta[currentSubject] && subjectMeta[currentSubject].target) || '';
  const subChapters = chapters.filter(c => c.subject === currentSubject);
  document.getElementById('totalChapters').textContent = subChapters.length;
  document.getElementById('completedChapters').textContent = subChapters.filter(c => c.status === 'Completed').length;
}
document.getElementById('subjectTarget').addEventListener('change', e => {
  if (!subjectMeta[currentSubject]) subjectMeta[currentSubject] = {};
  subjectMeta[currentSubject].target = e.target.value;
  saveData(STORAGE_KEYS.subjectMeta, subjectMeta);
});

function renderChapters() {
  renderCommandCenter();
  const list = document.getElementById('chapterList');
  const filtered = chapters.filter(c => c.subject === currentSubject);
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty">No chapters yet for this subject.</div>';
    return;
  }
  list.innerHTML = filtered.map(ch => {
    const subtopicsHtml = (ch.subtopics && ch.subtopics.length)
      ? `<div class="subtopics-row">${ch.subtopics.map(s => `<span>• ${escapeHtml(s)}</span>`).join(' ')}</div>` : '';
    return `
      <div class="chapter-card">
        <div class="chapter-top">
          <div class="chapter-title">${escapeHtml(ch.name)}</div>
          <button class="chapter-delete" data-id="${ch.id}">✕</button>
        </div>
        <div class="chapter-meta">
          <span class="status-badge ${statusClass(ch.status)}">${ch.status}</span>
          ${ch.target ? `<span class="chapter-target">Target: ${ch.target}</span>` : ''}
        </div>
        ${subtopicsHtml}
        <div class="progress-track"><div class="progress-fill" style="width:${ch.progress}%"></div></div>
        <div class="progress-row">
          <input type="range" class="progress-slider" data-id="${ch.id}" min="0" max="100" value="${ch.progress}">
          <span class="progress-label">${ch.progress}%</span>
        </div>
        <div class="revision-row">
          ${[0, 1, 2, 3].map(i => `<button class="revision-chip ${ch.revisions[i] ? 'done' : ''}" data-id="${ch.id}" data-rev="${i}">R${i + 1}</button>`).join('')}
        </div>
        <div class="status-btn-row">
          ${STATUSES.map(s => `<button class="status-btn ${s === ch.status ? 'active' : ''}" data-id="${ch.id}" data-status="${s}">${s}</button>`).join('')}
        </div>
        <input type="text" class="chapter-note-input" data-id="${ch.id}" placeholder="Note (optional)" value="${escapeHtml(ch.notes || '')}">
      </div>`;
  }).join('');
}

document.getElementById('chapterForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const nameInput = document.getElementById('chapterName');
  const subtopicsInput = document.getElementById('chapterSubtopics');
  const targetInput = document.getElementById('chapterTarget');
  const name = nameInput.value.trim();
  if (!name) return;
  const subtopics = subtopicsInput.value.split(',').map(s => s.trim()).filter(Boolean);
  chapters.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    subject: currentSubject, name, subtopics, target: targetInput.value || '',
    progress: 0, status: 'Not Started', revisions: [false, false, false, false], notes: ''
  });
  saveData(STORAGE_KEYS.chapters, chapters);
  nameInput.value = ''; subtopicsInput.value = ''; targetInput.value = '';
  renderChapters();
  renderStats();
});

document.getElementById('chapterList').addEventListener('click', function (e) {
  const delBtn = e.target.closest('.chapter-delete');
  const revBtn = e.target.closest('.revision-chip');
  const statusBtn = e.target.closest('.status-btn');
  if (delBtn) {
    chapters = chapters.filter(c => c.id !== delBtn.dataset.id);
  } else if (revBtn) {
    const ch = chapters.find(c => c.id === revBtn.dataset.id);
    if (ch) ch.revisions[parseInt(revBtn.dataset.rev, 10)] = !ch.revisions[parseInt(revBtn.dataset.rev, 10)];
  } else if (statusBtn) {
    const ch = chapters.find(c => c.id === statusBtn.dataset.id);
    if (ch) {
      ch.status = statusBtn.dataset.status;
      if (ch.status === 'Completed') ch.progress = 100;
    }
  } else { return; }
  saveData(STORAGE_KEYS.chapters, chapters);
  renderChapters();
  renderMiniChapterLists();
  renderStats();
  renderInsight();
});
document.getElementById('chapterList').addEventListener('input', function (e) {
  if (e.target.classList.contains('progress-slider')) {
    const ch = chapters.find(c => c.id === e.target.dataset.id);
    if (ch) {
      ch.progress = parseInt(e.target.value, 10);
      if (ch.progress === 100 && ch.status !== 'Completed') ch.status = 'Completed';
      const card = e.target.closest('.chapter-card');
      card.querySelector('.progress-fill').style.width = ch.progress + '%';
      card.querySelector('.progress-label').textContent = ch.progress + '%';
    }
  }
});
document.getElementById('chapterList').addEventListener('change', function (e) {
  if (e.target.classList.contains('progress-slider')) {
    saveData(STORAGE_KEYS.chapters, chapters);
    renderChapters(); renderMiniChapterLists(); renderStats(); renderInsight();
  }
  if (e.target.classList.contains('chapter-note-input')) {
    const ch = chapters.find(c => c.id === e.target.dataset.id);
    if (ch) { ch.notes = e.target.value; saveData(STORAGE_KEYS.chapters, chapters); renderMiniChapterLists(); }
  }
});

document.getElementById('subjectTabs').addEventListener('click', function (e) {
  const btn = e.target.closest('.subject-tab');
  if (!btn) return;
  currentSubject = btn.dataset.subject;
  this.querySelectorAll('.subject-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderChapters();
});

function renderLogChapterChips() {
  const container = document.getElementById('logChapterChips');
  const subChapters = chapters.filter(c => c.subject === currentLogSubject);
  if (subChapters.length === 0) {
    container.innerHTML = '<div class="empty">No chapters for this subject yet — add some in Syllabus.</div>';
    selectedLogChapterId = null;
    return;
  }
  if (!subChapters.find(c => c.id === selectedLogChapterId)) selectedLogChapterId = subChapters[0].id;
  container.innerHTML = subChapters.map(ch =>
    `<button type="button" class="chip${ch.id === selectedLogChapterId ? ' active' : ''}" data-id="${ch.id}">${escapeHtml(ch.name)}</button>`
  ).join('');
}
document.getElementById('logSubjectTabs').addEventListener('click', function (e) {
  const btn = e.target.closest('.subject-tab');
  if (!btn) return;
  currentLogSubject = btn.dataset.subject;
  selectedLogChapterId = null;
  this.querySelectorAll('.subject-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLogChapterChips();
});
document.getElementById('logChapterChips').addEventListener('click', function (e) {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  selectedLogChapterId = chip.dataset.id;
  this.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
});

function renderSessions() {
  const list = document.getElementById('sessionList');
  if (sessions.length === 0) {
    list.innerHTML = '<li class="empty">No study sessions logged yet.</li>';
    return;
  }
  list.innerHTML = sessions.slice().reverse().slice(0, 15).map(s => {
    const metaBits = [];
    if (s.questions) metaBits.push(`Questions: ${s.questions}`);
    if (s.pages) metaBits.push(`Pages: ${s.pages}`);
    if (s.productivity) metaBits.push(`Productivity: ${
