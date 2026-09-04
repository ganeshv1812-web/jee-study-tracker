const STORAGE_KEYS = {
  tasks: 'jee_tasks',
  sessions: 'jee_sessions',
  streak: 'jee_streak',
  chapters: 'jee_chapters'
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

let tasks = loadData(STORAGE_KEYS.tasks, []);
let sessions = loadData(STORAGE_KEYS.sessions, []);
let streak = loadData(STORAGE_KEYS.streak, { count: 0, lastDate: null });
let chapters = loadData(STORAGE_KEYS.chapters, []);
let currentSubject = 'Physics';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

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

function updateStreak() {
  const today = todayStr();
  if (streak.lastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (streak.lastDate === yesterday) {
    streak.count += 1;
  } else {
    streak.count = 1;
  }
  streak.lastDate = today;
  saveData(STORAGE_KEYS.streak, streak);
}

function renderStreak() {
  document.getElementById('streakCount').textContent = streak.count;
}

function renderStats() {
  const today = todayStr();
  const todayMinutes = sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.minutes, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  document.getElementById('todayHours').textContent = (todayMinutes / 60).toFixed(1) + 'h';
  document.getElementById('totalHours').textContent = (totalMinutes / 60).toFixed(1) + 'h';
  const doneCount = tasks.filter(t => t.done).length;
  document.getElementById('taskCount').textContent = `${doneCount}/${tasks.length}`;
}

function renderTasks() {
  const list = document.getElementById('taskList');
  list.innerHTML = '';
  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty">No tasks yet. Add your first one above.</li>';
    return;
  }
  tasks.slice().reverse().forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');
    li.innerHTML = `
      <label class="task-check">
        <input type="checkbox" ${task.done ? 'checked' : ''} data-id="${task.id}">
        <span>${escapeHtml(task.text)}</span>
      </label>
      <button class="task-delete" data-id="${task.id}">✕</button>
    `;
    list.appendChild(li);
  });
}

function renderSessions() {
  const list = document.getElementById('sessionList');
  list.innerHTML = '';
  if (sessions.length === 0) {
    list.innerHTML = '<li class="empty">No study sessions logged yet.</li>';
    return;
  }
  sessions.slice().reverse().slice(0, 10).forEach(s => {
    const li = document.createElement('li');
    li.className = 'session-item';
    li.innerHTML = `
      <div>
        <div class="session-subject">${escapeHtml(s.subject)}</div>
        <div class="session-date">${s.date}</div>
      </div>
      <div class="session-minutes">${s.minutes} mins</div>
    `;
    list.appendChild(li);
  });
}

function renderAll() {
  renderStreak();
  renderStats();
  renderTasks();
  renderSessions();
}

document.getElementById('taskForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) return;
  tasks.push({ id: Date.now().toString(), text, done: false });
  saveData(STORAGE_KEYS.tasks, tasks);
  input.value = '';
  renderTasks();
  renderStats();
});

document.getElementById('taskList').addEventListener('click', function (e) {
  const id = e.target.getAttribute('data-id');
  if (!id) return;
  if (e.target.matches('input[type="checkbox"]')) {
    const task = tasks.find(t => t.id === id);
    if (task) task.done = e.target.checked;
    saveData(STORAGE_KEYS.tasks, tasks);
    renderTasks();
    renderStats();
  } else if (e.target.classList.contains('task-delete')) {
    tasks = tasks.filter(t => t.id !== id);
    saveData(STORAGE_KEYS.tasks, tasks);
    renderTasks();
    renderStats();
  }
});

document.getElementById('sessionForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const subject = document.getElementById('sessionSubject').value;
  const minutesInput = document.getElementById('sessionMinutes');
  const minutes = parseInt(minutesInput.value, 10);
  if (!minutes || minutes <= 0) return;
  sessions.push({ id: Date.now().toString(), subject, minutes, date: todayStr() });
  saveData(STORAGE_KEYS.sessions, sessions);
  updateStreak();
  minutesInput.value = '';
  renderAll();
  showToast('Study session logged');
});

function statusOptions(current) {
  const statuses = ['Not Started', 'In Progress', 'Completed', 'Delayed', 'Revision Due'];
  return statuses.map(s => `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`).join('');
}

function statusClass(status) {
  const map = {
    'Not Started': 'status-not-started',
    'In Progress': 'status-in-progress',
    'Completed': 'status-completed',
    'Delayed': 'status-delayed',
    'Revision Due': 'status-revision'
  };
  return map[status] || 'status-not-started';
}

