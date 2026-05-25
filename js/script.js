const API_URL = "https://drhscit.org/drwc/api";

// HTTP helpers

async function apiGet(action, params) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.entries(params || {}).forEach(function (entry) {
    const [k, v] = entry;
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { method: "GET", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return res.json();
}

async function apiPost(action, payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: action, payload: payload })
  });
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return res.json();
}

// DOM helpers

function showMessage(id, message, isError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ffb4b4" : "#9fb4ff";
}

// Helper method to fill out any <select> element
function fillSelect(select, items, placeholderText, renderItem) {
  if (!select) return;
  select.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = items.length ? placeholderText : (placeholderText.startsWith("No ") ? placeholderText : "No items");
  ph.disabled = true;
  ph.selected = true;
  select.appendChild(ph);
  items.forEach(function (item) {
    const opt = document.createElement("option");
    renderItem(opt, item);
    select.appendChild(opt);
  });
}

function selectError(select, message) {
  if (!select) return;
  select.innerHTML = "<option disabled selected>" + message + "</option>";
}

// Signup form (signups.html)

function renderTeacherOptions(teachers) {
  const select = document.getElementById("signup-teacher-email");
  const manualFields = document.getElementById("manual-teacher-fields");
  const nameInput = document.getElementById("manual-teacher-name");
  const emailInput = document.getElementById("manual-teacher-email");
  if (!select) return;

  fillSelect(select, teachers, "Choose a teacher", function (opt, t) {
    opt.value = t.email;
    opt.textContent = t.name + " (" + t.email + ")";
  });

  const notListed = document.createElement("option");
  notListed.value = "not_listed";
  notListed.textContent = "My teacher isn't listed...";
  select.appendChild(notListed);

  const personal = document.createElement("option");
  personal.value = "personal";
  personal.textContent = "Personal writing — no teacher";
  select.appendChild(personal);

  select.addEventListener("change", function () {
    const isManual = select.value === "not_listed";
    manualFields.style.display = isManual ? "block" : "none";
    nameInput.required = isManual;
    emailInput.required = isManual;
  });
}

async function loadTeachers() {
  try {
    const data = await apiGet("teachers");
    renderTeacherOptions(data.teachers || []);
  } catch (err) {
    selectError(document.getElementById("signup-teacher-email"), "Could not load teachers");
  }
}

function renderStudentOptions(students) {
  const select = document.getElementById("signup-student-select");
  const newFields = document.getElementById("new-student-fields");
  const emailIn = document.getElementById("new-student-email");
  const firstIn = document.getElementById("new-student-first");
  const lastIn = document.getElementById("new-student-last");
  const gradeIn = document.getElementById("new-student-grade");
  if (!select) return;

  fillSelect(select, students, "Choose your name", function (opt, s) {
    opt.value = s.student_id;
    opt.textContent = s.name + (s.grade ? " (" + s.grade + "th)" : "");
  });

  const createNew = document.createElement("option");
  createNew.value = "new";
  createNew.textContent = "My name isn't listed / Create new profile";
  select.appendChild(createNew);

  select.addEventListener("change", function () {
    const isNew = select.value === "new";
    newFields.style.display = isNew ? "block" : "none";
    emailIn.required = isNew;
    firstIn.required = isNew;
    lastIn.required = isNew;
    gradeIn.required = isNew;
  });
}

async function loadStudents() {
  const select = document.getElementById("signup-student-select");
  if (!select) return;
  try {
    const data = await apiGet("studentsForSignup");
    renderStudentOptions(data.students || []);
  } catch (err) {
    selectError(select, "Could not load students");
  }
}

