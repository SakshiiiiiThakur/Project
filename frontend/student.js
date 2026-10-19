/* student.js — Role-based Student/Visitor login, profile, and filtered notices */

const SAPI = window.BACKEND_URL || "";

/* ── State ─────────────────────────────────────────────────────────────────── */
let studentToken   = localStorage.getItem("studentToken")   || null;
let studentProfile = JSON.parse(localStorage.getItem("studentProfile") || "null");

/* ── DOM refs ───────────────────────────────────────────────────────────────── */
const studentNavBtn      = document.getElementById("studentNavBtn");
const studentNavLabel    = document.getElementById("studentNavLabel");
const studentOverlay     = document.getElementById("studentOverlay");
const studentModalClose  = document.getElementById("studentModalClose");
const studentPanel       = document.getElementById("studentPanel");
const studentPanelClose  = document.getElementById("studentPanelClose");
const studentLogoutBtn   = document.getElementById("studentLogoutBtn");
const studentRoleBadge   = document.getElementById("studentRoleBadge");
const studentProfileCard = document.getElementById("studentProfileCard");
const studentNoticesList = document.getElementById("studentNoticesList");

/* Login form */
const studentLoginBtn      = document.getElementById("studentLoginBtn");
const studentLoginText     = document.getElementById("studentLoginText");
const studentLoginSpinner  = document.getElementById("studentLoginSpinner");
const studentLoginError    = document.getElementById("studentLoginError");

/* Register form */
const studentRegisterBtn   = document.getElementById("studentRegisterBtn");
const studentRegisterError = document.getElementById("studentRegisterError");
const regRole              = document.getElementById("regRole");

/* ── Tab switcher ───────────────────────────────────────────────────────────── */
window.switchStudentTab = function(tab) {
    document.getElementById("tabLogin").classList.toggle("active", tab === "login");
    document.getElementById("tabRegister").classList.toggle("active", tab === "register");
    document.getElementById("studentLoginForm").style.display    = tab === "login"    ? "" : "none";
    document.getElementById("studentRegisterForm").style.display = tab === "register" ? "" : "none";
};

/* Show/hide dept+year fields based on role selection */
if (regRole) {
    regRole.addEventListener("change", () => {
        const isStudent = regRole.value === "student";
        document.getElementById("regDeptWrap").style.display  = isStudent ? "" : "none";
        document.getElementById("regYearWrap").style.display  = isStudent ? "" : "none";
    });
}

/* ── Nav button click ───────────────────────────────────────────────────────── */
if (studentNavBtn) {
    studentNavBtn.addEventListener("click", () => {
        if (studentToken && studentProfile) {
            openStudentPanel();
        } else {
            studentOverlay.style.display = "flex";
        }
    });
}

if (studentModalClose) {
    studentModalClose.addEventListener("click", () => {
        studentOverlay.style.display = "none";
    });
}
if (studentPanelClose) {
    studentPanelClose.addEventListener("click", () => {
        studentPanel.style.display = "none";
    });
}

/* ── Login ──────────────────────────────────────────────────────────────────── */
if (studentLoginBtn) {
    studentLoginBtn.addEventListener("click", async () => {
        const username = document.getElementById("studentUsername").value.trim();
        const password = document.getElementById("studentPassword").value;
        if (!username || !password) {
            studentLoginError.textContent = "Please enter username and password.";
            return;
        }
        studentLoginText.textContent = "Logging in...";
        if (studentLoginSpinner) studentLoginSpinner.style.display = "";
        studentLoginError.textContent = "";

        try {
            const res  = await fetch(`${SAPI}/student/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (res.ok && data.status === "ok") {
                studentToken   = data.token;
                studentProfile = { name: data.name, role: data.role, department: data.department, year: data.year };
                localStorage.setItem("studentToken",   studentToken);
                localStorage.setItem("studentProfile", JSON.stringify(studentProfile));
                studentOverlay.style.display = "none";
                updateStudentNav();
                openStudentPanel();
            } else {
                studentLoginError.textContent = data.message || "Login failed.";
            }
        } catch (e) {
            studentLoginError.textContent = "Connection error.";
        } finally {
            studentLoginText.textContent = "Login";
            if (studentLoginSpinner) studentLoginSpinner.style.display = "none";
        }
    });
}

/* ── Register ───────────────────────────────────────────────────────────────── */
if (studentRegisterBtn) {
    studentRegisterBtn.addEventListener("click", async () => {
        const name       = document.getElementById("regName").value.trim();
        const username   = document.getElementById("regUsername").value.trim();
        const password   = document.getElementById("regPassword").value;
        const role       = regRole.value;
        const department = document.getElementById("regDepartment")?.value || "";
        const year       = document.getElementById("regYear")?.value       || "";

        if (!name || !username || !password) {
            studentRegisterError.textContent = "Name, username and password are required.";
            return;
        }
        studentRegisterError.textContent = "";
        studentRegisterBtn.disabled = true;
        studentRegisterBtn.querySelector("span").textContent = "Registering...";

        try {
            const res  = await fetch(`${SAPI}/student/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, username, password, role, department, year }),
            });
            const data = await res.json();
            if (res.ok && data.status === "ok") {
                studentRegisterError.style.color = "green";
                studentRegisterError.textContent  = "✅ Registered! Please login.";
                switchStudentTab("login");
                document.getElementById("studentUsername").value = username;
            } else {
                studentRegisterError.style.color = "red";
                studentRegisterError.textContent  = data.message || "Registration failed.";
            }
        } catch (e) {
            studentRegisterError.textContent = "Connection error.";
        } finally {
            studentRegisterBtn.disabled = false;
            studentRegisterBtn.querySelector("span").textContent = "Register";
        }
    });
}