function renderChapters() {
  const list = document.getElementById('chapterList');
  const filtered = chapters.filter(c => c.subject === currentSubject);
  const completed = filtered.filter(c => c.status === 'Completed').length;
  document.getElementById('subjectSummary').textContent = `${currentSubject} — ${completed} of ${filtered.length} chapters completed`;

  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty">No chapters added yet for this subject.</div>';
    return;
  }
  filtered.slice().reverse().forEach(ch => {
    const div = document.createElement('div');
    div.className = 'chapter-card';
    div.innerHTML = `
      <div class="chapter-top">
        <div class="chapter-title">${escapeHtml(ch.name)}</div>
        <button class="chapter-delete" data-id="${ch.id}">✕</button>
      </div>
      <div class="chapter-meta">
        <span class="status-badge ${statusClass(ch.status)}">${ch.status}</span>
        ${ch.target ? `<span class="chapter-target">Target: ${ch.target}</span>` : ''}
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${ch.progress}%"></div></div>
      <div class="progress-label">${ch.progress}%</div>
      <div class="chapter-controls">
        <select class="status-select" data-id="${ch.id}">${statusOptions(ch.status)}</select>
        <input type="number" class="progress-input" data-id="${ch.id}" min="0" max="100" value="${ch.progress}">
        <button class="btn-small" data-action="update-progress" data-id="${ch.id}">Update</button>
      </div>
      <div class="revision-row">
        ${[0, 1, 2, 3].map(i => `<button class="revision-chip ${ch.revisions[i] ? 'done' : ''}" data-id="${ch.id}" data-rev="${i}">R${i + 1}</button>`).join('')}
      </div>
    `;
    list.appendChild(div);
  });
}

document.getElementById('chapterForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const nameInput = document.getElementById('chapterName');
  const targetInput = document.getElementById('chapterTarget');
  const name = nameInput.value.trim();
  if (!name) return;
  chapters.push({
    id: Date.now().toString(),
    subject: currentSubject,
    name,
    target: targetInput.value || '',
    progress: 0,
    status: 'Not Started',
    revisions: [false, false, false, false]
  });
  saveData(STORAGE_KEYS.chapters, chapters);
  nameInput.value = '';
  targetInput.value = '';
  renderChapters();
});

document.getElementById('chapterList').addEventListener('click', function (e) {
  const delBtn = e.target.closest('.chapter-delete');
  if (delBtn) {
    const id = delBtn.dataset.id;
    chapters = chapters.filter(c => c.id !== id);
    saveData(STORAGE_KEYS.chapters, chapters);
    renderChapters();
    return;
  }
  const revBtn = e.target.closest('.revision-chip');
  if (revBtn) {
    const id = revBtn.dataset.id;
    const revIdx = parseInt(revBtn.dataset.rev, 10);
    const ch = chapters.find(c => c.id === id);
    if (ch) {
      ch.revisions[revIdx] = !ch.revisions[revIdx];
      saveData(STORAGE_KEYS.chapters, chapters);
      renderChapters();
    }
    return;
  }
  const updateBtn = e.target.closest('[data-action="update-progress"]');
  if (updateBtn) {
    const id = updateBtn.dataset.id;
    const input = document.querySelector(`.progress-input[data-id="${id}"]`);
    const ch = chapters.find(c => c.id === id);
    if (ch && input) {
      let val = parseInt(input.value, 10);
      if (isNaN(val)) val = 0;
      val = Math.max(0, Math.min(100, val));
      ch.progress = val;
      if (val === 100 && ch.status !== 'Completed') ch.status = 'Completed';
      saveData(STORAGE_KEYS.chapters, chapters);
      renderChapters();
    }
  }
});

document.getElementById('chapterList').addEventListener('change', function (e) {
  if (e.target.classList.contains('status-select')) {
    const id = e.target.dataset.id;
    const ch = chapters.find(c => c.id === id);
    if (ch) {
      ch.status = e.target.value;
      saveData(STORAGE_KEYS.chapters, chapters);
      renderChapters();
    }
  }
});

document.getElementById('subjectTabs').addEventListener('click', function (e) {
  const btn = e.target.closest('.subject-tab');
  if (!btn) return;
  currentSubject = btn.dataset.subject;
  document.querySelectorAll('.subject-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderChapters();
});

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.soon) {
      showToast('Coming in the next build phase');
      return;
    }
    const tab = btn.dataset.tab;
    if (!tab) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById('view-' + tab).style.display = '';
    if (tab === 'syllabus') renderChapters();
  });
});

renderAll();