function bindSignupForm() {
  const form = document.getElementById("signup-form");
  if (!form) return;

  const manualFields = document.getElementById("manual-teacher-fields");
  const nameInput = document.getElementById("manual-teacher-name");
  const emailInput = document.getElementById("manual-teacher-email");
  const teacherSelect = document.getElementById("signup-teacher-email");
  const studentSelect = document.getElementById("signup-student-select");
  const newStudentFields = document.getElementById("new-student-fields");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showMessage("signup-message", "Submitting...", false);

    const fd = new FormData(form);

    if (!studentSelect.value) {
      showMessage("signup-message", "Please select your name (or create a new profile).", true);
      return;
    }

    let studentPayload;
    if (studentSelect.value === "new") {
      const firstName = (fd.get("firstName") || "").trim();
      const lastName = (fd.get("lastName") || "").trim();
      const email = (fd.get("studentEmail") || "").trim();
      const grade = fd.get("studentGrade") || "";
      if (!firstName || !lastName || !email || !grade) {
        showMessage("signup-message", "Please fill out all profile fields.", true);
        return;
      }
      studentPayload = {
        is_new_student: true,
        student_name: (firstName + " " + lastName).trim(),
        student_email: email,
        student_grade: grade
      };
    } else {
      studentPayload = { student_id: studentSelect.value };
    }

    const isPersonal = teacherSelect.value === "personal";
    const isNewTeacher = teacherSelect.value === "not_listed";
    const teacherEmail = isPersonal ? ""
      : isNewTeacher ? (fd.get("manualTeacherEmail") || "").trim()
        : fd.get("teacherEmail");
    const teacherName = isNewTeacher ? (fd.get("manualTeacherName") || "").trim() : null;

    if (isNewTeacher && (!teacherEmail || !teacherName)) {
      showMessage("signup-message", "Please enter your teacher's name and email.", true);
      return;
    }

    try {
      const res = await apiPost("submitSignup", Object.assign({}, studentPayload, {
        appointment_date: fd.get("appointmentDateTime"),
        teacher_email: teacherEmail,
        teacher_name: teacherName,
        course: fd.get("courseInfo"),
        assignment_type: fd.get("assignmentType"),
        google_doc_link: fd.get("googleDocLink") || "",
        is_new_teacher: isNewTeacher,
        is_personal: isPersonal
      }));

      if (res.ok) {
        showMessage("signup-message", "Sign-up submitted! Confirmation ID: " + res.consult_id, false);
        form.reset();
        manualFields.style.display = "none";
        newStudentFields.style.display = "none";
        nameInput.required = false;
        emailInput.required = false;
        if (teacherSelect) teacherSelect.selectedIndex = 0;
        if (studentSelect) studentSelect.selectedIndex = 0;
        await Promise.all([loadAppointments(), loadStudents()]);
      } else {
        showMessage("signup-message", res.error || "Submission failed.", true);
      }
    } catch (err) {
      showMessage("signup-message", err.message, true);
    }
  });
}

// Sign-up dropdown (consultant-form + dashboard)

let _signupOptionsCache = [];

async function loadSignupOptions(preloaded) {
  let options = preloaded;
  if (options === undefined) {
    try { options = (await apiGet("signupOptions")).options || []; }
    catch (err) {
      selectError(document.getElementById("consult-id-select"), "Could not load sign-ups");
      return;
    }
  }

  _signupOptionsCache = options;

  const select = document.getElementById("consult-id-select");
  if (select) {
    fillSelect(select, options, options.length ? "Choose a sign-up" : "No open sign-ups", function (opt, o) {
      opt.value = o.consult_id;
      opt.textContent = o.label;
    });
  }

  populateNoShowDropdown(_signupOptionsCache);
}

function bindConsultationForm() {
  const form = document.getElementById("consultant-form");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showMessage("consultant-message", "Submitting...", false);

    const fd = new FormData(form);
    try {
      const res = await apiPost("submitConsultation", {
        consult_id: fd.get("consultId"),
        consultant_id: fd.get("consultantName"),
        before_conf: fd.get("beforeConfidence"),
        after_conf: fd.get("afterConfidence"),
        duration: Number(fd.get("duration")) || 0,
        dual_enroll: fd.get("dualEnroll") === "true",
        due_date: fd.get("dueDate"),
        notes: fd.get("workedOn"),
        next_steps: fd.get("nextSteps")
      });

      if (res.ok) {
        showMessage("consultant-message", "Submitted! Consultation ID: " + res.consult_id, false);
        form.reset();
        await Promise.all([loadSignupOptions(), loadNoShowOptions()]);
      } else {
        showMessage("consultant-message", res.error || "Submission failed.", true);
      }
    } catch (err) {
      showMessage("consultant-message", err.message, true);
    }
  });
}

