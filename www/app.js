window.onerror = function (message, source, lineno, colno, error) {
  var banner = document.getElementById("errorBanner");
  if (banner) {
    banner.style.display = "block";
    banner.textContent = "App error: " + message + " (line " + lineno + ")";
  }
  return false;
};

try {

var splashEl = document.getElementById("splashScreen");
setTimeout(function () {
  if (splashEl) {
    splashEl.classList.add("hide");
    setTimeout(function () { if (splashEl && splashEl.parentNode) splashEl.parentNode.removeChild(splashEl); }, 600);
  }
}, 1600);

var STORAGE_KEYS = {
  tasks: "jee_tasks",
  sessions: "jee_sessions",
  streak: "jee_streak",
  chapters: "jee_chapters",
  seeded: "jee_seeded",
  examDates: "jee_exam_dates",
  goalHours: "jee_goal_hours",
  subjectMeta: "jee_subject_meta",
  phaseDates: "jee_phase_dates",
  tests: "jee_tests",
  pomodoroCount: "jee_pomodoro_count",
  pomodoroState: "jee_pomodoro_state",
  stopwatchState: "jee_stopwatch_state",
  coachChat: "jee_coach_chat",
  aiConfig: "jee_ai_config"
};

function loadData(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

var PHYSICS_CHAPTERS = [
  "Units and Measurements","Kinematics","Laws of Motion","Work, Energy and Power","Rotational Motion",
  "Gravitation","Properties of Solids and Liquids","Thermodynamics","Kinetic Theory of Gases",
  "Oscillations and Waves","Electrostatics","Current Electricity","Magnetic Effects of Current and Magnetism",
  "Electromagnetic Induction and Alternating Currents","Electromagnetic Waves","Optics",
  "Dual Nature of Matter and Radiation","Atoms and Nuclei","Electronic Devices","Experimental Skills"
];
var CHEMISTRY_CHAPTERS = [
  "Some Basic Concepts of Chemistry","Atomic Structure","Chemical Bonding and Molecular Structure",
  "States of Matter","Chemical Thermodynamics","Equilibrium","Redox Reactions and Electrochemistry",
  "Chemical Kinetics","Solutions","Classification of Elements and Periodicity","p-Block Elements",
  "d and f Block Elements","Coordination Compounds","General Principles of Metallurgy",
  "Basic Principles of Organic Chemistry","Hydrocarbons","Haloalkanes and Haloarenes",
  "Alcohols, Phenols and Ethers","Aldehydes, Ketones and Carboxylic Acids","Amines","Biomolecules and Polymers"
];
var MATH_CHAPTERS = [
  "Sets, Relations and Functions","Complex Numbers and Quadratic Equations","Matrices and Determinants",
  "Permutations and Combinations","Binomial Theorem","Sequences and Series",
  "Limits, Continuity and Differentiability","Integral Calculus","Differential Equations",
  "Coordinate Geometry","Three Dimensional Geometry","Vector Algebra","Statistics and Probability","Trigonometry"
];
var STATUSES = ["Not Started", "In Progress", "Completed"];
var DEFAULT_REVISION_OFFSETS = [7, 14, 30, 60, 120, 240];
var PRIORITY_WEIGHT = { High: 0, Medium: 1, Low: 2 };
var POMODORO_WORK_MINUTES = 50;
var POMODORO_BREAK_MINUTES = 10;
var PROVIDER_DEFAULTS = {
  openai: { model: "gpt-5-mini" },
  gemini: { model: "gemini-flash-latest" },
  claude: { model: "claude-sonnet-5" }
};

var tasks = loadData(STORAGE_KEYS.tasks, []);
var sessions = loadData(STORAGE_KEYS.sessions, []);
var streak = loadData(STORAGE_KEYS.streak, { count: 0, lastDate: null });
var chapters = loadData(STORAGE_KEYS.chapters, []);
var examDates = loadData(STORAGE_KEYS.examDates, { main: "", advanced: "" });
var goalHours = loadData(STORAGE_KEYS.goalHours, null);
var subjectMeta = loadData(STORAGE_KEYS.subjectMeta, { Physics: {}, Chemistry: {}, Mathematics: {} });
var tests = loadData(STORAGE_KEYS.tests, []);
var pomodoroCountData = loadData(STORAGE_KEYS.pomodoroCount, { date: "", count: 0 });
var coachChat = loadData(STORAGE_KEYS.coachChat, []);

function pad2(n) { return n < 10 ? "0" + n : "" + n; }
function fmtDate(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

function defaultPhaseDates() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  var feb28 = new Date(now.getFullYear(), 1, 28);
  if (feb28 < now) feb28 = new Date(now.getFullYear() + 1, 1, 28);
  var p2start = new Date(feb28);
  p2start.setDate(p2start.getDate() + 1);
  var p2end = new Date(p2start.getFullYear() + 2, p2start.getMonth(), p2start.getDate());
  return {
    p1Start: fmtDate(now),
    p1End: fmtDate(feb28),
    p2Start: fmtDate(p2start),
    p2End: fmtDate(p2end)
  };
}
var phaseDates = loadData(STORAGE_KEYS.phaseDates, null);
if (!phaseDates) {
  phaseDates = defaultPhaseDates();
  saveData(STORAGE_KEYS.phaseDates, phaseDates);
}

var currentSubject = "Physics";
var currentLogSubject = "Physics";
var selectedLogChapterId = null;
var selectedModalPriority = "High";

function makeChapter(subject, name) {
  return {
    id: subject + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
    subject: subject, name: name, subtopics: [], startDate: "", target: "", completionDate: "",
    progress: 0, status: "Not Started",
    revisions: [false, false, false, false, false, false],
    revisionOffsets: DEFAULT_REVISION_OFFSETS.slice(),
    extraRevisions: [],
    notes: "", lecturesDone: 0, lecturesTotal: 0
  };
}

function seedChaptersIfNeeded() {
  var seeded = loadData(STORAGE_KEYS.seeded, false);
  if (seeded) return;
  var existingKeys = {};
  chapters.forEach(function (c) { existingKeys[c.subject + "::" + c.name] = true; });
  var toAdd = [];
  PHYSICS_CHAPTERS.forEach(function (n) { if (!existingKeys["Physics::" + n]) toAdd.push(makeChapter("Physics", n)); });
  CHEMISTRY_CHAPTERS.forEach(function (n) { if (!existingKeys["Chemistry::" + n]) toAdd.push(makeChapter("Chemistry", n)); });
  MATH_CHAPTERS.forEach(function (n) { if (!existingKeys["Mathematics::" + n]) toAdd.push(makeChapter("Mathematics", n)); });
  chapters = chapters.concat(toAdd);
  saveData(STORAGE_KEYS.chapters, chapters);
  saveData(STORAGE_KEYS.seeded, true);
}
seedChaptersIfNeeded();

chapters.forEach(function (c) {
  if (typeof c.lecturesDone === "undefined") c.lecturesDone = 0;
  if (typeof c.lecturesTotal === "undefined") c.lecturesTotal = 0;
  if (typeof c.startDate === "undefined") c.startDate = "";
  if (typeof c.completionDate === "undefined") c.completionDate = "";
  if (!c.revisionOffsets || c.revisionOffsets.length !== 6) c.revisionOffsets = DEFAULT_REVISION_OFFSETS.slice();
  if (!c.extraRevisions) c.extraRevisions = [];
  if (!c.revisions || c.revisions.length !== 6) {
    var old = c.revisions || [];
    var next = [false, false, false, false, false, false];
    for (var i = 0; i < old.length && i < 6; i++) next[i] = old[i];
    c.revisions = next;
  }
  if (c.status === "Delayed" || c.status === "Revision Due") c.status = "In Progress";
});
saveData(STORAGE_KEYS.chapters, chapters);

tasks.forEach(function (t) {
  if (typeof t.subject === "undefined") t.subject = "";
  if (typeof t.loggedSessionId === "undefined") t.loggedSessionId = null;
});
saveData(STORAGE_KEYS.tasks, tasks);

function todayStr() { return fmtDate(new Date()); }

function showToast(msg) {
  var toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(function () { toast.classList.remove("show"); }, 2200);
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function statusClass(status) {
  var map = {
    "Not Started": "status-not-started", "In Progress": "status-in-progress",
    "Completed": "status-completed", "Delayed": "status-delayed", "Revision Due": "status-revision"
  };
  return map[status] || "status-not-started";
}

function parseDateStr(dateStr) {
  if (!dateStr) return null;
  var parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
}
function todayMidnight() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function isExtraRevisionOverdue(rev) {
  if (!rev || rev.done || !rev.date) return false;
  var d = parseDateStr(rev.date);
  if (!d) return false;
  return todayMidnight() >= d;
}

function computeDisplayStatus(ch) {
  var today = todayMidnight();
  if (ch.status === "Completed") {
    if (ch.completionDate) {
      var completionD = parseDateStr(ch.completionDate);
      if (completionD) {
        for (var i = 0; i < 6; i++) {
          if (!ch.revisions[i]) {
            var due = new Date(completionD);
            due.setDate(due.getDate() + ch.revisionOffsets[i]);
            if (today >= due) return "Revision Due";
          }
        }
      }
    }
    if (ch.extraRevisions && ch.extraRevisions.length) {
      for (var j = 0; j < ch.extraRevisions.length; j++) {
        if (isExtraRevisionOverdue(ch.extraRevisions[j])) return "Revision Due";
      }
    }
    return "Completed";
  }
  if (ch.target) {
    var targetD = parseDateStr(ch.target);
    if (targetD && today > targetD) return "Delayed";
  }
  return ch.status;
}

function isRevisionOverdue(ch, index) {
  if (ch.status !== "Completed" || !ch.completionDate || ch.revisions[index]) return false;
  var completionD = parseDateStr(ch.completionDate);
  if (!completionD) return false;
  var due = new Date(completionD);
  due.setDate(due.getDate() + ch.revisionOffsets[index]);
  return todayMidnight() >= due;
}

function updateStreak() {
  var today = todayStr();
  if (streak.lastDate === today) return;
  var yesterday = fmtDate(new Date(Date.now() - 86400000));
  streak.count = (streak.lastDate === yesterday) ? streak.count + 1 : 1;
  streak.lastDate = today;
  saveData(STORAGE_KEYS.streak, streak);
}
function renderStreak() { document.getElementById("streakCount").textContent = streak.count; }

function daysBetween(dateStr) {
  var target = parseDateStr(dateStr);
  if (!target) return null;
  return Math.round((target - todayMidnight()) / 86400000);
}
function renderCountdowns() {
  var mainDays = daysBetween(examDates.main);
  var advDays = daysBetween(examDates.advanced);
  document.getElementById("daysMain").textContent = mainDays === null ? "--" : mainDays;
  document.getElementById("daysAdvanced").textContent = advDays === null ? "--" : advDays;
  document.getElementById("examMainDate").value = examDates.main || "";
  document.getElementById("examAdvancedDate").value = examDates.advanced || "";
}
document.getElementById("examMainDate").addEventListener("change", function (e) {
  examDates.main = e.target.value;
  saveData(STORAGE_KEYS.examDates, examDates);
  renderCountdowns();
});
document.getElementById("examAdvancedDate").addEventListener("change", function (e) {
  examDates.advanced = e.target.value;
  saveData(STORAGE_KEYS.examDates, examDates);
  renderCountdowns();
});

function phaseStatusText(startStr, endStr) {
  var start = parseDateStr(startStr);
  var end = parseDateStr(endStr);
  if (!start || !end) return "--";
  var now = todayMidnight();
  if (now < start) return "Starts in " + Math.round((start - now) / 86400000) + "d";
  if (now > end) return "Completed";
  return Math.round((end - now) / 86400000) + " days left";
}
function renderPhases() {
  document.getElementById("phase1Start").value = phaseDates.p1Start || "";
  document.getElementById("phase1End").value = phaseDates.p1End || "";
  document.getElementById("phase2Start").value = phaseDates.p2Start || "";
  document.getElementById("phase2End").value = phaseDates.p2End || "";
  document.getElementById("phase1Status").textContent = phaseStatusText(phaseDates.p1Start, phaseDates.p1End);
  document.getElementById("phase2Status").textContent = phaseStatusText(phaseDates.p2Start, phaseDates.p2End);
}
["phase1Start", "phase1End", "phase2Start", "phase2End"].forEach(function (id) {
  document.getElementById(id).addEventListener("change", function (e) {
    var key = id === "phase1Start" ? "p1Start" : id === "phase1End" ? "p1End" : id === "phase2Start" ? "p2Start" : "p2End";
    phaseDates[key] = e.target.value;
    saveData(STORAGE_KEYS.phaseDates, phaseDates);
    renderPhases();
  });
});

function renderGoal() { document.getElementById("goalHours").value = goalHours === null ? "" : goalHours; }
document.getElementById("goalHours").addEventListener("change", function (e) {
  var val = parseFloat(e.target.value);
  goalHours = isNaN(val) ? null : val;
  saveData(STORAGE_KEYS.goalHours, goalHours);
});

function renderStats() {
  var today = todayStr();
  var todayMinutes = sessions.filter(function (s) { return s.date === today; }).reduce(function (sum, s) { return sum + s.minutes; }, 0);
  var totalMinutes = sessions.reduce(function (sum, s) { return sum + s.minutes; }, 0);
  document.getElementById("todayHours").textContent = (todayMinutes / 60).toFixed(1) + "h";
  document.getElementById("totalHours").textContent = (totalMinutes / 60).toFixed(1) + "h";

  var withProd = sessions.filter(function (s) { return s.productivity > 0; });
  document.getElementById("productivityScore").textContent = withProd.length === 0
    ? "-" : (withProd.reduce(function (sum, s) { return sum + s.productivity; }, 0) / withProd.length).toFixed(1) + "/10";

  var completedCount = chapters.filter(function (c) { return c.status === "Completed"; }).length;
  document.getElementById("chaptersDone").textContent = completedCount + "/" + chapters.length;
}

function coachSubjectReadiness() {
  var result = {};
  ["Physics", "Chemistry", "Mathematics"].forEach(function (sub) {
    var subChapters = chapters.filter(function (c) { return c.subject === sub; });
    if (subChapters.length === 0) { result[sub] = 0; return; }
    result[sub] = Math.round(subChapters.reduce(function (sum, c) { return sum + c.progress; }, 0) / subChapters.length);
  });
  return result;
}

function renderInsight() {
  var el = document.getElementById("coachInsight");
  var today = todayStr();
  var todayMinutes = sessions.filter(function (s) { return s.date === today; }).reduce(function (sum, s) { return sum + s.minutes; }, 0);
  var withDisplay = chapters.map(function (c) { return { ch: c, displayStatus: computeDisplayStatus(c) }; });
  var revisionDue = withDisplay.filter(function (x) { return x.displayStatus === "Revision Due"; });
  var delayed = withDisplay.filter(function (x) { return x.displayStatus === "Delayed"; });
  var readiness = coachSubjectReadiness();
  var weakest = "Physics";
  if (readiness.Chemistry < readiness[weakest]) weakest = "Chemistry";
  if (readiness.Mathematics < readiness[weakest]) weakest = "Mathematics";
  var parts = [];
  parts.push(todayMinutes === 0
    ? "You have not logged any study time today yet."
    : ("You have studied " + (todayMinutes / 60).toFixed(1) + "h today."));
  if (streak.count > 0) parts.push("Your current streak is " + streak.count + " day" + (streak.count > 1 ? "s" : "") + ".");
  if (delayed.length > 0) parts.push(delayed[0].ch.name + " is delayed and needs attention.");
  else if (revisionDue.length > 0) parts.push(revisionDue[0].ch.name + " has a revision due.");
  else parts.push(weakest + " currently has your lowest average progress.");
  el.textContent = parts.join(" ");
}

function renderMiniChapterLists() {
  var withDisplay = chapters.map(function (c) { return { ch: c, displayStatus: computeDisplayStatus(c) }; });

  var inProgress = withDisplay.filter(function (x) { return x.displayStatus === "In Progress"; });
  var inProgressEl = document.getElementById("inProgressList");
  inProgressEl.innerHTML = inProgress.length === 0
    ? "<div class='empty'>No chapters in progress right now.</div>"
    : inProgress.map(function (x) {
      var ch = x.ch;
      return "<div class='mini-chapter'>" +
        "<div class='mini-top'><span class='mini-name'>" + escapeHtml(ch.name) + "</span><span class='mini-percent'>" + ch.progress + "%</span></div>" +
        "<div class='progress-track'><div class='progress-fill' style='width:" + ch.progress + "%'></div></div>" +
        (ch.notes ? "<div class='mini-note'>" + escapeHtml(ch.notes) + "</div>" : "") +
        "</div>";
    }).join("");

  var attention = withDisplay.filter(function (x) { return x.displayStatus === "Delayed" || x.displayStatus === "Revision Due"; });
  var attentionEl = document.getElementById("attentionList");
  attentionEl.innerHTML = attention.length === 0
    ? "<div class='empty'>Nothing needs attention right now.</div>"
    : attention.map(function (x) {
      var ch = x.ch;
      var note = x.displayStatus === "Delayed"
        ? (ch.target ? "Target date was " + ch.target + ". Backlog recovery needed." : "Backlog recovery needed.")
        : "Revision checkpoint overdue.";
      return "<div class='mini-chapter attention-item'>" +
        "<div class='mini-top'><span class='mini-name'>" + escapeHtml(ch.name) + "</span><span class='mini-status " + statusClass(x.displayStatus) + "'>" + x.displayStatus + "</span></div>" +
        "<div class='mini-note'>" + note + "</div>" +
        "</div>";
    }).join("");
}

function createdDateStr(task) {
  var ts = parseInt(task.id, 10);
  if (isNaN(ts)) return todayStr();
  return fmtDate(new Date(ts));
}

function escalatePendingTaskPriorities() {
  var now = Date.now();
  var changed = false;
  tasks.forEach(function (t) {
    if (t.done) return;
    var created = parseInt(t.id, 10);
    if (isNaN(created)) return;
    var ageDays = Math.floor((now - created) / 86400000);
    if (ageDays >= 4 && t.priority !== "High") { t.priority = "High"; changed = true; }
    else if (ageDays >= 2 && t.priority === "Low") { t.priority = "Medium"; changed = true; }
  });
  if (changed) saveData(STORAGE_KEYS.tasks, tasks);
}

function sortByPriority(list) {
  return list.slice().sort(function (a, b) {
    var wa = PRIORITY_WEIGHT[a.priority] === undefined ? 1 : PRIORITY_WEIGHT[a.priority];
    var wb = PRIORITY_WEIGHT[b.priority] === undefined ? 1 : PRIORITY_WEIGHT[b.priority];
    return wa - wb;
  });
}

function priorityDotClass(priority) {
  if (priority === "Medium") return "priority-dot medium";
  if (priority === "Low") return "priority-dot low";
  return "priority-dot";
}

function renderTaskLi(task) {
  var metaBits = [];
  if (task.subject) metaBits.push("<span>" + escapeHtml(task.subject) + "</span>");
  if (task.priority) metaBits.push("<span>" + escapeHtml(task.priority) + "</span>");
  if (task.minutes) metaBits.push("<span>" + task.minutes + " mins</span>");
  return "<li class='task-item" + (task.done ? " done" : "") + "'>" +
    "<label class='task-check'>" +
    "<input type='checkbox' " + (task.done ? "checked" : "") + " data-id='" + task.id + "'>" +
    "<span class='task-body'>" +
    "<span class='task-text'>" + escapeHtml(task.text) + "</span>" +
    "<span class='task-meta'>" + metaBits.join(" &middot; ") + "</span>" +
    "</span>" +
    "</label>" +
    "<span class='task-right'>" +
    "<span class='" + priorityDotClass(task.priority) + "'></span>" +
    "<button class='task-delete' data-id='" + task.id + "'>&#10005;</button>" +
    "</span>" +
    "</li>";
}

function renderTasks() {
  var today = todayStr();
  var todayTasks = tasks.filter(function (t) { return createdDateStr(t) === today; });
  var rolloverTasks = tasks.filter(function (t) { return !t.done && createdDateStr(t) !== today; });

  document.getElementById("todoCount").textContent = todayTasks.filter(function (t) { return !t.done; }).length;
  document.getElementById("pendingRolloverCount").textContent = rolloverTasks.length;

  var todoList = document.getElementById("todoTodayList");
  todoList.innerHTML = todayTasks.length === 0
    ? "<li class='empty'>No tasks added today yet. Tap + Add Task above.</li>"
    : sortByPriority(todayTasks).map(renderTaskLi).join("");

  var rolloverList = document.getElementById("pendingRolloverList");
  rolloverList.innerHTML = rolloverTasks.length === 0
    ? "<li class='empty'>Nothing rolled over. Great job staying on top of things.</li>"
    : sortByPriority(rolloverTasks).map(renderTaskLi).join("");
}

function handleTaskCheckboxClick(cb) {
  var task = tasks.find(function (t) { return t.id === cb.dataset.id; });
  if (!task) return;
  var wasDone = task.done;
  task.done = cb.checked;
  if (task.done && !wasDone) {
    var newSession = {
      id: Date.now().toString(), subject: task.subject || "General",
      chapterId: null, chapterName: task.text,
      minutes: task.minutes || 0, questions: 0, pages: 0, productivity: 0,
      notes: "Auto-logged from completed task.", date: todayStr()
    };
    sessions.push(newSession);
    task.loggedSessionId = newSession.id;
    saveData(STORAGE_KEYS.sessions, sessions);
    updateStreak();
    renderSessions(); renderStats(); renderStreak(); renderInsight();
    showToast("Task completed and logged to Daily Log");
  } else if (!task.done && wasDone && task.loggedSessionId) {
    sessions = sessions.filter(function (s) { return s.id !== task.loggedSessionId; });
    task.loggedSessionId = null;
    saveData(STORAGE_KEYS.sessions, sessions);
    renderSessions(); renderStats(); renderInsight();
  }
  saveData(STORAGE_KEYS.tasks, tasks);
  renderTasks();
}
function handleTaskDeleteClick(delBtn) {
  tasks = tasks.filter(function (t) { return t.id !== delBtn.dataset.id; });
  saveData(STORAGE_KEYS.tasks, tasks);
  renderTasks();
}
function taskListClickHandler(e) {
  var cb = e.target.matches("input[type='checkbox']") ? e.target : null;
  var delBtn = e.target.closest(".task-delete");
  if (cb) handleTaskCheckboxClick(cb);
  else if (delBtn) handleTaskDeleteClick(delBtn);
}
document.getElementById("todoTodayList").addEventListener("click", taskListClickHandler);
document.getElementById("pendingRolloverList").addEventListener("click", taskListClickHandler);

var taskModalOverlay = document.getElementById("taskModalOverlay");
document.getElementById("openTaskModalBtn").addEventListener("click", function () {
  document.getElementById("modalTaskInput").value = "";
  document.getElementById("modalTaskSubject").value = "";
  document.getElementById("modalTaskMinutes").value = "60";
  selectedModalPriority = "High";
  document.querySelectorAll(".priority-btn").forEach(function (b) {
    b.classList.toggle("active", b.dataset.priority === "High");
  });
  taskModalOverlay.style.display = "flex";
});
document.getElementById("cancelTaskBtn").addEventListener("click", function () {
  taskModalOverlay.style.display = "none";
});
document.querySelectorAll(".priority-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    selectedModalPriority = btn.dataset.priority;
    document.querySelectorAll(".priority-btn").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
  });
});
document.getElementById("saveTaskBtn").addEventListener("click", function () {
  var textInput = document.getElementById("modalTaskInput");
  var subjectInput = document.getElementById("modalTaskSubject");
  var minutesInput = document.getElementById("modalTaskMinutes");
  var text = textInput.value.trim();
  if (!text) return;
  tasks.push({
    id: Date.now().toString(), text: text, subject: subjectInput.value, priority: selectedModalPriority,
    minutes: parseInt(minutesInput.value, 10) || 0, done: false, loggedSessionId: null
  });
  saveData(STORAGE_KEYS.tasks, tasks);
  taskModalOverlay.style.display = "none";
  renderTasks();
});

