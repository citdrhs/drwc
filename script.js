const API_URL = "https://script.google.com/macros/s/AKfycbz6eduq4w8NGB4ccOuqvq9FMqXbcMrW2jbDxap3cnAFvjj0CjzD2df2zw5OOIyzMGgznw/exec";

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
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: action, payload: payload })
  });
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return res.json();
}

// ── Signup form (signups.html) ────────────────────────────────────────────────

function renderTeacherOptions(teachers) {
  const select      = document.getElementById("signup-teacher-email");
  const manualFields = document.getElementById("manual-teacher-fields");
  const nameInput   = document.getElementById("manual-teacher-name");
  const emailInput  = document.getElementById("manual-teacher-email");
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

  // Add "not listed" option at the bottom
  const notListed = document.createElement("option");
  notListed.value = "not_listed";
  notListed.textContent = "My teacher isn't listed...";
  select.appendChild(notListed);

  // Show/hide manual fields based on selection
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

        // Reset form
        form.reset();
        manualFields.style.display = "none";
        nameInput.required  = false;
        emailInput.required = false;

        // Reset teacher dropdown back to placeholder
        const teacherSelect = document.getElementById("signup-teacher-email");
        if (teacherSelect) teacherSelect.selectedIndex = 0;

        // Reload appointments so spot count updates
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

async function loadSignupOptions() {
  const select = document.getElementById("consult-id-select");
  if (!select) return;

  try {
    const data = await apiGet("signupOptions");
    const options = data.options || [];

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
      select.appendChild(option);
    });
  } catch (err) {
    const sel = document.getElementById("consult-id-select");
    if (sel) {
      sel.innerHTML = "";
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Could not load sign-ups";
      opt.disabled = true;
      opt.selected = true;
      sel.appendChild(opt);
    }
  }
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
        consult_id:  fd.get("consultId"),
        consultant:  fd.get("consultantName"),
        before_conf: fd.get("beforeConfidence"),
        after_conf:  fd.get("afterConfidence"),
        duration: Number(fd.get("duration")) || 0,
        dual_enroll: fd.get("dualEnroll") === "true",
        due_date:    fd.get("dueDate"),
        notes:       fd.get("workedOn"),
        next_steps:  fd.get("nextSteps"),
        password:    ""
      });

      if (res.ok) {
        showMessage("consultant-message", "Submitted! Consultation ID: " + res.consult_id, false);
        form.reset();
        await loadSignupOptions();
      } else {
        showMessage("consultant-message", res.error || "Submission failed.", true);
      }
    } catch (err) {
      showMessage("consultant-message", err.message, true);
    }
  });
}

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

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async function () {
  if (document.getElementById("signup-form")) {
    bindSignupForm();
    await Promise.all([loadTeachers(), loadAppointments()]);
  }

  if (document.getElementById("consultant-form")) {
    bindConsultationForm();
    await Promise.all([loadSignupOptions(), loadConsultants()]);
  }
});

// ── Login page (login.html) ───────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  const pwInput  = document.getElementById("login-password");
  const loginBtn = document.getElementById("login-btn");
  const msgEl    = document.getElementById("login-message");
  const pwToggle = document.getElementById("pw-toggle");

  if (!pwInput || !loginBtn || !msgEl || !pwToggle) return; // not on login page

  const SESSION_KEY = "wc_consultant_auth";

  pwToggle.addEventListener("click", function () {
    const hidden = pwInput.type === "password";
    pwInput.type = hidden ? "text" : "password";
    pwToggle.textContent = hidden ? "Hide" : "Show";
  });

  pwInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleLogin();
  });

  loginBtn.addEventListener("click", handleLogin);

  async function handleLogin() {
    const password = pwInput.value.trim();
    if (!password) {
      showMsg("Please enter your access code.", "error");
      return;
    }

    setLoading(true);
    showMsg("Checking...", "info");

    try {
      const url = new URL(API_URL);
      url.searchParams.set("action", "checkPassword");
      url.searchParams.set("password", password);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (!res.ok) throw new Error("Network error");
      const data = await res.json();

      if (data.ok) {
        sessionStorage.setItem(SESSION_KEY, "true");
        showMsg("Access granted! Redirecting...", "info");
        setTimeout(function () {
          window.location.href = "./consultant-form.html";
        }, 800);
      } else {
        showMsg("Incorrect access code. Please try again.", "error");
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

//loading consultants 
async function loadConsultants() {
  const select = document.getElementById("consultant-name-select");
  if (!select) return;

  try {
    const data = await apiGet("getConsultants");
    const consultants = data.consultants || [];

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

    consultants.forEach(function (name) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });

  } catch (err) {
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Could not load consultants";
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
  }
}