// No-show dropdown (mark)

function populateNoShowDropdown(options) {
  const select = document.getElementById("noshow-id-select");
  const btn = document.getElementById("noshow-btn");
  if (!select) return;

  fillSelect(select, options, options.length ? "Choose a student" : "No open sign-ups", function (opt, o) {
    opt.value = o.consult_id;
    opt.textContent = o.label;
    opt.dataset.student = o.student_name || "";
    opt.dataset.appt = o.date || "";
    opt.dataset.course = o.course || "";
    opt.dataset.teacher = o.teacher_email || "";
  });

  select.addEventListener("change", function () {
    const selected = select.options[select.selectedIndex];
    const preview = document.getElementById("noshow-preview");
    if (!selected || !selected.value) {
      preview.style.display = "none";
      if (btn) btn.disabled = true;
      return;
    }
    document.getElementById("preview-student").textContent = selected.dataset.student || "—";
    document.getElementById("preview-appt").textContent = selected.dataset.appt || "—";
    document.getElementById("preview-course").textContent = selected.dataset.course || "—";
    document.getElementById("preview-teacher").textContent = selected.dataset.teacher || "—";
    preview.style.display = "block";
    if (btn) btn.disabled = false;
  });
}

async function loadNoShowOptions(preloaded) {
  if (!document.getElementById("noshow-id-select")) return;
  const options = preloaded !== undefined
    ? preloaded
    : (await apiGet("signupOptions").catch(function () { return { options: [] }; })).options || [];
  populateNoShowDropdown(options);
}

async function submitNoShow() {
  const select = document.getElementById("noshow-id-select");
  const msgEl = document.getElementById("noshow-message");
  const btn = document.getElementById("noshow-btn");
  if (!select.value) return;

  btn.disabled = true;
  btn.textContent = "Marking...";
  msgEl.textContent = "";

  try {
    const res = await apiPost("markNoShow", { consult_id: select.value });
    if (res.ok) {
      msgEl.textContent = "Marked as no-show successfully.";
      msgEl.style.color = "var(--primary2)";
      document.getElementById("noshow-preview").style.display = "none";
      await Promise.all([loadNoShowOptions(), loadRevertOptions(), loadSignupOptions()]);
    } else {
      msgEl.textContent = res.error || "Failed to mark no-show.";
      msgEl.style.color = "#ffb4b4";
    }
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.style.color = "#ffb4b4";
  } finally {
    btn.disabled = false;
    btn.textContent = "Mark as No-Show";
  }
}

// No-show dropdown (revert)

async function loadRevertOptions(preloaded) {
  const select = document.getElementById("revert-id-select");
  if (!select) return;

  let options = preloaded;
  if (options === undefined) {
    try { options = (await apiGet("noShowOptions")).options || []; }
    catch (err) { selectError(select, "Could not load no-shows"); return; }
  }

  fillSelect(select, options, options.length ? "Choose a no-show" : "No no-shows recorded", function (opt, o) {
    opt.value = o.consult_id;
    opt.textContent = o.label;
  });

  select.addEventListener("change", function () {
    document.getElementById("revert-btn").disabled = !select.value;
  });
}

async function submitRevert() {
  const select = document.getElementById("revert-id-select");
  const msgEl = document.getElementById("revert-message");
  const btn = document.getElementById("revert-btn");
  if (!select.value) return;

  btn.disabled = true;
  btn.textContent = "Reverting...";
  msgEl.textContent = "";

  try {
    const res = await apiPost("revertNoShow", { consult_id: select.value });
    if (res.ok) {
      msgEl.textContent = "Reverted to scheduled successfully.";
      msgEl.style.color = "var(--primary2)";
      await Promise.all([loadNoShowOptions(), loadRevertOptions(), loadSignupOptions()]);
    } else {
      msgEl.textContent = res.error || "Failed to revert.";
      msgEl.style.color = "#ffb4b4";
    }
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.style.color = "#ffb4b4";
  } finally {
    btn.disabled = false;
    btn.textContent = "Revert to Scheduled";
  }
}