function renderCommandCenter() {
  document.getElementById("commandTitle").textContent = currentSubject + " Command Center";
  document.getElementById("subjectTarget").value = (subjectMeta[currentSubject] && subjectMeta[currentSubject].target) || "";
  var subChapters = chapters.filter(function (c) { return c.subject === currentSubject; });
  document.getElementById("totalChapters").textContent = subChapters.length;
  document.getElementById("completedChapters").textContent = subChapters.filter(function (c) { return c.status === "Completed"; }).length;
  var avg = subChapters.length === 0 ? 0 : Math.round(subChapters.reduce(function (sum, c) { return sum + c.progress; }, 0) / subChapters.length);
  document.getElementById("avgProgress").textContent = avg + "%";
}
document.getElementById("subjectTarget").addEventListener("change", function (e) {
  if (!subjectMeta[currentSubject]) subjectMeta[currentSubject] = {};
  subjectMeta[currentSubject].target = e.target.value;
  saveData(STORAGE_KEYS.subjectMeta, subjectMeta);
});

function renderChapters() {
  renderCommandCenter();
  var list = document.getElementById("chapterList");
  var filtered = chapters.filter(function (c) { return c.subject === currentSubject; });
  if (filtered.length === 0) {
    list.innerHTML = "<div class='empty'>No chapters yet for this subject.</div>";
    return;
  }
  list.innerHTML = filtered.map(function (ch) {
    var displayStatus = computeDisplayStatus(ch);
    var subtopicsHtml = (ch.subtopics && ch.subtopics.length)
      ? "<div class='subtopics-row'>" + ch.subtopics.map(function (s) { return "<span>&bull; " + escapeHtml(s) + "</span>"; }).join(" ") + "</div>" : "";
    var extraRevisionsHtml = (ch.extraRevisions && ch.extraRevisions.length)
      ? ch.extraRevisions.map(function (rev) {
        var cls = "extra-revision-chip" + (rev.done ? " done" : "") + (isExtraRevisionOverdue(rev) ? " overdue" : "");
        return "<span class='" + cls + "'>" +
          "<button class='extra-revision-toggle' data-id='" + ch.id + "' data-revid='" + rev.id + "'>" + (rev.done ? "&#10003;" : "&#9675;") + "</button>" +
          "<span>" + rev.date + "</span>" +
          "<button class='extra-revision-delete' data-id='" + ch.id + "' data-revid='" + rev.id + "'>&#10005;</button>" +
          "</span>";
      }).join("")
      : "<span class='empty-inline'>No extra revisions added</span>";
    return "<div class='chapter-card'>" +
      "<div class='chapter-top'>" +
      "<div class='chapter-title'>" + escapeHtml(ch.name) + "</div>" +
      "<button class='chapter-delete' data-id='" + ch.id + "'>&#10005;</button>" +
      "</div>" +
      "<div class='chapter-meta'>" +
      "<span class='status-badge " + statusClass(displayStatus) + "'>" + displayStatus + "</span>" +
      "</div>" +
      subtopicsHtml +
      "<div class='date-fields-row'>" +
      "<label class='date-field'>Start<input type='date' class='chapter-start-input' data-id='" + ch.id + "' value='" + (ch.startDate || "") + "'></label>" +
      "<label class='date-field'>Target<input type='date' class='chapter-target-input' data-id='" + ch.id + "' value='" + (ch.target || "") + "'></label>" +
      "</div>" +
      (ch.completionDate ? "<div class='completion-note'>Completed on " + ch.completionDate + "</div>" : "") +
      "<div class='progress-track'><div class='progress-fill' style='width:" + ch.progress + "%'></div></div>" +
      "<div class='progress-row'>" +
      "<input type='range' class='progress-slider' data-id='" + ch.id + "' min='0' max='100' value='" + ch.progress + "'>" +
      "<span class='progress-label'>" + ch.progress + "%</span>" +
      "</div>" +
      "<div class='lecture-row'>" +
      "<span>Lectures:</span>" +
      "<input type='number' class='lecture-input lecture-done-input' data-id='" + ch.id + "' min='0' value='" + ch.lecturesDone + "'>" +
      "<span>/</span>" +
      "<input type='number' class='lecture-input lecture-total-input' data-id='" + ch.id + "' min='0' value='" + ch.lecturesTotal + "'>" +
      "</div>" +
      "<div class='revision-row'>" +
      [0, 1, 2, 3, 4, 5].map(function (i) {
        var cls = "revision-chip" + (ch.revisions[i] ? " done" : "") + (isRevisionOverdue(ch, i) ? " overdue" : "");
        return "<button class='" + cls + "' data-id='" + ch.id + "' data-rev='" + i + "'>R" + (i + 1) + "</button>";
      }).join("") +
      "</div>" +
      "<div class='revision-offsets-row'>" +
      [0, 1, 2, 3, 4, 5].map(function (i) {
        return "<label class='revision-offset-field'>R" + (i + 1) + "d<input type='number' class='revision-offset-input' data-id='" + ch.id + "' data-rev='" + i + "' min='1' value='" + ch.revisionOffsets[i] + "'></label>";
      }).join("") +
      "</div>" +
      "<div class='extra-revisions-row'>" + extraRevisionsHtml + "</div>" +
      "<div class='add-revision-row'>" +
      "<input type='date' class='extra-revision-date-input' data-id='" + ch.id + "'>" +
      "<button type='button' class='add-extra-revision-btn' data-id='" + ch.id + "'>+ Add Revision Date</button>" +
      "</div>" +
      "<div class='status-btn-row'>" +
      STATUSES.map(function (s) {
        return "<button class='status-btn " + (s === ch.status ? "active" : "") + "' data-id='" + ch.id + "' data-status='" + s + "'>" + s + "</button>";
      }).join("") +
      "</div>" +
      "<input type='text' class='chapter-note-input' data-id='" + ch.id + "' placeholder='Note (optional)' value='" + escapeHtml(ch.notes || "") + "'>" +
      "</div>";
  }).join("");
}

