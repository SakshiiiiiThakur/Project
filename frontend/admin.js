/* admin.js — Admin login, notices CRUD, timeline rendering */

const API = window.BACKEND_URL || "";   // set by Flask-served index.html or fallback

/* ── State ──────────────────────────────────────────────────────────────── */
let adminToken = localStorage.getItem("adminToken") || null;
let adminUsername = localStorage.getItem("adminUsername") || null;

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const adminNavBtn = document.getElementById("adminNavBtn");
const adminOverlay = document.getElementById("adminOverlay");
const adminModalClose = document.getElementById("adminModalClose");
const adminUsername_el = document.getElementById("adminUsername");
const adminPassword_el = document.getElementById("adminPassword");
const adminError = document.getElementById("adminError");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLoginText = document.getElementById("adminLoginText");
const adminLoginSpinner = document.getElementById("adminLoginSpinner");
const adminPwToggle = document.getElementById("adminPwToggle");

const adminPanel = document.getElementById("adminPanel");
const adminPanelClose = document.getElementById("adminPanelClose");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminUserBadge = document.getElementById("adminUserBadge");

const newNoticeTitle = document.getElementById("newNoticeTitle");
const newNoticeBody = document.getElementById("newNoticeBody");
const newNoticeDate = document.getElementById("newNoticeDate");
const adminAddBtn = document.getElementById("adminAddBtn");
const addFeedback = document.getElementById("addFeedback");
const adminNoticesList = document.getElementById("adminNoticesList");
const noticeAttachZone = document.getElementById("noticeAttachZone");
const noticeFileInput = document.getElementById("noticeFileInput");
const noticeFileList = document.getElementById("noticeFileList");

// Pending files for the new notice form
let pendingFiles = [];

// Attach zone click
noticeAttachZone.addEventListener("click", () => noticeFileInput.click());
noticeFileInput.addEventListener("change", () => {
    Array.from(noticeFileInput.files).forEach(f => {
        if (!pendingFiles.find(p => p.name === f.name && p.size === f.size)) {
            pendingFiles.push(f);
        }
    });
    noticeFileInput.value = "";
    renderPendingFiles();
});

function getFileIcon(name) {
    const ext = name.split(".").pop().toLowerCase();
    if (ext === "pdf") return "fas fa-file-pdf";
    if (["doc", "docx"].includes(ext)) return "fas fa-file-word";
    if (["xls", "xlsx"].includes(ext)) return "fas fa-file-excel";
    if (["ppt", "pptx"].includes(ext)) return "fas fa-file-powerpoint";
    if (ext === "zip") return "fas fa-file-archive";
    return "fas fa-file-alt";
}

function renderPendingFiles() {
    noticeFileList.innerHTML = pendingFiles.map((f, i) => `
        <div class="notice-file-chip">
            <i class="file-icon ${getFileIcon(f.name)}"></i>
            <span class="chip-name" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
            <button class="chip-remove" onclick="removePendingFile(${i})" title="Remove"><i class="fas fa-times"></i></button>
        </div>`).join("");
}
window.removePendingFile = function (idx) {
    pendingFiles.splice(idx, 1);
    renderPendingFiles();
};

const editOverlay = document.getElementById("editOverlay");
const editModalClose = document.getElementById("editModalClose");
const editNoticeId = document.getElementById("editNoticeId");
const editNoticeTitle = document.getElementById("editNoticeTitle");
const editNoticeBody = document.getElementById("editNoticeBody");
const editNoticeDate = document.getElementById("editNoticeDate");
const editSaveBtn = document.getElementById("editSaveBtn");
const editError = document.getElementById("editError");

const noticesTimeline = document.getElementById("noticesTimeline");

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function authHeaders() {
    return {
        "Content-Type": "application/json",
        "X-Admin-Token": adminToken || "",
    };
}

function showFeedback(el, msg, isError = false) {
    el.textContent = msg;
    el.style.color = isError ? "var(--danger, #e53e3e)" : "var(--success, #38a169)";
    setTimeout(() => { el.textContent = ""; }, 3500);
}

function defaultDate() {
    return new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
}