// Appointments + Consultants dropdowns

async function loadAppointments() {
  const select = document.getElementById("appointment-select");
  if (!select) return;
  try {
    const data = await apiGet("getAppointments");
    const appointments = data.appointments || [];
    fillSelect(select, appointments, appointments.length ? "Choose an appointment" : "No appointments available", function (opt, a) {
      opt.value = a.description;
      opt.textContent = a.description + " (" + a.spots_left + " spot" + (a.spots_left === 1 ? "" : "s") + " left)";
    });
  } catch (err) {
    selectError(select, "Could not load appointments");
  }
}

// Init: signups page

document.addEventListener("DOMContentLoaded", async function () {
  if (document.getElementById("signup-form")) {
    bindSignupForm();
    await Promise.all([loadTeachers(), loadAppointments(), loadStudents()]);
  }
});

// Login (login.html)

document.addEventListener("DOMContentLoaded", function () {
  const usernameInput = document.getElementById("login-username");
  const pwInput = document.getElementById("login-password");
  const loginBtn = document.getElementById("login-btn");
  const msgEl = document.getElementById("login-message");
  const pwToggle = document.getElementById("pw-toggle");
  if (!pwInput || !loginBtn || !msgEl || !pwToggle) return;

  pwToggle.addEventListener("click", function () {
    const hidden = pwInput.type === "password";
    pwInput.type = hidden ? "text" : "password";
    pwToggle.textContent = hidden ? "Hide" : "Show";
  });

  [usernameInput, pwInput].forEach(function (el) {
    el.addEventListener("keydown", function (e) { if (e.key === "Enter") handleLogin(); });
  });

  loginBtn.addEventListener("click", handleLogin);

  async function handleLogin() {
    const username = (usernameInput.value || "").trim();
    const password = (pwInput.value || "").trim();
    if (!username || !password) { showMsg("Please enter your username and password.", "error"); return; }

    setLoading(true);
    showMsg("Checking...", "info");

    try {
      const data = await apiGet("checkPassword", { username: username, password: password });
      if (data.ok) {
        sessionStorage.setItem("wc_consultant_session", JSON.stringify({
          name: data.name,
          consultant_id: data.consultant_id || "",
          username: username
        }));
        showMsg("Access granted! Redirecting...", "info");
        setTimeout(function () { window.location.href = "consultant-dashboard.html"; }, 800);
      } else {
        showMsg("Incorrect username or password.", "error");
        pwInput.value = "";
        pwInput.focus();
      }
    } catch (err) {
      showMsg("Could not reach the server. Check your connection.", "error");
    } finally {
      setLoading(false);
    }
  }

  function showMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = "login-message " + type;
  }
  function setLoading(state) {
    loginBtn.disabled = state;
    loginBtn.textContent = state ? "Checking..." : "Enter";
  }
});

// Dashboard (consultant-dashboard.html)

document.addEventListener("DOMContentLoaded", async function () {
  if (!document.getElementById("consultant-name")) return;

  const session = JSON.parse(sessionStorage.getItem("wc_consultant_session") || "null");
  if (!session) return;

  document.getElementById("consultant-name").textContent = session.name;

  const lockedDisplay = document.getElementById("consultant-name-display");
  const lockedHidden = document.getElementById("consultant-name-select");
  if (lockedDisplay) lockedDisplay.value = session.name;
  if (lockedHidden) lockedHidden.value = session.consultant_id || session.name;

  document.getElementById("logout-btn").addEventListener("click", function (e) {
    e.preventDefault();
    sessionStorage.removeItem("wc_consultant_session");
    window.location.href = "login.html";
  });

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  let dashboard = {};
  try {
    dashboard = await apiGet("dashboardData", {
      consultant_id: session.consultant_id || "",
      name: session.name
    });
  } catch (err) {
    console.error("dashboardData failed", err);
  }

  await Promise.all([
    loadStats(session.name, dashboard.stats),
    loadHistory(session.name, dashboard.history),
    loadSignupOptions(dashboard.signupOptions),
    loadNoShowOptions(dashboard.signupOptions),
    loadRevertOptions(dashboard.noShowOptions),
    loadHoursLog(session.name, dashboard.hoursLog)
  ]);

  bindConsultationForm();
  const noshowBtn = document.getElementById("noshow-btn");
  const revertBtn = document.getElementById("revert-btn");
  if (noshowBtn) noshowBtn.addEventListener("click", submitNoShow);
  if (revertBtn) revertBtn.addEventListener("click", submitRevert);
  bindHoursLogForm(session.name);
});