document.getElementById("chapterForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var nameInput = document.getElementById("chapterName");
  var subtopicsInput = document.getElementById("chapterSubtopics");
  var startInput = document.getElementById("chapterStartDate");
  var targetInput = document.getElementById("chapterTarget");
  var name = nameInput.value.trim();
  if (!name) return;
  var subtopics = subtopicsInput.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  chapters.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    subject: currentSubject, name: name, subtopics: subtopics,
    startDate: startInput.value || "", target: targetInput.value || "", completionDate: "",
    progress: 0, status: "Not Started",
    revisions: [false, false, false, false, false, false],
    revisionOffsets: DEFAULT_REVISION_OFFSETS.slice(),
    extraRevisions: [],
    notes: "", lecturesDone: 0, lecturesTotal: 0
  });
  saveData(STORAGE_KEYS.chapters, chapters);
  nameInput.value = ""; subtopicsInput.value = ""; startInput.value = ""; targetInput.value = "";
  renderChapters();
  renderStats();
});

document.getElementById("chapterList").addEventListener("click", function (e) {
  var delBtn = e.target.closest(".chapter-delete");
  var revBtn = e.target.closest(".revision-chip");
  var statusBtn = e.target.closest(".status-btn");
  var extraToggle = e.target.closest(".extra-revision-toggle");
  var extraDelete = e.target.closest(".extra-revision-delete");
  var addExtraBtn = e.target.closest(".add-extra-revision-btn");

  if (extraToggle) {
    var chET = chapters.find(function (c) { return c.id === extraToggle.dataset.id; });
    if (chET) {
      var revT = chET.extraRevisions.find(function (r) { return r.id === extraToggle.dataset.revid; });
      if (revT) revT.done = !revT.done;
    }
    saveData(STORAGE_KEYS.chapters, chapters);
    renderChapters(); renderMiniChapterLists(); renderInsight();
    return;
  }
  if (extraDelete) {
    var chED = chapters.find(function (c) { return c.id === extraDelete.dataset.id; });
    if (chED) chED.extraRevisions = chED.extraRevisions.filter(function (r) { return r.id !== extraDelete.dataset.revid; });
    saveData(STORAGE_KEYS.chapters, chapters);
    renderChapters(); renderMiniChapterLists();
    return;
  }
  if (addExtraBtn) {
    var chAdd = chapters.find(function (c) { return c.id === addExtraBtn.dataset.id; });
    var card = addExtraBtn.closest(".chapter-card");
    var dateInput = card ? card.querySelector(".extra-revision-date-input") : null;
    if (chAdd && dateInput && dateInput.value) {
      chAdd.extraRevisions.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date: dateInput.value, done: false });
      saveData(STORAGE_KEYS.chapters, chapters);
      renderChapters(); renderMiniChapterLists(); renderInsight();
    }
    return;
  }

  if (delBtn) {
    chapters = chapters.filter(function (c) { return c.id !== delBtn.dataset.id; });
  } else if (revBtn) {
    var ch = chapters.find(function (c) { return c.id === revBtn.dataset.id; });
    if (ch) ch.revisions[parseInt(revBtn.dataset.rev, 10)] = !ch.revisions[parseInt(revBtn.dataset.rev, 10)];
  } else if (statusBtn) {
    var ch2 = chapters.find(function (c) { return c.id === statusBtn.dataset.id; });
    if (ch2) {
      ch2.status = statusBtn.dataset.status;
      if (ch2.status === "Completed") {
        ch2.progress = 100;
        if (!ch2.completionDate) ch2.completionDate = todayStr();
      }
    }
  } else { return; }
  saveData(STORAGE_KEYS.chapters, chapters);
  renderChapters();
  renderMiniChapterLists();
  renderStats();
  renderInsight();
});
document.getElementById("chapterList").addEventListener("input", function (e) {
  if (e.target.classList.contains("progress-slider")) {
    var ch = chapters.find(function (c) { return c.id === e.target.dataset.id; });
    if (ch) {
      ch.progress = parseInt(e.target.value, 10);
      var card = e.target.closest(".chapter-card");
      card.querySelector(".progress-fill").style.width = ch.progress + "%";
      card.querySelector(".progress-label").textContent = ch.progress + "%";
    }
  }
});
document.getElementById("chapterList").addEventListener("change", function (e) {
  if (e.target.classList.contains("progress-slider")) {
    var ch = chapters.find(function (c) { return c.id === e.target.dataset.id; });
    if (ch && ch.progress === 100 && ch.status !== "Completed") {
      ch.status = "Completed";
      if (!ch.completionDate) ch.completionDate = todayStr();
    }
    saveData(STORAGE_KEYS.chapters, chapters);
    renderChapters(); renderMiniChapterLists(); renderStats(); renderInsight();
  }
  if (e.target.classList.contains("chapter-note-input")) {
    var chN = chapters.find(function (c) { return c.id === e.target.dataset.id; });
    if (chN) { chN.notes = e.target.value; saveData(STORAGE_KEYS.chapters, chapters); renderMiniChapterLists(); }
  }
  if (e.target.classList.contains("chapter-start-input")) {
    var chS = chapters.find(function (c) { return c.id === e.target.dataset.id; });
    if (chS) {
      chS.startDate = e.target.value;
      saveData(STORAGE_KEYS.chapters, chapters);
      renderChapters(); renderMiniChapterLists(); renderInsight();
    }
  }
  if (e.target.classList.contains("chapter-target-input")) {
    var chT = chapters.find(function (c) { return c.id === e.target.dataset.id; });
    if (chT) {
      chT.target = e.target.value;
      saveData(STORAGE_KEYS.chapters, chapters);
      renderChapters(); renderMiniChapterLists(); renderInsight();
    }
  }
  if (e.target.classList.contains("lecture-done-input") || e.target.classList.contains("lecture-total-input")) {
    var chL = chapters.find(function (c) { return c.id === e.target.dataset.id; });
    if (chL) {
      var val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      if (e.target.classList.contains("lecture-done-input")) chL.lecturesDone = val;
      else chL.lecturesTotal = val;
      saveData(STORAGE_KEYS.chapters, chapters);
    }
  }
  if (e.target.classList.contains("revision-offset-input")) {
    var chR = chapters.find(function (c) { return c.id === e.target.dataset.id; });
    if (chR) {
      var idx = parseInt(e.target.dataset.rev, 10);
      var days = parseInt(e.target.value, 10);
      if (isNaN(days) || days < 1) days = 1;
      chR.revisionOffsets[idx] = days;
      saveData(STORAGE_KEYS.chapters, chapters);
      renderChapters(); renderMiniChapterLists();
    }
  }
});

