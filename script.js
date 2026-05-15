const API_URL = "https://drhscit.org/drwc/api";

function showMessage(id, message, isError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#ffb4b4" : "#9fb4ff";
}

async function apiGet(action, params) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.entries(params || {}).forEach(function (entry) {
    const [k, v] = entry;
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" }
  });
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

// ── Tab switching (consultant-form.html) ──────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll(".tab-panel").forEach(function (p) {
    p.classList.remove("active");
  });
  document.querySelectorAll(".cf-tab-btn").forEach(function (b) {
    b.classList.remove("active");
    b.setAttribute("aria-selected", "false");
  });

  var panel = document.getElementById("tab-" + tab);
  var btn   = document.getElementById("btn-" + tab);
  if (panel) panel.classList.add("active");
  if (btn)   { btn.classList.add("active"); btn.setAttribute("aria-selected", "true"); }
}

// ── Signup form (signups.html) ────────────────────────────────────────────────

function renderTeacherOptions(teachers) {
  const select       = document.getElementById("signup-teacher-email");
  const manualFields = document.getElementById("manual-teacher-fields");
  const nameInput    = document.getElementById("manual-teacher-name");
  const emailInput   = document.getElementById("manual-teacher-email");
  if (!select) return;

  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a teacher";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  teachers.forEach(function (teacher) {
    const option = document.createElement("option");
    option.value = teacher.email;
    option.textContent = teacher.name + " (" + teacher.email + ")";
    select.appendChild(option);
  });

  const notListed = document.createElement("option");
  notListed.value = "not_listed";
  notListed.textContent = "My teacher isn't listed...";
  select.appendChild(notListed);

  select.addEventListener("change", function () {
    if (select.value === "not_listed") {
      manualFields.style.display = "block";
      nameInput.required  = true;
      emailInput.required = true;
    } else {
      manualFields.style.display = "none";
      nameInput.required  = false;
      emailInput.required = false;
    }
  });
}

async function loadTeachers() {
  try {
    const data = await apiGet("teachers");
    renderTeacherOptions(data.teachers || []);
  } catch (err) {
    const select = document.getElementById("signup-teacher-email");
    if (select) {
      select.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Could not load teachers";
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
    }
  }
}

function bindSignupForm() {
  const form = document.getElementById("signup-form");
  if (!form) return;

  const manualFields  = document.getElementById("manual-teacher-fields");
  const nameInput     = document.getElementById("manual-teacher-name");
  const emailInput    = document.getElementById("manual-teacher-email");
  const teacherSelect = document.getElementById("signup-teacher-email");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showMessage("signup-message", "Submitting...", false);

    const fd = new FormData(form);
    const firstName   = (fd.get("firstName") || "").trim();
    const lastName    = (fd.get("lastName")  || "").trim();
    const studentName = (firstName + " " + lastName).trim();

    const isNewTeacher = teacherSelect.value === "not_listed";
    const teacherEmail = isNewTeacher
      ? (fd.get("manualTeacherEmail") || "").trim()
      : fd.get("teacherEmail");
    const teacherName = isNewTeacher
      ? (fd.get("manualTeacherName") || "").trim()
      : null;

    if (isNewTeacher && (!teacherEmail || !teacherName)) {
      showMessage("signup-message", "Please enter your teacher's name and email.", true);
      return;
    }

    try {
      const res = await apiPost("submitSignup", {
        student_name:     studentName,
        student_email:    fd.get("studentEmail"),
        student_grade:    fd.get("studentGrade"),
        appointment_date: fd.get("appointmentDateTime"),
        teacher_email:    teacherEmail,
        teacher_name:     teacherName,
        course:           fd.get("courseInfo"),
        assignment_type:  fd.get("assignmentType"),
        google_doc_link:  fd.get("googleDocLink") || "",
        is_new_teacher:   isNewTeacher
      });

      if (res.ok) {
        showMessage("signup-message", "Sign-up submitted! Confirmation ID: " + res.consult_id, false);

        form.reset();
        manualFields.style.display = "none";
        nameInput.required  = false;
        emailInput.required = false;

        const teacherSelect = document.getElementById("signup-teacher-email");
        if (teacherSelect) teacherSelect.selectedIndex = 0;

        await loadAppointments();
      } else {
        showMessage("signup-message", res.error || "Submission failed.", true);
      }
    } catch (err) {
      showMessage("signup-message", err.message, true);
    }
  });
}

// ── Consultant form (consultant-form.html) ────────────────────────────────────

var _signupOptionsCache = [];

