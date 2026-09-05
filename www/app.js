window.onerror = function (message, source, lineno, colno, error) {
  const banner = document.getElementById('errorBanner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = 'App error: ' + message + ' (line ' + lineno + ')';
  }
  return false;
};

try {

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
const PRIORITY_WEIGHT = { High: 0, Medium: 1, Low: 2 };

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
let selectedModalPriority = 'High';

function makeChapter(subject, name) {
  return {
    id: subject + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    subject: subject, name: name, subtopics: [], target: '', progress: 0, status: 'Not Started',
    revisions: [false, false, false, false], notes: ''
  };
}

function seedChaptersIfNeeded() {
  const seeded = loadData(STORAGE_KEYS.seeded, false);
  if (seeded) return;
  const existingKeys = {};
  chapters.forEach(function (c) { existingKeys[c.subject + '::' + c.name] = true; });
  const toAdd = [];
  PHYSICS_CHAPTERS.forEach(function (n) { if (!existingKeys['Physics::' + n]) toAdd.push(makeChapter('Physics', n)); });
  CHEMISTRY_CHAPTERS.forEach(function (n) { if (!existingKeys['Chemistry::' + n]) toAdd.push(makeChapter('Chemistry', n)); });
  MATH_CHAPTERS.forEach(function (n) { if (!existingKeys['Mathematics::' + n]) toAdd.push(makeChapter('Mathematics', n)); });
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
  setTimeout(function () { toast.classList.remove('show'); }, 2000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
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
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
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
function handleMainDateChange(e) {
  examDates.main = e.target.value;
  saveData(STORAGE_KEYS.examDates, examDates);
  renderCountdowns();
}
function handleAdvDateChange(e) {
  examDates.advanced = e.target.value;
  saveData(STORAGE_KEYS.examDates, examDates);
  renderCountdowns();
}
document.getElementById('examMainDate').addEventListener('change', handleMainDateChange);
document.getElementById('examMainDate').addEventListener('input', handleMainDateChange);
document.getElementById('examAdvancedDate').addEventListener('change', handleAdvDateChange);
document.getElementById('examAdvancedDate').addEventListener('input', handleAdvDateChange);

function renderGoal() { document.getElementById('goalHours').value = goalHours === null ? '' : goalHours; }
document.getElementById('goalHours').addEventListener('change', function (e) {
  const val = parseFloat(e.target.value);
  goalHours = isNaN(val) ? null : val;
  saveData(STORAGE_KEYS.goalHours, goalHours);
});

function renderStats() {
  const today = todayStr();
  const todayMinutes = sessions.filter(function (s) { return s.date === today; }).reduce(function (sum, s) { return sum + s.minutes; }, 0);
  const totalMinutes = sessions.reduce(function (sum, s) { return sum + s.minutes; }, 0);
  document.getElementById('todayHours').textContent = (todayMinutes / 60).toFixed(1) + 'h';
  document.getElementById('totalHours').textContent = (totalMinutes / 60).toFixed(1) + 'h';

  const withProd = sessions.filter(function (s) { return s.productivity > 0; });
  document.getElementById('productivityScore').textContent = withProd.length === 0
    ? '-' : (withProd.reduce(function (sum, s) { return sum + s.productivity; }, 0) / withProd.length).toFixed(1) + '/10';

  const completedCount = chapters.filter(function (c) { return c.status === 'Completed'; }).length;
  document.getElementById('chaptersDone').textContent = completedCount + '/' + chapters.length;
}

function renderInsight() {
  const el = document.getElementById('coachInsight');
  const today = todayStr();
  const todayMinutes = sessions.filter(function (s) { return s.date === today; }).reduce(function (sum, s) { return sum + s.minutes; }, 0);
  const revisionDue = chapters.filter(function (c) { return c.status === 'Revision Due'; });
  const delayed = chapters.filter(function (c) { return c.status === 'Delayed'; });
  const bySubjectProgress = {};
  ['Physics', 'Chemistry', 'Mathematics'].forEach(function (sub) {
    const subChapters = chapters.filter(function (c) { return c.subject === sub; });
    if (subChapters.length > 0) {
      bySubjectProgress[sub] = subChapters.reduce(function (sum, c) { return sum + c.progress; }, 0) / subChapters.length;
    }
  });
  let weakest = null;
  Object.keys(bySubjectProgress).forEach(function (sub) {
    if (weakest === null || bySubjectProgress[sub] < bySubjectProgress[weakest]) weakest = sub;
  });
  const parts = [];
  parts.push(todayMinutes === 0
    ? "You haven't logged any study time today yet."
    : ("You've studied " + (todayMinutes / 60).toFixed(1) + "h today."));
  if (streak.count > 0) parts.push('Your current streak is ' + streak.count + ' day' + (streak.count > 1 ? 's' : '') + '.');
  if (delayed.length > 0) parts.push(delayed[0].name + ' is delayed and needs attention.');
  else if (revisionDue.length > 0) parts.push(revisionDue[0].name + ' has a revision due.');
  else if (weakest) parts.push(weakest + ' has your lowest average progress — consider prioritizing it.');
  el.textContent = parts.join(' ');
}

function renderMiniChapterLists() {
  const inProgress = chapters.filter(function (c) { return c.status === 'In Progress'; });
  const inProgressEl = document.getElementById('inProgressList');
  inProgressEl.innerHTML = inProgress.length === 0
    ? '<div class="empty">No chapters in progress right now.</div>'
    : inProgress.map(function (ch) {
      return '<div class="mini-chapter">' +
        '<div class="mini-top"><span class="mini-name">' + escapeHtml(ch.name) + '</span><span class="mini-percent">' + ch.progress + '%</span></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + ch.progress + '%"></div></div>' +
        (ch.notes ? '<div class="mini-note">' + escapeHtml(ch.notes) + '</div>' : '') +
        '</div>';
    }).join('');

  const attention = chapters.filter(function (c) { return c.status === 'Delayed' || c.status === 'Revision Due'; });
  const attentionEl = document.getElementById('attentionList');
  attentionEl.innerHTML = attention.length === 0
    ? '<div class="empty">Nothing needs attention right now.</div>'
    : attention.map(function (ch) {
      return '<div class="mini-chapter attention-item">' +
        '<div class="mini-top"><span class="mini-name">' + escapeHtml(ch.name) + '</span><span class="mini-status ' + statusClass(ch.status) + '">' + ch.status + '</span></div>' +
        '<div class="mini-note">' + (ch.target ? 'Target date was ' + ch.target + '. ' : '') + 'Backlog recovery needed.</div>' +
        '</div>';
    }).join('');
}

function sortedTasks() {
  const pending = tasks.filter(function (t) { return !t.done; });
  const done = tasks.filter(function (t) { return t.done; });
  pending.sort(function (a, b) {
    const wa = PRIORITY_WEIGHT[a.priority] === undefined ? 1 : PRIORITY_WEIGHT[a.priority];
    const wb = PRIORITY_WEIGHT[b.priority] === undefined ? 1 : PRIORITY_WEIGHT[b.priority];
    return wa - wb;
  });
  done.sort(function (a, b) { return b.id - a.id; });
  return pending.concat(done);
}

function priorityDotClass(priority) {
  if (priority === 'Medium') return 'priority-dot medium';
  if (priority === 'Low') return 'priority-dot low';
  return 'priority-dot';
}

function renderTasks() {
  const pendingCount = tasks.filter(function (t) { return !t.done; }).length;
  document.getElementById('pendingCount').textContent = pendingCount;
  const list = document.getElementById('taskList');
  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty">No tasks yet. Tap + Add Task above.</li>';
    return;
  }
  const ordered = sortedTasks();
  list.innerHTML = ordered.map(function (task) {
    const metaBits = [];
    if (task.priority) metaBits.push('<span>' + escapeHtml(task.priority) + '</span>');
    if (task.minutes) metaBits.push('<span>' + task.minutes + ' mins</span>');
    return '<li class="task-item' + (task.done ? ' done' : '') + '">' +
      '<label class="task-check">' +
      '<input type="checkbox" ' + (task.done ? 'checked' : '') + ' data-id="' + task.id + '">' +
      '<span class="task-body">' +
      '<span class="task-text">' + escapeHtml(task.text) + '</span>' +
      '<span class="task-meta">' + metaBits.join(' · ') + '</span>' +
      '</span>' +
      '</label>' +
      '<span class="task-right">' +
      '<span class="' + priorityDotClass(task.priority) + '"></span>' +
      '<button class="task-delete" data-id="' + task.id + '">✕</button>' +
      '</span>' +
      '</li>';
  }).join('');
}

document.getElementById('taskList').addEventListener('click', function (e) {
  const cb = e.target.matches('input[type="checkbox"]') ? e.target : null;
  const delBtn = e.target.closest('.task-delete');
  if (cb) {
    const task = tasks.find(function (t) { return t.id === cb.dataset.id; });
    if (task) task.done = cb.checked;
    saveData(STORAGE_KEYS.tasks, tasks);
    renderTasks();
  } else if (delBtn) {
    tasks = tasks.filter(function (t) { return t.id !== delBtn.dataset.id; });
    saveData(STORAGE_KEYS.tasks, tasks);
    renderTasks();
  }
});

const taskModalOverlay = document.getElementById('taskModalOverlay');
document.getElementById('openTaskModalBtn').addEventListener('click', function () {
  document.getElementById('modalTaskInput').value = '';
  document.getElementById('modalTaskMinutes').value = '60';
  selectedModalPriority = 'High';
  document.querySelectorAll('.priority-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.priority === 'High');
  });
  taskModalOverlay.style.display = 'flex';
});
document.getElementById('cancelTaskBtn').addEventListener('click', function () {
  taskModalOverlay.style.display = 'none';
});
document.querySelectorAll('.priority-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    selectedModalPriority = btn.dataset.priority;
    document.querySelectorAll('.priority-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });
});
document.getElementById('saveTaskBtn').addEventListener('click', function () {
  const textInput = document.getElementById('modalTaskInput');
  const minutesInput = document.getElementById('modalTaskMinutes');
  const text = textInput.value.trim();
  if (!text) return;
  tasks.push({
    id: Date.now().toString(), text: text, priority: selectedModalPriority,
    minutes: parseInt(minutesInput.value, 10) || 0, done: false
  });
  saveData(STORAGE_KEYS.tasks, tasks);
  taskModalOverlay.style.display = 'none';
  renderTasks();
});

function renderCommandCenter() {
  document.getElementById('commandTitle').textContent = currentSubject + ' Command Center';
  document.getElementById('subjectTarget').value = (subjectMeta[currentSubject] && subjectMeta[currentSubject].target) || '';
  const subChapters = chapters.filter(function (c) { return c.subject === currentSubject; });
  document.getElementById('totalChapters').textContent = subChapters.length;
  document.getElementById('completedChapters').textContent = subChapters.filter(function (c) { return c.status === 'Completed'; }).length;
  const avg = subChapters.length === 0 ? 0 : Math.round(subChapters.reduce(function (sum, c) { return sum + c.progress; }, 0) / subChapters.length);
  document.getElementById('avgProgress').textContent = avg + '%';
}
document.getElementById('subjectTarget').addEventListener('change', function (e) {
  if (!subjectMeta[currentSubject]) subjectMeta[currentSubject] = {};
  subjectMeta[currentSubject].target = e.target.value;
  saveData(STORAGE_KEYS.subjectMeta, subjectMeta);
});

function renderChapters() {
  renderCommandCenter();
  const list = document.getElementById('chapterList');
  const filtered = chapters.filter(function (c) { return c.subject === currentSubject; });
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty">No chapters yet for this subject.</div>';
    return;
  }
  list.innerHTML = filtered.map(function (ch) {
    const subtopicsHtml = (ch.subtopics && ch.subtopics.length)
      ? '<div class="subtopics-row">' + ch.subtopics.map(function (s) { return '<span>• ' + escapeHtml(s) + '</span>'; }).join(' ') + '</div>' : '';
    return '<div class="chapter-card">' +
      '<div class="chapter-top">' +
      '<div class="chapter-title">' + escapeHtml(ch.name) + '</div>' +
      '<button class="chapter-delete" data-id="' + ch.id + '">✕</button>' +
      '</div>' +
      '<div class="chapter-meta">' +
      '<span class="status-badge ' + statusClass(ch.status) + '">' + ch.status + '</span>' +
      (ch.target ? '<span class="chapter-target">Target: ' + ch.target + '</span>' : '') +
      '</div>' +
      subtopicsHtml +
      '<div class="progress-track"><div class="progress-fill" style="width:' + ch.progress + '%"></div></div>' +
      '<div class="progress-row">' +
      '<input type="range" class="progress-slider" data-id="' + ch.id + '" min="0" max="100" value="' + ch.progress + '">' +
      '<span class="progress-label">' + ch.progress + '%</span>' +
      '</div>' +
      '<div class="revision-row">' +
      [0, 1, 2, 3].map(function (i) {
        return '<button class="revision-chip ' + (ch.revisions[i] ? 'done' : '') + '" data-id="' + ch.id + '" data-rev="' + i + '">R' + (i + 1) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="status-btn-row">' +
      STATUSES.map(function (s) {
        return '<button class="status-btn ' + (s === ch.status ? 'active' : '') + '" data-id="' + ch.id + '" data-status="' + s + '">' + s + '</button>';
      }).join('') +
      '</div>' +
      '<input type="text" class="chapter-note-input" data-id="' + ch.id + '" placeholder="Note (optional)" value="' + escapeHtml(ch.notes || '') + '">' +
      '</div>';
  }).join('');
}

document.getElementById('chapterForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const nameInput = document.getElementById('chapterName');
  const subtopicsInput = document.getElementById('chapterSubtopics');
  const targetInput = document.getElementById('chapterTarget');
  const name = nameInput.value.trim();
  if (!name) return;
  const subtopics = subtopicsInput.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  chapters.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    subject: currentSubject, name: name, subtopics: subtopics, target: targetInput.value || '',
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
    chapters = chapters.filter(function (c) { return c.id !== delBtn.dataset.id; });
  } else if (revBtn) {
    const ch = chapters.find(function (c) { return c.id === revBtn.dataset.id; });
    if (ch) ch.revisions[parseInt(revBtn.dataset.rev, 10)] = !ch.revisions[parseInt(revBtn.dataset.rev, 10)];
  } else if (statusBtn) {
    const ch2 = chapters.find(function (c) { return c.id === statusBtn.dataset.id; });
    if (ch2) {
      ch2.status = statusBtn.dataset.status;
      if (ch2.status === 'Completed')