document.getElementById("subjectTabs").addEventListener("click", function (e) {
  var btn = e.target.closest(".subject-tab");
  if (!btn) return;
  currentSubject = btn.dataset.subject;
  this.querySelectorAll(".subject-tab").forEach(function (b) { b.classList.remove("active"); });
  btn.classList.add("active");
  renderChapters();
});

function renderLogChapterChips() {
  var container = document.getElementById("logChapterChips");
  var subChapters = chapters.filter(function (c) { return c.subject === currentLogSubject; });
  if (subChapters.length === 0) {
    container.innerHTML = "<div class='empty'>No chapters for this subject yet, add some in Syllabus.</div>";
    selectedLogChapterId = null;
    return;
  }
  if (!subChapters.find(function (c) { return c.id === selectedLogChapterId; })) selectedLogChapterId = subChapters[0].id;
  container.innerHTML = subChapters.map(function (ch) {
    return "<button type='button' class='chip" + (ch.id === selectedLogChapterId ? " active" : "") + "' data-id='" + ch.id + "'>" + escapeHtml(ch.name) + "</button>";
  }).join("");
}
document.getElementById("logSubjectTabs").addEventListener("click", function (e) {
  var btn = e.target.closest(".subject-tab");
  if (!btn) return;
  currentLogSubject = btn.dataset.subject;
  selectedLogChapterId = null;
  this.querySelectorAll(".subject-tab").forEach(function (b) { b.classList.remove("active"); });
  btn.classList.add("active");
  renderLogChapterChips();
});
document.getElementById("logChapterChips").addEventListener("click", function (e) {
  var chip = e.target.closest(".chip");
  if (!chip) return;
  selectedLogChapterId = chip.dataset.id;
  this.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
  chip.classList.add("active");
});