/* ── Logout ─────────────────────────────────────────────────────────────────── */
if (studentLogoutBtn) {
    studentLogoutBtn.addEventListener("click", async () => {
        if (studentToken) {
            await fetch(`${SAPI}/student/logout`, {
                method: "POST",
                headers: { "X-Student-Token": studentToken },
            }).catch(() => {});
        }
        studentToken   = null;
        studentProfile = null;
        localStorage.removeItem("studentToken");
        localStorage.removeItem("studentProfile");
        studentPanel.style.display = "none";
        updateStudentNav();
    });
}

/* ── Open student panel ─────────────────────────────────────────────────────── */
function openStudentPanel() {
    if (!studentProfile) return;
    studentPanel.style.display = "";

    // Role badge
    const roleColors = { student: "#3182ce", visitor: "#718096" };
    studentRoleBadge.textContent    = studentProfile.role.charAt(0).toUpperCase() + studentProfile.role.slice(1);
    studentRoleBadge.style.background = roleColors[studentProfile.role] || "#888";

    // Profile card
    studentProfileCard.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
            <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);
                        display:flex;align-items:center;justify-content:center;font-size:22px;color:white">
                ${studentProfile.name.charAt(0).toUpperCase()}
            </div>
            <div>
                <div style="font-weight:700;font-size:16px">${esc(studentProfile.name)}</div>
                <div style="color:#888;font-size:13px;margin-top:2px">
                    ${studentProfile.role === "student"
                        ? `${esc(studentProfile.year || "")} ${esc(studentProfile.department || "")}`
                        : "Visitor"}
                </div>
            </div>
        </div>
        ${studentProfile.department ? `
        <div style="background:#f7f8fc;border-radius:8px;padding:10px 14px;font-size:13px;color:#555">
            <i class="fas fa-graduation-cap" style="margin-right:6px;color:#667eea"></i>
            <strong>Department:</strong> ${esc(studentProfile.department)}<br>
            <i class="fas fa-layer-group" style="margin-right:6px;color:#667eea;margin-top:4px"></i>
            <strong>Year:</strong> ${esc(studentProfile.year || "—")}
        </div>` : ""}
    `;

    loadStudentNotices();
}

/* ── Load role-filtered notices ─────────────────────────────────────────────── */
async function loadStudentNotices() {
    if (!studentNoticesList) return;
    studentNoticesList.innerHTML = `<p style="color:#888;font-size:13px"><i class="fas fa-spinner fa-spin"></i> Loading...</p>`;

    try {
        const dept = studentProfile?.department || "";
        const res  = await fetch(`${SAPI}/notices/public?department=${encodeURIComponent(dept)}`, {
            headers: studentToken ? { "X-Student-Token": studentToken } : {},
        });
        const data = await res.json();
        const notices = data.notices || [];

        if (notices.length === 0) {
            studentNoticesList.innerHTML = `<p style="color:#888;font-size:13px">No notices found.</p>`;
            return;
        }

        const filteredNote = data.filtered
            ? `<p style="font-size:11px;color:#667eea;margin-bottom:10px">
                   <i class="fas fa-filter"></i> Filtered for: ${esc(data.department)}
               </p>` : "";

        studentNoticesList.innerHTML = filteredNote + notices.slice(0, 8).map(n => `
            <div style="border:1px solid #eee;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#fff">
                <div style="font-size:11px;color:#999;margin-bottom:3px">${esc(n.date || "")}</div>
                <div style="font-weight:600;font-size:13px;color:#333">${esc(n.title)}</div>
                <div style="font-size:12px;color:#666;margin-top:4px">${esc(n.body.substring(0, 100))}${n.body.length > 100 ? "…" : ""}</div>
            </div>
        `).join("");
    } catch (e) {
        studentNoticesList.innerHTML = `<p style="color:#e53e3e;font-size:13px">Failed to load notices.</p>`;
    }
}

/* ── Update nav button ───────────────────────────────────────────────────────── */
function updateStudentNav() {
    if (!studentNavBtn || !studentNavLabel) return;
    if (studentProfile) {
        studentNavLabel.textContent = studentProfile.name.split(" ")[0]; // first name
        studentNavBtn.style.background = "linear-gradient(135deg,#667eea,#764ba2)";
        studentNavBtn.style.color = "white";
    } else {
        studentNavLabel.textContent = "Login";
        studentNavBtn.style.background = "";
        studentNavBtn.style.color = "";
    }
}

function esc(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ── Init on page load ───────────────────────────────────────────────────────── */
updateStudentNav();