async function loadSignupOptions(preloaded) {
  const select = document.getElementById("consult-id-select");

  let options;
  if (preloaded !== undefined) {
    options = preloaded;
  } else {
    try {
      options = (await apiGet("signupOptions")).options || [];
    } catch (err) {
      if (select) {
        select.innerHTML = "";
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Could not load sign-ups";
        opt.disabled = true;
        opt.selected = true;
        select.appendChild(opt);
      }
      return;
    }
  }

  _signupOptionsCache = options;

  if (select) {
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = _signupOptionsCache.length ? "Choose a sign-up" : "No open sign-ups";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    _signupOptionsCache.forEach(function (opt) {
      const option = document.createElement("option");
      option.value = opt.consult_id;
      option.textContent = opt.label;
      select.appendChild(option);
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
      // The "consultantName" form input now carries the consultant_id as its
      // value (the dropdown's option values are IDs; only the display text is
      // the name). The server resolves the ID to a display name before
      // writing the Consultations row.
      const res = await apiPost("submitConsultation", {
        consult_id:    fd.get("consultId"),
        consultant_id: fd.get("consultantName"),
        before_conf:   fd.get("beforeConfidence"),
        after_conf:    fd.get("afterConfidence"),
        duration:      Number(fd.get("duration")) || 0,
        dual_enroll:   fd.get("dualEnroll") === "true",
        due_date:      fd.get("dueDate"),
        notes:         fd.get("workedOn"),
        next_steps:    fd.get("nextSteps")
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

// ── No-show tab ───────────────────────────────────────────────────────────────

function populateNoShowDropdown(options) {
  const select = document.getElementById("noshow-id-select");
  const btn    = document.getElementById("noshow-btn");
  if (!select) return;

  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = options.length ? "Choose a student" : "No open sign-ups";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  options.forEach(function (opt) {
    const option = document.createElement("option");
    option.value = opt.consult_id;
    option.dataset.student = opt.student_name  || "";
    option.dataset.appt    = opt.date          || "";
    option.dataset.course  = opt.course        || "";
    option.dataset.teacher = opt.teacher_email || "";
    option.textContent = opt.label;
    select.appendChild(option);
  });

  select.addEventListener("change", function () {
    const selected = select.options[select.selectedIndex];
    if (!selected || !selected.value) {
      document.getElementById("noshow-preview").style.display = "none";
      if (btn) btn.disabled = true;
      return;
    }

    document.getElementById("preview-student").textContent = selected.dataset.student  || "—";
    document.getElementById("preview-appt").textContent    = selected.dataset.appt     || "—";
    document.getElementById("preview-course").textContent  = selected.dataset.course   || "—";
    document.getElementById("preview-teacher").textContent = selected.dataset.teacher  || "—";
    document.getElementById("noshow-preview").style.display = "grid";
    if (btn) btn.disabled = false;
  });
}

async function submitNoShow() {
  const select = document.getElementById("noshow-id-select");
  const btn    = document.getElementById("noshow-btn");
  if (!select || !select.value) return;

  const consultId   = select.value;
  const studentName = select.options[select.selectedIndex].dataset.student || "this student";

  const confirmed = window.confirm("Mark " + studentName + " as a no-show? This cannot be undone.");
  if (!confirmed) return;

  btn.disabled = true;
  showMessage("noshow-message", "Marking as no-show...", false);

  try {
    const res = await apiPost("markNoShow", { consult_id: consultId });

    if (res.ok) {
      showMessage("noshow-message", studentName + " has been marked as a no-show.", false);
      document.getElementById("noshow-preview").style.display = "none";
      await Promise.all([loadSignupOptions(), loadNoShowOptions()]);
    } else {
      showMessage("noshow-message", res.error || "Could not mark no-show.", true);
      btn.disabled = false;
    }
  } catch (err) {
    showMessage("noshow-message", err.message, true);
    btn.disabled = false;
  }
}

// ── Revert No-Show ────────────────────────────────────────────────────────────

async function loadNoShowOptions() {
  const select = document.getElementById("revert-id-select");
  const btn    = document.getElementById("revert-btn");
  if (!select) return;

  try {
    const data = await apiGet("noShowOptions");
    const options = data.options || [];

    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.length ? "Choose a student" : "No no-shows found";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    options.forEach(function (opt) {
      const option = document.createElement("option");
      option.value = opt.consult_id;
      option.textContent = opt.label;
      select.appendChild(option);
    });

    if (btn) btn.disabled = true;

    select.addEventListener("change", function () {
      if (btn) btn.disabled = !select.value;
    });

  } catch (err) {
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Could not load no-shows";
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
  }
}

async function submitRevert() {
  const select = document.getElementById("revert-id-select");
  const btn    = document.getElementById("revert-btn");
  if (!select || !select.value) return;

  const consultId   = select.value;
  const studentName = select.options[select.selectedIndex].text;

  const confirmed = window.confirm("Revert " + studentName + " back to scheduled?");
  if (!confirmed) return;

  btn.disabled = true;
  showMessage("revert-message", "Reverting...", false);

  try {
    const res = await apiPost("revertNoShow", { consult_id: consultId });

    if (res.ok) {
      showMessage("revert-message", studentName + " has been restored to scheduled.", false);
      await Promise.all([loadSignupOptions(), loadNoShowOptions()]);
    } else {
      showMessage("revert-message", res.error || "Could not revert.", true);
      btn.disabled = false;
    }
  } catch (err) {
    showMessage("revert-message", err.message, true);
    btn.disabled = false;
  }
}

// ── Appointments dropdown (signups.html) ──────────────────────────────────────

async function loadAppointments() {
  const select = document.getElementById("appointment-select");
  if (!select) return;

  try {
    const data = await apiGet("getAppointments");
    const appointments = data.appointments || [];

    select.innerHTML = "";

    if (appointments.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No appointments available";
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
      return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose an appointment";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    appointments.forEach(function (appt) {
      const option = document.createElement("option");
      option.value = appt.description;
      option.textContent = appt.description + " (" + appt.spots_left + " spot" + (appt.spots_left === 1 ? "" : "s") + " left)";
      select.appendChild(option);
    });

  } catch (err) {
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Could not load appointments";
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
  }
}

// ── Consultants dropdown ──────────────────────────────────────────────────────

async function loadConsultants(_preselect, preloaded) {
  const select = document.getElementById("consultant-name-select");
  if (!select) return;

  let consultants;
  try {
    consultants = preloaded || (await apiGet("getConsultants")).consultants || [];
  } catch (err) {
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Could not load consultants";
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
    return;
  }

  select.innerHTML = "";

  if (consultants.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No consultants found";
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select your name";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  // The server returns either {id,name} objects (new) or plain strings (legacy).
  consultants.forEach(function (c) {
    const option = document.createElement("option");
    if (typeof c === "string") {
      option.value = c;
      option.textContent = c;
    } else {
      option.value = c.id || c.name;
      option.textContent = c.name;
    }
    if (_preselect && option.textContent === _preselect) option.selected = true;
    select.appendChild(option);
  });

  if (!select.value) select.selectedIndex = 0;
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async function () {
  if (document.getElementById("signup-form")) {
    bindSignupForm();
    await Promise.all([loadTeachers(), loadAppointments()]);
  }

  if (document.getElementById("consultant-form")) {
    bindConsultationForm();
    await Promise.all([loadSignupOptions(), loadConsultants(), loadNoShowOptions()]);
  }
});

// ── Login page (login.html) ───────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  const usernameInput = document.getElementById("login-username");
  const pwInput       = document.getElementById("login-password");
  const loginBtn      = document.getElementById("login-btn");
  const msgEl         = document.getElementById("login-message");
  const pwToggle      = document.getElementById("pw-toggle");

  if (!pwInput || !loginBtn || !msgEl || !pwToggle) return;

  pwToggle.addEventListener("click", function () {
    const hidden = pwInput.type === "password";
    pwInput.type = hidden ? "text" : "password";
    pwToggle.textContent = hidden ? "Hide" : "Show";
  });

  [usernameInput, pwInput].forEach(function(el) {
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleLogin();
    });
  });

  loginBtn.addEventListener("click", handleLogin);

  async function handleLogin() {
    const username = (usernameInput.value || "").trim();
    const password = (pwInput.value || "").trim();

    if (!username || !password) {
      showMsg("Please enter your username and password.", "error");
      return;
    }

    setLoading(true);
    showMsg("Checking...", "info");

    try {
      const url = new URL(API_URL);
      url.searchParams.set("action", "checkPassword");
      url.searchParams.set("username", username);
      url.searchParams.set("password", password);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (!res.ok) throw new Error("Network error");
      const data = await res.json();

      if (data.ok) {
        sessionStorage.setItem("wc_consultant_session", JSON.stringify({
          name: data.name,
          consultant_id: data.consultant_id || "",
          username: username
        }));
        showMsg("Access granted! Redirecting...", "info");
        setTimeout(function () {
          window.location.href = "./consultant-dashboard.html";
        }, 800);
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

// ── Dashboard page (dashboard.html) ──────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async function () {
  if (!document.getElementById("consultant-name")) return;

  const session = JSON.parse(sessionStorage.getItem("wc_consultant_session") || "null");
  if (!session) return;

  // Set name
  document.getElementById("consultant-name").textContent = session.name;

  // Logout
  document.getElementById("logout-btn").addEventListener("click", function (e) {
    e.preventDefault();
    sessionStorage.removeItem("wc_consultant_session");
    window.location.href = "./login.html";
  });

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ONE API call for everything the dashboard needs (was 7 parallel calls).
  // Each Apps Script invocation pays a cold-start tax of ~500–1500ms, so
  // bundling these saves several seconds of dashboard load time.
  let dashboard = {};
  try {
    dashboard = await apiGet("dashboardData", {
      consultant_id: session.consultant_id || "",
      name: session.name
    });
  } catch (err) {
    console.error("dashboardData failed; falling back to individual fetches", err);
  }

  await Promise.all([
    loadStats(session.name, dashboard.stats),
    loadHistory(session.name, dashboard.history),
    loadSignupOptions(dashboard.signupOptions),
    loadConsultants(session.name, dashboard.consultants),
    loadNoShowOptions(dashboard.signupOptions),
    loadRevertOptions(dashboard.noShowOptions),
    loadHoursLog(session.name, dashboard.hoursLog)
  ]);

  // Bind form
  bindConsultationForm();
  // Wire up no show buttons
  const noshowBtn = document.getElementById("noshow-btn");
  const revertBtn = document.getElementById("revert-btn");
  if (noshowBtn) noshowBtn.addEventListener("click", submitNoShow);
  if (revertBtn) revertBtn.addEventListener("click", submitRevert);
  bindHoursLogForm(session.name);
});

async function loadStats(name, preloaded) {
  try {
    const statsData = preloaded || await apiGet("getConsultantStats", { name: name });
    document.getElementById("stat-consults").textContent = statsData.total_consults || 0;
    document.getElementById("stat-hours").textContent    = statsData.total_hours    || 0;
    document.getElementById("stat-minutes").textContent  = statsData.total_minutes  || 0;
  } catch (err) {
    console.error("Could not load stats", err);
  }
}

async function loadHistory(name, preloaded) {
  const loading   = document.getElementById("history-loading");
  const tableWrap = document.getElementById("history-table-wrap");
  const empty     = document.getElementById("history-empty");
  const tbody     = document.getElementById("history-tbody");

  try {
    const rows = preloaded !== undefined ? preloaded : ((await apiGet("getConsultantHistory", { name: name })).rows || []);

    loading.style.display = "none";

    if (rows.length === 0) {
      empty.style.display = "block";
      return;
    }

    tbody.innerHTML = "";
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      tr.innerHTML = [
        '<td>' + (row.completed_at ? row.completed_at.slice(0, 10) : '—') + '</td>',
        '<td>' + (row.student_name  || '—') + '<br><small style="color:var(--muted)">' + (row.student_email || '') + '</small></td>',
        '<td>' + (row.student_grade || '—') + '</td>',
        '<td>' + (row.appointment   || '—') + '</td>',
        '<td>' + (row.teacher_email || '—') + '</td>',
        '<td>' + (row.course        || '—') + '</td>',
        '<td>' + (row.assignment_type || '—') + '</td>',
        '<td>' + (row.before_conf   || '—') + '</td>',
        '<td>' + (row.after_conf    || '—') + '</td>',
        '<td>' + (row.duration      || '—') + ' min</td>',
        '<td>' + (row.due_date      || '—') + '</td>',
        '<td><span class="badge ' + (row.dual_enroll ? 'badge-yes' : 'badge-no') + '">' + (row.dual_enroll ? 'Yes' : 'No') + '</span></td>',
        '<td style="max-width:200px;white-space:pre-wrap">' + (row.notes      || '—') + '</td>',
        '<td style="max-width:200px;white-space:pre-wrap">' + (row.next_steps || '—') + '</td>'
      ].join('');
      tbody.appendChild(tr);
    });

    tableWrap.style.display = "block";
  } catch (err) {
    loading.textContent = "Could not load consultation history.";
    console.error(err);
  }
}

// ── No Show (consultant-dashboard.html) ──────────────────────────────────────

async function loadNoShowOptions(preloaded) {
  const select = document.getElementById("noshow-id-select");
  if (!select) return;

  try {
    const options = preloaded !== undefined ? preloaded : ((await apiGet("signupOptions")).options || []);

    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.length ? "Choose a sign-up" : "No open sign-ups";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    options.forEach(function (opt) {
      const option = document.createElement("option");
      option.value = opt.consult_id;
      option.textContent = opt.label;
      option.dataset.student = opt.student_name;
      option.dataset.appt    = opt.date;
      option.dataset.course  = opt.course || '';
      option.dataset.teacher = opt.teacher_email;
      select.appendChild(option);
    });

    select.addEventListener("change", function () {
      const selected = select.options[select.selectedIndex];
      document.getElementById("preview-student").textContent = selected.dataset.student || '—';
      document.getElementById("preview-appt").textContent    = selected.dataset.appt    || '—';
      document.getElementById("preview-course").textContent  = selected.dataset.course  || '—';
      document.getElementById("preview-teacher").textContent = selected.dataset.teacher || '—';
      document.getElementById("noshow-preview").style.display = "block";
      document.getElementById("noshow-btn").disabled = false;
    });

  } catch (err) {
    select.innerHTML = "<option disabled selected>Could not load sign-ups</option>";
  }
}

async function loadRevertOptions(preloaded) {
  const select = document.getElementById("revert-id-select");
  if (!select) return;

  try {
    const options = preloaded !== undefined ? preloaded : ((await apiGet("noShowOptions")).options || []);

    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = options.length ? "Choose a no-show" : "No no-shows recorded";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    options.forEach(function (opt) {
      const option = document.createElement("option");
      option.value = opt.consult_id;
      option.textContent = opt.label;
      select.appendChild(option);
    });

    select.addEventListener("change", function () {
      document.getElementById("revert-btn").disabled = !select.value;
    });

  } catch (err) {
    select.innerHTML = "<option disabled selected>Could not load no-shows</option>";
  }
}

async function submitNoShow() {
  const select  = document.getElementById("noshow-id-select");
  const msgEl   = document.getElementById("noshow-message");
  const btn     = document.getElementById("noshow-btn");
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

async function submitRevert() {
  const select = document.getElementById("revert-id-select");
  const msgEl  = document.getElementById("revert-message");
  const btn    = document.getElementById("revert-btn");
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

// ── Hours Log (consultant-dashboard.html) ─────────────────────────────────────

async function loadHoursLog(name, preloaded) {
  const loading   = document.getElementById("hours-loading");
  const tableWrap = document.getElementById("hours-table-wrap");
  const empty     = document.getElementById("hours-empty");
  const tbody     = document.getElementById("hours-tbody");
  if (!loading) return;

  try {
    const rows = preloaded !== undefined ? preloaded : ((await apiGet("getHoursLog", { name: name })).rows || []);

    loading.style.display = "none";

    if (rows.length === 0) {
      empty.style.display = "block";
      return;
    }

    tbody.innerHTML = "";
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      tr.innerHTML = [
        '<td>' + (row.date        || '—') + '</td>',
        '<td>' + (row.hours       || '—') + ' hrs</td>',
        '<td>' + (row.description || '—') + '</td>',
        '<td>' + (row.submitted_at ? row.submitted_at.slice(0, 10) : '—') + '</td>'
      ].join('');
      tbody.appendChild(tr);
    });

    tableWrap.style.display = "block";

  } catch (err) {
    loading.textContent = "Could not load hours log.";
    console.error(err);
  }
}

function bindHoursLogForm(name) {
  const form = document.getElementById("hours-log-form");
  if (!form) return;

  const submitBtn = document.getElementById("hours-submit-btn");
  if (!submitBtn) return;

  submitBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    const msgEl = document.getElementById("hours-message");
    const btn = document.getElementById("hours-submit-btn");

    const date        = document.getElementById("hours-date").value.trim();
    const hours       = document.getElementById("hours-amount").value.trim();
    const description = document.getElementById("hours-description").value.trim();

    if (!date || !hours || !description) {
      msgEl.textContent = "Please fill in all fields.";
      msgEl.style.color = "#ffb4b4";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Submitting...";
    msgEl.textContent = "";

    try {
      const res = await apiPost("submitHoursLog", {
        consultant:  name,
        date:        date,
        hours:       Number(hours),
        description: description
      });

      if (res.ok) {
        msgEl.textContent = "Hours logged successfully!";
        msgEl.style.color = "var(--primary2)";
        form.reset();
        await loadHoursLog(name);
      } else {
        msgEl.textContent = res.error || "Failed to log hours.";
        msgEl.style.color = "#ffb4b4";
      }
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.style.color = "#ffb4b4";
    } finally {
      btn.disabled = false;
      btn.textContent = "Log Hours";
    }
  });
}