function renderSessions() {
  var list = document.getElementById("sessionList");
  if (sessions.length === 0) {
    list.innerHTML = "<li class='empty'>No study sessions logged yet.</li>";
    return;
  }
  list.innerHTML = sessions.slice().reverse().slice(0, 15).map(function (s) {
    var metaBits = [];
    if (s.questions) metaBits.push("Questions: " + s.questions);
    if (s.pages) metaBits.push("Pages: " + s.pages);
    if (s.productivity) metaBits.push("Productivity: " + s.productivity + "/10");
    return "<li class='session-item-full'>" +
      "<div class='session-top'>" +
      "<span class='session-subject'>" + escapeHtml(s.subject) + " &middot; " + s.date + "</span>" +
      "<span class='session-minutes'>" + s.minutes + " mins</span>" +
      "</div>" +
      "<div class='session-chapter'>" + escapeHtml(s.chapterName || "") + "</div>" +
      (metaBits.length ? "<div class='session-meta'>" + metaBits.join(" &middot; ") + "</div>" : "") +
      (s.notes ? "<div class='session-notes'>" + escapeHtml(s.notes) + "</div>" : "") +
      "</li>";
  }).join("");
}

document.getElementById("sessionForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var minutesInput = document.getElementById("sessionMinutes");
  var questionsInput = document.getElementById("sessionQuestions");
  var pagesInput = document.getElementById("sessionPages");
  var productivityInput = document.getElementById("sessionProductivity");
  var notesInput = document.getElementById("sessionNotes");
  var minutes = parseInt(minutesInput.value, 10);
  if (!minutes || minutes <= 0) return;
  var chapter = chapters.find(function (c) { return c.id === selectedLogChapterId; });
  sessions.push({
    id: Date.now().toString(), subject: currentLogSubject,
    chapterId: selectedLogChapterId, chapterName: chapter ? chapter.name : "",
    minutes: minutes, questions: parseInt(questionsInput.value, 10) || 0,
    pages: parseInt(pagesInput.value, 10) || 0,
    productivity: parseInt(productivityInput.value, 10) || 0,
    notes: notesInput.value.trim(), date: todayStr()
  });
  saveData(STORAGE_KEYS.sessions, sessions);
  updateStreak();
  minutesInput.value = ""; questionsInput.value = ""; pagesInput.value = "";
  productivityInput.value = ""; notesInput.value = "";
  renderSessions(); renderStats(); renderStreak(); renderInsight();
  showToast("Study session logged");
});