async function loadStats(name, preloaded) {
  try {
    const s = preloaded || await apiGet("getConsultantStats", { name: name });
    document.getElementById("stat-consults").textContent = s.total_consults || 0;
    document.getElementById("stat-consulting-hours").textContent = s.consulting_hours || 0;
    document.getElementById("stat-consulting-minutes").textContent = s.consulting_minutes || 0;
    document.getElementById("stat-total-hours").textContent = s.total_hours || 0;
    document.getElementById("stat-extra-hours").textContent = s.extra_hours || 0;
  } catch (err) {
    console.error("Could not load stats", err);
  }
}

function renderTable(loadingId, wrapId, emptyId, tbodyId, rows, rowHtml) {
  const loading = document.getElementById(loadingId);
  const wrap = document.getElementById(wrapId);
  const empty = document.getElementById(emptyId);
  const tbody = document.getElementById(tbodyId);
  if (!loading) return;
  loading.style.display = "none";
  if (!rows.length) { empty.style.display = "block"; return; }
  tbody.innerHTML = rows.map(rowHtml).join("");
  wrap.style.display = "block";
}

async function loadHistory(name, preloaded) {
  try {
    const rows = preloaded !== undefined ? preloaded : ((await apiGet("getConsultantHistory", { name: name })).rows || []);
    renderTable("history-loading", "history-table-wrap", "history-empty", "history-tbody", rows, function (row) {
      return '<tr>'
        + '<td>' + (row.completed_at ? row.completed_at.slice(0, 10) : '—') + '</td>'
        + '<td>' + (row.student_name || '—') + '<br><small class="muted">' + (row.student_email || '') + '</small></td>'
        + '<td>' + (row.student_grade || '—') + '</td>'
        + '<td>' + (row.appointment || '—') + '</td>'
        + '<td>' + (row.teacher_email || '—') + '</td>'
        + '<td>' + (row.course || '—') + '</td>'
        + '<td>' + (row.assignment_type || '—') + '</td>'
        + '<td>' + (row.before_conf || '—') + '</td>'
        + '<td>' + (row.after_conf || '—') + '</td>'
        + '<td>' + (row.duration || '—') + ' min</td>'
        + '<td>' + (row.due_date || '—') + '</td>'
        + '<td><span class="badge ' + (row.dual_enroll ? 'badge-yes' : 'badge-no') + '">' + (row.dual_enroll ? 'Yes' : 'No') + '</span></td>'
        + '<td class="cell-wrap"><div class="cell-wrap-inner">' + (row.notes || '—') + '</div></td>'
        + '<td class="cell-wrap"><div class="cell-wrap-inner">' + (row.next_steps || '—') + '</div></td>'
        + '</tr>';
    });
  } catch (err) {
    document.getElementById("history-loading").textContent = "Could not load consultation history.";
    console.error(err);
  }
}

async function loadHoursLog(name, preloaded) {
  if (!document.getElementById("hours-loading")) return;
  try {
    const rows = preloaded !== undefined ? preloaded : ((await apiGet("getHoursLog", { name: name })).rows || []);
    renderTable("hours-loading", "hours-table-wrap", "hours-empty", "hours-tbody", rows, function (row) {
      return '<tr>'
        + '<td>' + (row.date || '—') + '</td>'
        + '<td>' + (row.hours || '—') + ' hrs</td>'
        + '<td>' + (row.description || '—') + '</td>'
        + '<td>' + (row.submitted_at ? row.submitted_at.slice(0, 10) : '—') + '</td>'
        + '</tr>';
    });
  } catch (err) {
    document.getElementById("hours-loading").textContent = "Could not load extra hours log.";
    console.error(err);
  }
}