/* ── Render notices on the public timeline ───────────────────────────────── */
function renderTimeline(notices) {
    if (!noticesTimeline) return;
    if (!notices.length) {
        noticesTimeline.innerHTML = `<p style="text-align:center;color:#888;padding:2rem">No notices yet.</p>`;
        return;
    }
    noticesTimeline.innerHTML = notices.map(n => `
        <div class="timeline-item" data-id="${n.id}">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
                <span class="timeline-date">${n.date || ""}</span>
                <h3>${escHtml(n.title)}</h3>
                <p>${escHtml(n.body)}</p>
            </div>
        </div>
    `).join("");
}

function escHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Render notices in admin panel ───────────────────────────────────────── */
function buildAttachmentsHtml(n) {
    const atts = n.attachments || [];
    if (!atts.length) return "";
    return `<div class="notice-card-attachments">${atts.map(a => `
        <span class="notice-card-att-chip">
            <i class="${getFileIcon(a.original_name || a.filename)}"></i>
            <a href="${API}/uploads/${a.filename}" target="_blank" style="color:inherit;text-decoration:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(a.original_name || a.filename)}">${escHtml(a.original_name || a.filename)}</a>
            <button class="notice-card-att-del" onclick="deleteNoticeAttachment('${n.id}','${a.filename}')" title="Remove file"><i class="fas fa-times"></i></button>
        </span>`).join("")}
    </div>`;
}

function renderAdminList(notices) {
    if (!notices.length) {
        adminNoticesList.innerHTML = `<p style="color:#888;font-size:13px">No notices yet. Add one above.</p>`;
        return;
    }
    adminNoticesList.innerHTML = notices.map(n => `
        <div class="admin-notice-card" data-id="${n.id}">
            <div class="admin-notice-info">
                <span class="admin-notice-date">${n.date || ""}</span>
                <strong>${escHtml(n.title)}</strong>
                <p>${escHtml(n.body.substring(0, 90))}${n.body.length > 90 ? "…" : ""}</p>
                ${buildAttachmentsHtml(n)}
            </div>
            <div class="admin-notice-btns">
                <button class="admin-edit-btn"   onclick="openEditModal('${n.id}')"><i class="fas fa-pencil-alt"></i></button>
                <button class="admin-delete-btn" onclick="deleteNotice('${n.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join("");
}

/* ── Load & refresh notices ─────────────────────────────────────────────── */
async function loadNotices() {
    try {
        const res = await fetch(`${API}/admin/notices`);
        const data = await res.json();
        renderTimeline(data);
        if (adminToken) renderAdminList(data);
    } catch (e) {
        console.warn("Could not load notices:", e);
    }
}

/* ── Nav button: open login or panel ─────────────────────────────────────── */
adminNavBtn.addEventListener("click", () => {
    if (adminToken) {
        openAdminPanel();
    } else {
        openLoginModal();
    }
});

/* ── Login modal ─────────────────────────────────────────────────────────── */
function openLoginModal() {
    adminOverlay.classList.add("active");
    adminUsername_el.value = "";
    adminPassword_el.value = "";
    adminError.textContent = "";
    setTimeout(() => adminUsername_el.focus(), 100);
}

function closeLoginModal() {
    adminOverlay.classList.remove("active");
}

adminModalClose.addEventListener("click", closeLoginModal);
adminOverlay.addEventListener("click", e => { if (e.target === adminOverlay) closeLoginModal(); });

adminPwToggle.addEventListener("click", () => {
    const isPw = adminPassword_el.type === "password";
    adminPassword_el.type = isPw ? "text" : "password";
    adminPwToggle.querySelector("i").className = isPw ? "fas fa-eye-slash" : "fas fa-eye";
});

adminPassword_el.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

adminLoginBtn.addEventListener("click", doLogin);

async function doLogin() {
    const username = adminUsername_el.value.trim();
    const password = adminPassword_el.value;
    if (!username || !password) {
        adminError.textContent = "Please enter username and password.";
        return;
    }
    adminLoginText.style.display = "none";
    adminLoginSpinner.style.display = "inline-block";
    adminError.textContent = "";

    try {
        const res = await fetch(`${API}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (res.ok) {
            adminToken = data.token;
            adminUsername = data.username;
            localStorage.setItem("adminToken", adminToken);
            localStorage.setItem("adminUsername", adminUsername);
            closeLoginModal();
            openAdminPanel();
            loadNotices();
        } else {
            adminError.textContent = data.message || "Login failed.";
        }
    } catch {
        adminError.textContent = "Server not reachable. Is the Flask server running?";
    } finally {
        adminLoginText.style.display = "inline";
        adminLoginSpinner.style.display = "none";
    }
}