function getLocalNotifications() {
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      return window.Capacitor.Plugins.LocalNotifications;
    }
  } catch (e) {}
  return null;
}
var notifPermissionRequested = false;
function ensureNotifPermission() {
  var LN = getLocalNotifications();
  if (!LN || notifPermissionRequested) return;
  notifPermissionRequested = true;
  try { LN.requestPermissions(); } catch (e) {}
}
function schedulePomodoroNotification(title, body, atTimestamp) {
  var LN = getLocalNotifications();
  var noteEl = document.getElementById("pomodoroNotifNote");
  if (!LN) {
    if (noteEl) noteEl.textContent = "Background alert unavailable on this build; keep the app open for alerts.";
    return;
  }
  try {
    LN.schedule({ notifications: [{ id: 9001, title: title, body: body, schedule: { at: new Date(atTimestamp) } }] });
    if (noteEl) noteEl.textContent = "You'll get a notification even if you close the app.";
  } catch (e) {
    if (noteEl) noteEl.textContent = "Background alert unavailable on this build; keep the app open for alerts.";
  }
}
function cancelPomodoroNotification() {
  var LN = getLocalNotifications();
  if (!LN) return;
  try { LN.cancel({ notifications: [{ id: 9001 }] }); } catch (e) {}
}

var stopwatchTickInterval = null;
var stopwatchState = loadData(STORAGE_KEYS.stopwatchState, { running: false, startAt: 0, accumulatedMs: 0 });

function formatStopwatch(ms) {
  var totalSeconds = Math.floor(ms / 1000);
  var h = Math.floor(totalSeconds / 3600);
  var m = Math.floor((totalSeconds % 3600) / 60);
  var s = totalSeconds % 60;
  return pad2(h) + ":" + pad2(m) + ":" + pad2(s);
}
function currentStopwatchElapsed() {
  return stopwatchState.accumulatedMs + (stopwatchState.running ? (Date.now() - stopwatchState.startAt) : 0);
}
function updateStopwatchDisplay() {
  document.getElementById("stopwatchDisplay").textContent = formatStopwatch(currentStopwatchElapsed());
  document.getElementById("stopwatchStartBtn").disabled = stopwatchState.running;
  document.getElementById("stopwatchPauseBtn").disabled = !stopwatchState.running;
}
function startStopwatchInterval() {
  if (stopwatchTickInterval) clearInterval(stopwatchTickInterval);
  if (stopwatchState.running) stopwatchTickInterval = setInterval(updateStopwatchDisplay, 500);
}
document.getElementById("stopwatchStartBtn").addEventListener("click", function () {
  if (stopwatchState.running) return;
  stopwatchState.running = true;
  stopwatchState.startAt = Date.now();
  saveData(STORAGE_KEYS.stopwatchState, stopwatchState);
  startStopwatchInterval();
  updateStopwatchDisplay();
});
document.getElementById("stopwatchPauseBtn").addEventListener("click", function () {
  if (!stopwatchState.running) return;
  stopwatchState.accumulatedMs += Date.now() - stopwatchState.startAt;
  stopwatchState.running = false;
  saveData(STORAGE_KEYS.stopwatchState, stopwatchState);
  if (stopwatchTickInterval) clearInterval(stopwatchTickInterval);
  updateStopwatchDisplay();
});
document.getElementById("stopwatchResetBtn").addEventListener("click", function () {
  stopwatchState = { running: false, startAt: 0, accumulatedMs: 0 };
  saveData(STORAGE_KEYS.stopwatchState, stopwatchState);
  if (stopwatchTickInterval) clearInterval(stopwatchTickInterval);
  updateStopwatchDisplay();
});
document.getElementById("stopwatchUseBtn").addEventListener("click", function () {
  var mins = Math.round(currentStopwatchElapsed() / 60000);
  if (mins < 1) mins = 1;
  document.getElementById("sessionMinutes").value = mins;
  showToast("Stopwatch time applied: " + mins + " mins");
});

var pomodoroTickInterval = null;
var pomodoroState = loadData(STORAGE_KEYS.pomodoroState, {
  running: false, mode: "work", endAt: 0, remainingSeconds: POMODORO_WORK_MINUTES * 60
});

function formatPomodoro(totalSeconds) {
  var s = Math.max(0, totalSeconds);
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return pad2(m) + ":" + pad2(sec);
}
function ensurePomodoroCountToday() {
  if (pomodoroCountData.date !== todayStr()) {
    pomodoroCountData = { date: todayStr(), count: 0 };
    saveData(STORAGE_KEYS.pomodoroCount, pomodoroCountData);
  }
}
function renderPomodoroCount() {
  ensurePomodoroCountToday();
  document.getElementById("pomodoroCount").textContent = pomodoroCountData.count;
}
function catchUpPomodoro() {
  if (!pomodoroState.running) return;
  var safetyLimit = 200;
  while (pomodoroState.endAt > 0 && Date.now() >= pomodoroState.endAt && safetyLimit > 0) {
    safetyLimit -= 1;
    if (pomodoroState.mode === "work") {
      ensurePomodoroCountToday();
      pomodoroCountData.count += 1;
      saveData(STORAGE_KEYS.pomodoroCount, pomodoroCountData);
      pomodoroState.mode = "break";
      pomodoroState.endAt = pomodoroState.endAt + POMODORO_BREAK_MINUTES * 60000;
    } else {
      pomodoroState.mode = "work";
      pomodoroState.endAt = pomodoroState.endAt + POMODORO_WORK_MINUTES * 60000;
    }
  }
  saveData(STORAGE_KEYS.pomodoroState, pomodoroState);
}
function updatePomodoroDisplay() {
  catchUpPomodoro();
  var remaining = pomodoroState.running
    ? Math.max(0, Math.round((pomodoroState.endAt - Date.now()) / 1000))
    : pomodoroState.remainingSeconds;
  document.getElementById("pomodoroDisplay").textContent = formatPomodoro(remaining);
  document.getElementById("pomodoroMode").textContent = pomodoroState.mode === "work" ? "Work Session" : "Break";
  document.getElementById("pomodoroStartBtn").disabled = pomodoroState.running;
  document.getElementById("pomodoroPauseBtn").disabled = !pomodoroState.running;
  renderPomodoroCount();
}
function startPomodoroInterval() {
  if (pomodoroTickInterval) clearInterval(pomodoroTickInterval);
  if (pomodoroState.running) pomodoroTickInterval = setInterval(updatePomodoroDisplay, 1000);
}
document.getElementById("pomodoroStartBtn").addEventListener("click", function () {
  if (pomodoroState.running) return;
  ensureNotifPermission();
  var seconds = pomodoroState.remainingSeconds > 0 ? pomodoroState.remainingSeconds : (pomodoroState.mode === "work" ? POMODORO_WORK_MINUTES * 60 : POMODORO_BREAK_MINUTES * 60);
  pomodoroState.running = true;
  pomodoroState.endAt = Date.now() + seconds * 1000;
  saveData(STORAGE_KEYS.pomodoroState, pomodoroState);
  var title = pomodoroState.mode === "work" ? "Work session complete" : "Break over";
  var body = pomodoroState.mode === "work" ? "Time for a " + POMODORO_BREAK_MINUTES + " min break." : "Back to a " + POMODORO_WORK_MINUTES + " min work session.";
  schedulePomodoroNotification(title, body, pomodoroState.endAt);
  startPomodoroInterval();
  updatePomodoroDisplay();
});
document.getElementById("pomodoroPauseBtn").addEventListener("click", function () {
  if (!pomodoroState.running) return;
  pomodoroState.remainingSeconds = Math.max(0, Math.round((pomodoroState.endAt - Date.now()) / 1000));
  pomodoroState.running = false;
  pomodoroState.endAt = 0;
  saveData(STORAGE_KEYS.pomodoroState, pomodoroState);
  cancelPomodoroNotification();
  if (pomodoroTickInterval) clearInterval(pomodoroTickInterval);
  updatePomodoroDisplay();
});
document.getElementById("pomodoroResetBtn").addEventListener("click", function () {
  pomodoroState = { running: false, mode: "work", endAt: 0, remainingSeconds: POMODORO_WORK_MINUTES * 60 };
  saveData(STORAGE_KEYS.pomodoroState, pomodoroState);
  cancelPomodoroNotification();
  if (pomodoroTickInterval) clearInterval(pomodoroTickInterval);
  updatePomodoroDisplay();
});

