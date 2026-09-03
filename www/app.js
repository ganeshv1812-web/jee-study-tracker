const STORAGE_KEYS = {
  tasks: 'jee_tasks',
  sessions: 'jee_sessions',
  streak: 'jee_streak'
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
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
  const todayMinutes = sessions
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + s.minutes, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);

  document.getElementById('todayHours').textContent = (todayMinutes / 60).toFixed(1) + 'h';
  document.getElementById('totalHours').textContent = (totalMinutes / 60).toFixed(1) + 'h';

  const doneCount = tasks.filter(t => t.done).length;
  document.getElementById('taskCount').textContent = `${doneCount}/${tasks.length}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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

document.querySelectorAll('.nav-item[data-soon]').forEach(btn => {
  btn.addEventListener('click', () => showToast('Coming in the next build phase'));
});

renderAll();