function bindHoursLogForm(name) {
  const form = document.getElementById("hours-log-form");
  if (!form) return;
  const submitBtn = document.getElementById("hours-submit-btn");

  submitBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    const msgEl = document.getElementById("hours-message");
    const date = document.getElementById("hours-date").value.trim();
    const hours = document.getElementById("hours-amount").value.trim();
    const description = document.getElementById("hours-description").value.trim();

    if (!date || !hours || !description) {
      msgEl.textContent = "Please fill in all fields.";
      msgEl.style.color = "#ffb4b4";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    msgEl.textContent = "";

    try {
      const res = await apiPost("submitHoursLog", {
        consultant: name, date: date, hours: Number(hours), description: description
      });
      if (res.ok) {
        msgEl.textContent = "Extra hours logged successfully!";
        msgEl.style.color = "var(--primary2)";
        form.reset();
        await loadHoursLog(name);
      } else {
        msgEl.textContent = res.error || "Failed to log extra hours.";
        msgEl.style.color = "#ffb4b4";
      }
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.style.color = "#ffb4b4";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log Extra Hours";
    }
  });
}

// Resources page dropdowns

function reveal1() { document.getElementById("revealc1").classList.toggle("show"); }
function reveal2() { document.getElementById("revealc2").classList.toggle("show"); }
function reveal3() { document.getElementById("revealc3").classList.toggle("show"); }
function reveal4() { document.getElementById("revealc4").classList.toggle("show"); }
function reveal5() { document.getElementById("revealc5").classList.toggle("show"); }

// Public student-visits page (student-visits.html)

document.addEventListener("DOMContentLoaded", async function () {
  const select = document.getElementById("sv-student-select");
  if (!select) return;

  const profile = document.getElementById("sv-profile");
  const emptyCard = document.getElementById("sv-empty");
  const message = document.getElementById("sv-message");

  try {
    const data = await apiGet("students");
    const students = (data && data.students) || [];
    fillSelect(select, students, students.length ? "Choose a student" : "No students yet", function (opt, s) {
      opt.value = s.student_email;
      opt.textContent = s.student_name;
    });
  } catch (err) {
    selectError(select, "Could not load students");
    return;
  }

  select.addEventListener("change", async function () {
    if (!select.value) return;
    message.textContent = "Loading...";
    profile.style.display = "none";
    emptyCard.style.display = "none";

    try {
      const data = await apiGet("studentProfile", { student_email: select.value });
      message.textContent = "";
      if (!data || !data.ok) { emptyCard.style.display = "block"; return; }

      document.getElementById("sv-name").textContent = data.student_name || "—";
      document.getElementById("sv-grade").textContent = data.student_grade || "—";
      document.getElementById("sv-total").textContent = data.total_visits;
      document.getElementById("sv-dual").textContent = data.dual_enroll_visits;

      document.getElementById("sv-per-teacher-tbody").innerHTML = (data.per_teacher || []).map(function (t) {
        return '<tr>'
          + '<td>' + (t.teacher_name || t.teacher_email || '—') + '</td>'
          + '<td>' + (t.teacher_department || '—') + '</td>'
          + '<td>' + t.visits + '</td>'
          + '<td>' + t.dual_enroll_visits + '</td>'
          + '</tr>';
      }).join("");

      document.getElementById("sv-visits-tbody").innerHTML = (data.visits || []).map(function (v) {
        return '<tr>'
          + '<td>' + (v.consult_date || '—') + '</td>'
          + '<td>' + (v.teacher_name || '—') + '</td>'
          + '<td>' + (v.teacher_department || '—') + '</td>'
          + '<td><span class="badge ' + (v.dual_enroll ? 'badge-yes' : 'badge-no') + '">' + (v.dual_enroll ? 'Yes' : 'No') + '</span></td>'
          + '</tr>';
      }).join("");

      profile.style.display = "block";
    } catch (err) {
      message.textContent = "Could not load student profile.";
    }
  });
});