function renderMistakeClassification() {
  var totals = { conceptual: 0, calculation: 0, silly: 0, time: 0, guessing: 0 };
  tests.forEach(function (t) {
    totals.conceptual += t.errConceptual || 0;
    totals.calculation += t.errCalculation || 0;
    totals.silly += t.errSilly || 0;
    totals.time += t.errTime || 0;
    totals.guessing += t.errGuessing || 0;
  });
  document.getElementById("mistakeConceptual").textContent = totals.conceptual;
  document.getElementById("mistakeCalculation").textContent = totals.calculation;
  document.getElementById("mistakeSilly").textContent = totals.silly;
  document.getElementById("mistakeTime").textContent = totals.time;
  document.getElementById("mistakeGuessing").textContent = totals.guessing;
}

function renderTests() {
  renderMistakeClassification();
  var list = document.getElementById("testList");
  if (tests.length === 0) {
    list.innerHTML = "<div class='empty'>No tests logged yet.</div>";
    return;
  }
  list.innerHTML = tests.slice().reverse().map(function (t) {
    var pct = t.totalMarks > 0 ? ((t.marksObtained / t.totalMarks) * 100).toFixed(1) : "0.0";
    return "<div class='test-card'>" +
      "<div class='test-top'>" +
      "<span class='test-name'>" + escapeHtml(t.name) + "</span>" +
      "<span class='test-score'>" + t.marksObtained + "/" + t.totalMarks + " (" + pct + "%)</span>" +
      "</div>" +
      "<div class='test-meta'>" +
      "<span class='test-type-tag'>" + escapeHtml(t.type) + "</span>" +
      "<span>" + t.date + "</span>" +
      (t.accuracy ? "<span>Accuracy: " + t.accuracy + "%</span>" : "") +
      (t.timeTaken ? "<span>" + t.timeTaken + " mins</span>" : "") +
      "</div>" +
      (t.chaptersCovered ? "<div class='session-meta'>" + escapeHtml(t.chaptersCovered) + "</div>" : "") +
      "<div class='test-error-chips'>" +
      "<span class='test-error-chip'>Concept: " + (t.errConceptual || 0) + "</span>" +
      "<span class='test-error-chip'>Calc: " + (t.errCalculation || 0) + "</span>" +
      "<span class='test-error-chip'>Silly: " + (t.errSilly || 0) + "</span>" +
      "<span class='test-error-chip'>Time: " + (t.errTime || 0) + "</span>" +
      "<span class='test-error-chip'>Guess: " + (t.errGuessing || 0) + "</span>" +
      "</div>" +
      "</div>";
  }).join("");
}

var testModalOverlay = document.getElementById("testModalOverlay");
document.getElementById("openTestModalBtn").addEventListener("click", function () {
  document.getElementById("modalTestName").value = "";
  document.getElementById("modalTestType").value = "Mock Test";
  document.getElementById("modalTestDate").value = todayStr();
  document.getElementById("modalTestTotalMarks").value = "";
  document.getElementById("modalTestMarksObtained").value = "";
  document.getElementById("modalTestAccuracy").value = "";
  document.getElementById("modalTestTime").value = "";
  document.getElementById("modalTestChapters").value = "";
  document.getElementById("modalErrConceptual").value = "0";
  document.getElementById("modalErrCalculation").value = "0";
  document.getElementById("modalErrSilly").value = "0";
  document.getElementById("modalErrTime").value = "0";
  document.getElementById("modalErrGuessing").value = "0";
  testModalOverlay.style.display = "flex";
});
document.getElementById("cancelTestBtn").addEventListener("click", function () {
  testModalOverlay.style.display = "none";
});
document.getElementById("saveTestBtn").addEventListener("click", function () {
  var name = document.getElementById("modalTestName").value.trim();
  var totalMarks = parseInt(document.getElementById("modalTestTotalMarks").value, 10);
  if (!name || !totalMarks) return;
  tests.push({
    id: Date.now().toString(),
    name: name,
    type: document.getElementById("modalTestType").value,
    date: document.getElementById("modalTestDate").value || todayStr(),
    totalMarks: totalMarks,
    marksObtained: parseInt(document.getElementById("modalTestMarksObtained").value, 10) || 0,
    accuracy: parseInt(document.getElementById("modalTestAccuracy").value, 10) || 0,
    timeTaken: parseInt(document.getElementById("modalTestTime").value, 10) || 0,
    chaptersCovered: document.getElementById("modalTestChapters").value.trim(),
    errConceptual: parseInt(document.getElementById("modalErrConceptual").value, 10) || 0,
    errCalculation: parseInt(document.getElementById("modalErrCalculation").value, 10) || 0,
    errSilly: parseInt(document.getElementById("modalErrSilly").value, 10) || 0,
    errTime: parseInt(document.getElementById("modalErrTime").value, 10) || 0,
    errGuessing: parseInt(document.getElementById("modalErrGuessing").value, 10) || 0
  });
  saveData(STORAGE_KEYS.tests, tests);
  testModalOverlay.style.display = "none";
  renderTests();
  showToast("Test logged");
});

function defaultAiConfig() {
  return {
    provider: "gemini",
    openai: { apiKey: "", model: PROVIDER_DEFAULTS.openai.model },
    gemini: { apiKey: "", model: PROVIDER_DEFAULTS.gemini.model },
    claude: { apiKey: "", model: PROVIDER_DEFAULTS.claude.model }
  };
}
function loadAiConfig() {
  var cfg = loadData(STORAGE_KEYS.aiConfig, null);
  if (!cfg) { cfg = defaultAiConfig(); saveData(STORAGE_KEYS.aiConfig, cfg); }
  ["openai", "gemini", "claude"].forEach(function (p) {
    if (!cfg[p]) cfg[p] = { apiKey: "", model: PROVIDER_DEFAULTS[p].model };
  });
  return cfg;
}
function renderAiSettingsUI() {
  var cfg = loadAiConfig();
  document.getElementById("aiProviderSelect").value = cfg.provider;
  ["openai", "gemini", "claude"].forEach(function (p) {
    document.getElementById("providerFields-" + p).style.display = (p === cfg.provider) ? "block" : "none";
    document.getElementById("apiKey-" + p).value = cfg[p].apiKey;
    document.getElementById("model-" + p).value = cfg[p].model;
  });
}
document.getElementById("aiProviderSelect").addEventListener("change", function (e) {
  var cfg = loadAiConfig();
  cfg.provider = e.target.value;
  saveData(STORAGE_KEYS.aiConfig, cfg);
  renderAiSettingsUI();
});
document.getElementById("saveAiConfigBtn").addEventListener("click", function () {
  var cfg = loadAiConfig();
  ["openai", "gemini", "claude"].forEach(function (p) {
    cfg[p].apiKey = document.getElementById("apiKey-" + p).value.trim();
    cfg[p].model = document.getElementById("model-" + p).value.trim() || PROVIDER_DEFAULTS[p].model;
  });
  saveData(STORAGE_KEYS.aiConfig, cfg);
  showToast("AI settings saved");
});

