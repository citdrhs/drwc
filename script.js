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
  const select = document.getElementById("signup-teacher-email");
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

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showMessage("signup-message", "Submitting...", false);

    const fd = new FormData(form);
    const firstName = (fd.get("firstName") || "").trim();
    const lastName  = (fd.get("lastName")  || "").trim();
    const studentName = (firstName + " " + lastName).trim();

    try {
      const res = await apiPost("submitSignup", {
        student_name:     studentName,
        student_email:    fd.get("studentEmail"),
        student_grade:    fd.get("studentGrade"),
        appointment_date: fd.get("appointmentDateTime"),
        teacher_email:    fd.get("teacherEmail"),
        course:           fd.get("courseInfo"),
        assignment_type:  fd.get("assignmentType"),
        google_doc_link:  fd.get("googleDocLink") || "",
        dual_enroll:      fd.get("dualEnroll") === "true"
      });

      if (res.ok) {
        showMessage("signup-message", "Sign-up submitted! Confirmation ID: " + res.consult_id, false);
        form.reset();
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
        duration:    Number(fd.get("duration")),
        due_date:    fd.get("dueDate"),
        notes:       fd.get("workedOn"),
        next_steps:  fd.get("nextSteps"),
        password:    fd.get("password")
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

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async function () {
  if (document.getElementById("signup-form")) {
    bindSignupForm();
    await loadTeachers();
  }

  if (document.getElementById("consultant-form")) {
    bindConsultationForm();
    await loadSignupOptions();
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
    pwToggle.textContent = hidden ? "🙈" : "👁";
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