/* ── Admin panel ─────────────────────────────────────────────────────────── */
function openAdminPanel() {
    adminPanel.classList.add("active");
    adminUserBadge.textContent = adminUsername || "admin";
    adminNavBtn.innerHTML = `<i class="fas fa-user-shield"></i> ${adminUsername || "Admin"}`;
    loadNotices();
}

adminPanelClose.addEventListener("click", () => adminPanel.classList.remove("active"));

adminLogoutBtn.addEventListener("click", async () => {
    if (adminToken) {
        await fetch(`${API}/admin/logout`, {
            method: "POST", headers: authHeaders()
        }).catch(() => { });
    }
    adminToken = null;
    adminUsername = null;
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUsername");
    adminPanel.classList.remove("active");
    adminNavBtn.innerHTML = `<i class="fas fa-user-shield"></i> Admin`;
    loadNotices();  // re-render public timeline
});

/* ── Add notice ──────────────────────────────────────────────────────────── */
adminAddBtn.addEventListener("click", async () => {
    const title = newNoticeTitle.value.trim();
    const body = newNoticeBody.value.trim();
    const date = newNoticeDate.value.trim() || defaultDate();
    if (!title || !body) {
        showFeedback(addFeedback, "Title and description are required.", true);
        return;
    }
    adminAddBtn.disabled = true;
    adminAddBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Adding…`;
    try {
        const res = await fetch(`${API}/admin/notices`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ title, body, date }),
        });
        const data = await res.json();
        if (res.ok) {
            const noticeId = data.notice.id;
            // Upload pending attachments
            for (const file of pendingFiles) {
                const fd = new FormData();
                fd.append("file", file);
                await fetch(`${API}/admin/notices/${noticeId}/attachments`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${adminToken}` },
                    body: fd,
                }).catch(() => { });
            }
            newNoticeTitle.value = "";
            newNoticeBody.value = "";
            newNoticeDate.value = "";
            pendingFiles = [];
            renderPendingFiles();
            showFeedback(addFeedback, "✅ Notice added successfully!");
            loadNotices();
        } else {
            showFeedback(addFeedback, data.message || "Failed to add notice.", true);
        }
    } catch {
        showFeedback(addFeedback, "Server error. Try again.", true);
    } finally {
        adminAddBtn.disabled = false;
        adminAddBtn.innerHTML = `<i class="fas fa-plus"></i> Add Notice`;
    }
});

/* ── Edit notice ─────────────────────────────────────────────────────────── */
// Keep a local cache of notices for the edit modal
let _noticesCache = [];
fetch(`${API}/admin/notices`).then(r => r.json()).then(d => { _noticesCache = d; }).catch(() => { });

function openEditModal(id) {
    fetch(`${API}/admin/notices`).then(r => r.json()).then(notices => {
        _noticesCache = notices;
        const n = notices.find(x => x.id === id);
        if (!n) return;
        editNoticeId.value = n.id;
        editNoticeTitle.value = n.title;
        editNoticeBody.value = n.body;
        editNoticeDate.value = n.date || "";
        editError.textContent = "";
        editOverlay.classList.add("active");
        setTimeout(() => editNoticeTitle.focus(), 100);
    });
}

editModalClose.addEventListener("click", () => editOverlay.classList.remove("active"));
editOverlay.addEventListener("click", e => { if (e.target === editOverlay) editOverlay.classList.remove("active"); });