function buildCoachSystemPrompt() {
  var withDisplay = chapters.map(function (c) { return { ch: c, displayStatus: computeDisplayStatus(c) }; });
  var delayed = withDisplay.filter(function (x) { return x.displayStatus === "Delayed"; }).map(function (x) { return x.ch.name; });
  var revisionDue = withDisplay.filter(function (x) { return x.displayStatus === "Revision Due"; }).map(function (x) { return x.ch.name; });
  var readiness = coachSubjectReadiness();
  var today = todayStr();
  var todayMinutes = sessions.filter(function (s) { return s.date === today; }).reduce(function (sum, s) { return sum + s.minutes; }, 0);
  var totalMinutes = sessions.reduce(function (sum, s) { return sum + s.minutes; }, 0);
  var pendingTaskTexts = tasks.filter(function (t) { return !t.done; }).map(function (t) { return t.text + " (" + t.priority + " priority)"; });
  var recentTests = tests.slice(-5).map(function (t) { return t.name + ": " + t.marksObtained + "/" + t.totalMarks; });

  var lines = [];
  lines.push("You are an AI academic coach inside a personal JEE (Physics, Chemistry, Mathematics) exam preparation tracking app.");
  lines.push("Give specific, personalized, encouraging but honest advice based ONLY on the real data below. Do not invent chapters, scores, or dates that are not listed. Keep answers concise, 3-6 sentences unless the student asks for more detail.");
  lines.push("Current date: " + today + ".");
  lines.push("Study streak: " + streak.count + " days. Daily study goal: " + (goalHours ? goalHours + " hours" : "not set") + ".");
  lines.push("Study time today so far: " + (todayMinutes / 60).toFixed(1) + " hours. Total time ever logged: " + (totalMinutes / 60).toFixed(1) + " hours.");
  lines.push("Average chapter progress by subject: Physics " + readiness.Physics + "%, Chemistry " + readiness.Chemistry + "%, Mathematics " + readiness.Mathematics + "%.");
  lines.push("Chapters currently delayed past their target date: " + (delayed.length ? delayed.join(", ") : "none") + ".");
  lines.push("Chapters with a revision checkpoint due: " + (revisionDue.length ? revisionDue.join(", ") : "none") + ".");
  lines.push("Pending to-do tasks: " + (pendingTaskTexts.length ? pendingTaskTexts.join("; ") : "none") + ".");
  lines.push("Most recent test scores: " + (recentTests.length ? recentTests.join("; ") : "no tests logged yet") + ".");
  return lines.join(" ");
}

async function callAiProvider(provider, apiKey, model, systemPrompt, history) {
  if (provider === "openai") {
    var messages = [{ role: "system", content: systemPrompt }].concat(
      history.map(function (m) { return { role: m.role, content: m.text }; })
    );
    var res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model, messages: messages })
    });
    var data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || ("HTTP " + res.status));
    return data.choices[0].message.content;
  }
  if (provider === "gemini") {
    var contents = history.map(function (m) {
      return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] };
    });
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    var res2 = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents: contents })
    });
    var data2 = await res2.json();
    if (!res2.ok) throw new Error((data2.error && data2.error.message) || ("HTTP " + res2.status));
    return data2.candidates[0].content.parts[0].text;
  }
  if (provider === "claude") {
    var msgs = history.map(function (m) { return { role: m.role, content: m.text }; });
    var res3 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model: model, max_tokens: 1024, system: systemPrompt, messages: msgs })
    });
    var data3 = await res3.json();
    if (!res3.ok) throw new Error((data3.error && data3.error.message) || ("HTTP " + res3.status));
    var textParts = (data3.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; });
    return textParts.join("");
  }
  throw new Error("Unknown provider");
}

function renderCoachChat() {
  var log = document.getElementById("coachChatLog");
  log.innerHTML = coachChat.map(function (m) {
    return "<div class='coach-bubble " + (m.role === "user" ? "user" : "assistant") + "'>" + escapeHtml(m.text) + "</div>";
  }).join("");
  log.scrollTop = log.scrollHeight;
}
function appendThinkingBubble() {
  var log = document.getElementById("coachChatLog");
  var div = document.createElement("div");
  div.className = "coach-bubble assistant";
  div.id = "coachThinkingBubble";
  div.textContent = "Thinking...";
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function removeThinkingBubble() {
  var el = document.getElementById("coachThinkingBubble");
  if (el && el.parentNode) el.parentNode.removeChild(el);
}
async function sendToCoach(userText) {
  coachChat.push({ role: "user", text: userText });
  saveData(STORAGE_KEYS.coachChat, coachChat);
  renderCoachChat();

  var aiConfig = loadAiConfig();
  var providerConf = aiConfig[aiConfig.provider];
  if (!providerConf.apiKey) {
    coachChat.push({ role: "assistant", text: "Please add your " + aiConfig.provider + " API key in AI Provider Settings above, then ask again for a personalized answer based on your real study data." });
    saveData(STORAGE_KEYS.coachChat, coachChat);
    renderCoachChat();
    return;
  }

  appendThinkingBubble();
  try {
    var systemPrompt = buildCoachSystemPrompt();
    var recentHistory = coachChat.slice(-10);
    var replyText = await callAiProvider(aiConfig.provider, providerConf.apiKey, providerConf.model, systemPrompt, recentHistory);
    removeThinkingBubble();
    coachChat.push({ role: "assistant", text: replyText });
    saveData(STORAGE_KEYS.coachChat, coachChat);
    renderCoachChat();
  } catch (err) {
    removeThinkingBubble();
    coachChat.push({ role: "assistant", text: "Error reaching " + aiConfig.provider + ": " + err.message + ". Check your API key and model name in AI Provider Settings above." });
    saveData(STORAGE_KEYS.coachChat, coachChat);
    renderCoachChat();
  }
}
document.querySelectorAll(".coach-quick-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var labels = {
      today: "What should I study today?",
      backlog: "Check my backlog and tell me what's delayed.",
      readiness: "What's my current exam readiness across all three subjects?",
      burnout: "Do a burnout check based on my recent study hours and streak."
    };
    sendToCoach(labels[btn.dataset.q] || btn.textContent);
  });
});
document.getElementById("coachSendBtn").addEventListener("click", function () {
  var input = document.getElementById("coachInput");
  var text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendToCoach(text);
});

document.querySelectorAll(".nav-item").forEach(function (btn) {
  btn.addEventListener("click", function () {
    if (btn.dataset.soon) { showToast("Coming in the next build phase"); return; }
    var tab = btn.dataset.tab;
    if (!tab) return;
    document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(function (v) { v.style.display = "none"; });
    document.getElementById("view-" + tab).style.display = "";
    if (tab === "syllabus") renderChapters();
    if (tab === "dailylog") { renderLogChapterChips(); updateStopwatchDisplay(); startStopwatchInterval(); updatePomodoroDisplay(); startPomodoroInterval(); }
    if (tab === "tests") renderTests();
    if (tab === "aicoach") { renderAiSettingsUI(); renderCoachChat(); }
  });
});

function renderAll() {
  escalatePendingTaskPriorities();
  renderStreak(); renderCountdowns(); renderPhases(); renderGoal(); renderStats();
  renderInsight(); renderTasks(); renderMiniChapterLists(); renderSessions();
  updateStopwatchDisplay(); startStopwatchInterval();
  updatePomodoroDisplay(); startPomodoroInterval();
}
renderAll();
renderChapters();
renderLogChapterChips();
renderAiSettingsUI();

} catch (err) {
  var banner = document.getElementById("errorBanner");
  if (banner) {
    banner.style.display = "block";
    banner.textContent = "App error: " + err.message;
  }
    }