editSaveBtn.addEventListener("click", async () => {
    const id = editNoticeId.value;
    const title = editNoticeTitle.value.trim();
    const body = editNoticeBody.value.trim();
    const date = editNoticeDate.value.trim();
    if (!title || !body) {
        editError.textContent = "Title and description are required.";
        return;
    }
    editSaveBtn.disabled = true;
    editSaveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving…`;
    try {
        const res = await fetch(`${API}/admin/notices/${id}`, {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify({ title, body, date }),
        });
        const data = await res.json();
        if (res.ok) {
            editOverlay.classList.remove("active");
            loadNotices();
        } else {
            editError.textContent = data.message || "Failed to save.";
        }
    } catch {
        editError.textContent = "Server error. Try again.";
    } finally {
        editSaveBtn.disabled = false;
        editSaveBtn.innerHTML = `<i class="fas fa-save"></i> Save Changes`;
    }
});

/* ── Delete notice ───────────────────────────────────────────────────────── */
async function deleteNotice(id) {
    if (!confirm("Delete this notice? This cannot be undone.")) return;
    try {
        const res = await fetch(`${API}/admin/notices/${id}`, {
            method: "DELETE", headers: authHeaders()
        });
        if (res.ok) loadNotices();
        else alert("Failed to delete notice.");
    } catch {
        alert("Server error.");
    }
}

/* ── Delete notice attachment ────────────────────────────────────────────── */
window.deleteNoticeAttachment = async function (noticeId, filename) {
    if (!confirm("Remove this attachment?")) return;
    try {
        const res = await fetch(`${API}/admin/notices/${noticeId}/attachments/${filename}`, {
            method: "DELETE", headers: authHeaders()
        });
        if (res.ok) loadNotices();
        else alert("Failed to remove attachment.");
    } catch {
        alert("Server error.");
    }
};

/* ── NLP Command Interface ───────────────────────────────────────────────── */
window.fillNlpCommand = function (el) {
    const inp = document.getElementById("nlpCommandInput");
    if (inp) inp.value = el.textContent;
};

const nlpSendBtn = document.getElementById("nlpSendBtn");
const nlpResult = document.getElementById("nlpResult");
const nlpCommandInp = document.getElementById("nlpCommandInput");

if (nlpSendBtn) {
    nlpSendBtn.addEventListener("click", sendNlpCommand);
}
if (nlpCommandInp) {
    nlpCommandInp.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") sendNlpCommand();
    });
}

async function sendNlpCommand() {
    const command = (nlpCommandInp?.value || "").trim();
    if (!command) return;

    nlpResult.style.display = "";
    nlpResult.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing command...`;
    nlpResult.style.background = "#f0f4ff";
    nlpResult.style.color = "#333";
    nlpResult.style.padding = "10px 14px";
    nlpResult.style.borderRadius = "8px";
    nlpResult.style.marginTop = "10px";
    nlpSendBtn.disabled = true;

    try {
        const res = await fetch(`${API}/admin/nlp-command`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ command }),
        });
        const data = await res.json();

        if (res.ok && data.status === "ok") {
            nlpResult.style.background = "#f0fff4";
            nlpResult.style.color = "#276749";
            nlpResult.innerHTML = `
                <strong>${data.message || "Done!"}</strong><br>
                <small style="color:#555">${data.explanation || ""}</small>
                ${data.confidence !== undefined ? `<br><small style="color:#888">Confidence: ${Math.round(data.confidence * 100)}%</small>` : ""}
            `;
            nlpCommandInp.value = "";
            await loadNotices();
        } else {
            nlpResult.style.background = "#fff5f5";
            nlpResult.style.color = "#c53030";
            nlpResult.innerHTML = `<strong>❌ ${data.message || "Command failed"}</strong><br>
                <small>${data.explanation || ""}</small>`;
        }
    } catch (e) {
        nlpResult.style.background = "#fff5f5";
        nlpResult.style.color = "#c53030";
        nlpResult.innerHTML = `<strong>❌ Connection error</strong>`;
    } finally {
        nlpSendBtn.disabled = false;
    }
}

/* ── Init ────────────────────────────────────────────────────────────────── */
(async function init() {
    if (adminToken && adminUsername) {
        adminNavBtn.innerHTML = `<i class="fas fa-user-shield"></i> ${adminUsername}`;
    }
    await loadNotices();
})();