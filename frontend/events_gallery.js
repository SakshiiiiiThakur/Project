(function () {
    "use strict";

    const API = window.BACKEND_URL || "";

    /* ══════════════════════════════════════════════════════════════════════
       ① PUBLIC GALLERY
    ══════════════════════════════════════════════════════════════════════ */

    let _allEvents = [];
    let _activeFilter = "All";
    let _searchQuery = "";

    // Lightbox state
    let _lbPhotos = [];
    let _lbIdx = 0;

    /* ── Fetch & render ─────────────────────────────────────────────────── */
    async function fetchPublicEvents() {
        try {
            const res = await fetch(`${API}/events/public`);
            _allEvents = await res.json();
        } catch {
            _allEvents = [];
        }
        renderSlideshow(_allEvents);
        renderGallery();
    }

    /* ── Slideshow ──────────────────────────────────────────────────────── */
    let _ssIdx = 0;
    let _ssTimer = null;
    let _ssEvents = [];

    // Each slide = one photo from any event (all photos flattened)
    // _ssSlides = [{url, title, category, description, eventId}]
    let _ssSlides = [];

    function renderSlideshow(events) {
        const ss = document.getElementById("egSlideshow");
        const track = document.getElementById("egSlidesTrack");
        const dots = document.getElementById("egSlideDots");
        if (!ss || !track || !dots) return;

        // Flatten: one slide per photo across all events (max 20 slides)
        _ssSlides = [];
        events.forEach(ev => {
            if (ev.photos && ev.photos.length) {
                ev.photos.forEach(ph => {
                    _ssSlides.push({
                        url: ph.url,
                        title: ev.title,
                        category: ev.category || "General",
                        description: ev.description || "",
                        eventId: ev.id
                    });
                });
            }
        });

        // If no photos at all, show event-name-only slides
        if (!_ssSlides.length) {
            _ssSlides = events.slice(0, 6).map(ev => ({
                url: null, title: ev.title,
                category: ev.category || "General",
                description: ev.description || "", eventId: ev.id
            }));
        }

        _ssSlides = _ssSlides.slice(0, 20);
        if (!_ssSlides.length) { ss.classList.remove("visible"); return; }
        ss.classList.add("visible");

        track.innerHTML = _ssSlides.map((sl, i) => {
            const img = sl.url
                ? `<img class="eg-slide-img" src="${_esc(sl.url)}" alt="${_esc(sl.title)}">`
                : `<div class="eg-slide-placeholder">📸</div>`;
            const desc = sl.description.slice(0, 90) + (sl.description.length > 90 ? "…" : "");
            return `<div class="eg-slide" data-i="${i}">
                        ${img}
                        <div class="eg-slide-caption">
                            <span class="eg-cat-tag">${_esc(sl.category)}</span>
                            <h3>${_esc(sl.title)}</h3>
                            ${desc ? `<p>${_esc(desc)}</p>` : ""}
                        </div>
                    </div>`;
        }).join("");

        dots.innerHTML = _ssSlides.map((_, i) =>
            `<button class="eg-slide-dot${i === 0 ? " active" : ""}" data-i="${i}"></button>`
        ).join("");

        dots.querySelectorAll(".eg-slide-dot").forEach(d => {
            d.addEventListener("click", () => { goSlide(+d.dataset.i); resetAutoplay(); });
        });

        // Click slide → open lightbox for that event
        track.querySelectorAll(".eg-slide").forEach((slide, i) => {
            slide.style.cursor = "pointer";
            slide.addEventListener("click", () => {
                const ev = events.find(e => e.id === _ssSlides[i].eventId);
                if (ev && ev.photos && ev.photos.length) openLightbox(ev.id);
            });
        });

        _ssIdx = 0;
        updateSlide();
        clearInterval(_ssTimer);
        startAutoplay();

        document.getElementById("egSlidePrev").onclick = () => { goSlide((_ssIdx - 1 + _ssSlides.length) % _ssSlides.length); resetAutoplay(); };
        document.getElementById("egSlideNext").onclick = () => { goSlide((_ssIdx + 1) % _ssSlides.length); resetAutoplay(); };

        ss.onmouseenter = () => clearInterval(_ssTimer);
        ss.onmouseleave = () => startAutoplay();
    }

    function goSlide(idx) {
        _ssIdx = idx;
        updateSlide();
    }

    function updateSlide() {
        const track = document.getElementById("egSlidesTrack");
        const dots = document.getElementById("egSlideDots");
        if (track) track.style.transform = `translateX(-${_ssIdx * 100}%)`;
        if (dots) {
            dots.querySelectorAll(".eg-slide-dot").forEach((d, i) => {
                d.classList.toggle("active", i === _ssIdx);
            });
        }
    }

    function startAutoplay() {
        clearInterval(_ssTimer);
        _ssTimer = setInterval(() => {
            if (!_ssSlides.length) return;
            _ssIdx = (_ssIdx + 1) % _ssSlides.length;
            updateSlide();
        }, 3000);
    }

    function resetAutoplay() {
        clearInterval(_ssTimer);
        startAutoplay();
    }

    function renderGallery() {
        const grid = document.getElementById("egGrid");
        if (!grid) return;

        const q = _searchQuery.toLowerCase();
        const filtered = _allEvents.filter(ev => {
            const matchCat = _activeFilter === "All" || ev.category === _activeFilter;
            const matchText = !q ||
                ev.title.toLowerCase().includes(q) ||
                (ev.description || "").toLowerCase().includes(q);
            return matchCat && matchText;
        });

        if (!filtered.length) {
            grid.innerHTML = `<div class="eg-empty">
                <i class="fas fa-images" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:.4"></i>
                <p>No events found. Check back soon!</p>
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(ev => {
            const cover = ev.photos && ev.photos.length ? ev.photos[0].url : null;
            const banner = cover
                ? `<img class="eg-card-cover" src="${cover}" alt="${_esc(ev.title)}" loading="lazy">`
                : `<div class="eg-card-placeholder">📸</div>`;
            const desc = (ev.description || "").slice(0, 105) +
                ((ev.description || "").length > 105 ? "…" : "");
            const count = ev.photos && ev.photos.length
                ? `<span>📷 ${ev.photos.length}</span>` : "";

            return `<div class="eg-card" data-id="${_esc(ev.id)}">
                ${banner}
                <div class="eg-card-body">
                    <span class="eg-cat-tag">${_esc(ev.category || "General")}</span>
                    <h3>${_esc(ev.title)}</h3>
                    <p>${desc ? _esc(desc) : "<em style='color:#aaa'>No description.</em>"}</p>
                    <div class="eg-card-meta">
                        <span>📅 ${_esc(ev.event_date || "—")}</span>
                        ${count}
                    </div>
                </div>
            </div>`;
        }).join("");

        // Bind card clicks
        grid.querySelectorAll(".eg-card").forEach(card => {
            card.addEventListener("click", () => openLightbox(card.dataset.id));
        });
    }

    /* ── Filter buttons ─────────────────────────────────────────────────── */
    function bindGalleryFilters() {
        document.querySelectorAll(".eg-filter-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".eg-filter-btn")
                    .forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                _activeFilter = btn.dataset.cat;
                renderGallery();
            });
        });

        const searchEl = document.getElementById("egSearch");
        if (searchEl) {
            let t;
            searchEl.addEventListener("input", e => {
                clearTimeout(t);
                t = setTimeout(() => {
                    _searchQuery = e.target.value.trim();
                    renderGallery();
                }, 250);
            });
        }
    }

    /* ── Lightbox ────────────────────────────────────────────────────────── */
    function openLightbox(eventId) {
        const ev = _allEvents.find(e => e.id === eventId);
        if (!ev || !ev.photos || !ev.photos.length) return;

        _lbPhotos = ev.photos;
        _lbIdx = 0;

        document.getElementById("egLbTitle").textContent = ev.title;
        document.getElementById("egLbSub").textContent =
            `${ev.category || ""}  ·  ${ev.event_date || ""}`;
        document.getElementById("egLbDesc").textContent = ev.description || "";

        // Thumbnails
        const thumbsEl = document.getElementById("egLbThumbs");
        thumbsEl.innerHTML = _lbPhotos.map((p, i) =>
            `<img class="eg-lb-thumb${i === 0 ? " active" : ""}"
                  src="${_esc(p.url)}" data-i="${i}" loading="lazy" alt="thumb">`
        ).join("");
        thumbsEl.querySelectorAll(".eg-lb-thumb").forEach(t =>
            t.addEventListener("click", () => lbShow(parseInt(t.dataset.i)))
        );

        lbShow(0);
        document.getElementById("egLightbox").classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function lbShow(i) {
        _lbIdx = (i + _lbPhotos.length) % _lbPhotos.length;
        document.getElementById("egLbImg").src = _lbPhotos[_lbIdx].url;
        document.querySelectorAll(".eg-lb-thumb").forEach((t, j) =>
            t.classList.toggle("active", j === _lbIdx)
        );
        // Scroll active thumb into view
        const active = document.querySelector(".eg-lb-thumb.active");
        if (active) active.scrollIntoView({ inline: "nearest", behavior: "smooth" });
    }

    function closeLightbox() {
        document.getElementById("egLightbox").classList.remove("open");
        document.body.style.overflow = "";
    }

    function bindLightbox() {
        document.getElementById("egLbClose").addEventListener("click", closeLightbox);
        document.getElementById("egLbPrev").addEventListener("click",
            () => lbShow(_lbIdx - 1));
        document.getElementById("egLbNext").addEventListener("click",
            () => lbShow(_lbIdx + 1));
        document.getElementById("egLightbox").addEventListener("click", e => {
            if (e.target === document.getElementById("egLightbox")) closeLightbox();
        });
        document.addEventListener("keydown", e => {
            const lb = document.getElementById("egLightbox");
            if (!lb || !lb.classList.contains("open")) return;
            if (e.key === "ArrowRight") lbShow(_lbIdx + 1);
            if (e.key === "ArrowLeft") lbShow(_lbIdx - 1);
            if (e.key === "Escape") closeLightbox();
        });
    }

    /* ══════════════════════════════════════════════════════════════════════
       ② ADMIN PANEL — EVENTS CRUD
    ══════════════════════════════════════════════════════════════════════ */

    let _adminEvents = [];
    let _editingEventId = null;
    let _pendingPhotos = [];    // [{file, dataUrl}]
    let _pmEventId = null;
    let _pmPending = [];    // [{file, dataUrl}] for photo manager

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const MAX_SIZE = 5 * 1024 * 1024;
    const MAX_BATCH = 10;

    /* ── Auth header ─────────────────────────────────────────────────────── */
    function _ah() {
        return {
            "Content-Type": "application/json",
            "X-Admin-Token": (typeof adminToken !== "undefined" ? adminToken : "") || "",
        };
    }

    /* ── Fetch admin events & render list ───────────────────────────────── */
    async function fetchAdminEvents() {
        try {
            const res = await fetch(`${API}/admin/events`, { headers: _ah() });
            _adminEvents = await res.json();
        } catch {
            _adminEvents = [];
        }
        renderAdminList();
        // Also refresh the public gallery if visible
        _allEvents = [..._adminEvents];
        renderSlideshow(_allEvents);
        renderGallery();
    }

    function renderAdminList() {
        const el = document.getElementById("evAdminList");
        if (!el) return;

        if (!_adminEvents.length) {
            el.innerHTML = `<p style="color:#888;font-size:13px">No events yet. Add one above!</p>`;
            return;
        }

        el.innerHTML = `<p style="font-size:13px;font-weight:700;color:#334;margin:0 0 8px">
            Existing Events (${_adminEvents.length})
        </p>` + _adminEvents.map(ev => {
            const cover = ev.photos && ev.photos.length ? ev.photos[0].url : null;
            const thumb = cover
                ? `<img class="ev-admin-cover" src="${_esc(cover)}" alt="cover">`
                : `<div class="ev-admin-cover-ph">📸</div>`;
            return `<div class="ev-admin-row" data-id="${_esc(ev.id)}">
                ${thumb}
                <div class="ev-admin-info">
                    <h4>${_esc(ev.title)}</h4>
                    <div class="ev-admin-meta">
                        📂 ${_esc(ev.category || "General")} &nbsp;·&nbsp;
                        📅 ${_esc(ev.event_date || "—")} &nbsp;·&nbsp;
                        🖼 ${(ev.photos || []).length} photo(s)
                    </div>
                    <div class="ev-admin-actions">
                        <button class="ev-btn-sm ev-edit-btn"   data-id="${_esc(ev.id)}">✏️ Edit</button>
                        <button class="ev-btn-sm ev-photos-btn" data-id="${_esc(ev.id)}">🖼 Photos</button>
                        <button class="ev-btn-sm ev-del-btn"    data-id="${_esc(ev.id)}">🗑 Delete</button>
                    </div>
                </div>
            </div>`;
        }).join("");

        el.querySelectorAll(".ev-edit-btn").forEach(b =>
            b.addEventListener("click", () => loadEditForm(b.dataset.id)));
        el.querySelectorAll(".ev-photos-btn").forEach(b =>
            b.addEventListener("click", () => openPhotoManager(b.dataset.id)));
        el.querySelectorAll(".ev-del-btn").forEach(b =>
            b.addEventListener("click", () => deleteEvent(b.dataset.id)));
    }

    /* ── File handling ──────────────────────────────────────────────────── */
    function handleFiles(files, pendingArr, previewElId) {
        for (const file of Array.from(files)) {
            if (!ALLOWED_TYPES.includes(file.type)) {
                _toast("Only JPG/PNG/GIF/WEBP allowed", "error"); continue;
            }
            if (file.size > MAX_SIZE) {
                _toast(`${file.name} exceeds 5 MB`, "error"); continue;
            }
            if (pendingArr === _pendingPhotos && _pendingPhotos.length >= MAX_BATCH) {
                _toast("Max 10 photos per batch", "error"); break;
            }
            const reader = new FileReader();
            reader.onload = e => {
                pendingArr.push({ file, dataUrl: e.target.result });
                renderPreview(pendingArr, previewElId);
            };
            reader.readAsDataURL(file);
        }
    }

    function renderPreview(pendingArr, elId) {
        const wrap = document.getElementById(elId);
        if (!wrap) return;
        wrap.innerHTML = pendingArr.map((p, i) => `
            <div class="ev-thumb-wrap">
                <img src="${p.dataUrl}" alt="preview">
                <button class="ev-thumb-rm" data-i="${i}">✕</button>
            </div>`).join("");
        wrap.querySelectorAll(".ev-thumb-rm").forEach(btn =>
            btn.addEventListener("click", () => {
                pendingArr.splice(parseInt(btn.dataset.i), 1);
                renderPreview(pendingArr, elId);
            })
        );
    }

    async function buildPayloads(pendingArr) {
        const out = [];
        for (const p of pendingArr) {
            const b64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result.split(",")[1]);
                r.onerror = rej;
                r.readAsDataURL(p.file);
            });
            out.push({ filename: p.file.name, data: b64, mime: p.file.type });
        }
        return out;
    }

    /* ── Dropzone binding helper ─────────────────────────────────────────── */
    function bindDropzone(dzId, fiId, pendingArr, previewElId) {
        const dz = document.getElementById(dzId);
        const fi = document.getElementById(fiId);
        if (!dz || !fi) return;
        dz.addEventListener("click", () => fi.click());
        dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("drag-over"); });
        dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
        dz.addEventListener("drop", e => {
            e.preventDefault();
            dz.classList.remove("drag-over");
            handleFiles(e.dataTransfer.files, pendingArr, previewElId);
        });
        fi.addEventListener("change", e => {
            handleFiles(e.target.files, pendingArr, previewElId);
            fi.value = "";   // allow re-selecting same file
        });
    }

    /* ── Submit (create or edit) ─────────────────────────────────────────── */
    async function submitForm() {
        const title = (document.getElementById("evTitle")?.value || "").trim();
        if (!title) { _toast("Title is required", "error"); return; }

        const btn = document.getElementById("evSubmitBtn");
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${_editingEventId ? "Saving…" : "Adding…"}`;

        try {
            const photos = await buildPayloads(_pendingPhotos);
            const body = {
                title,
                category: document.getElementById("evCategory")?.value || "General",
                event_date: document.getElementById("evDate")?.value || "",
                description: (document.getElementById("evDescription")?.value || "").trim(),
                photos,
            };

            let res;
            if (_editingEventId) {
                res = await fetch(`${API}/admin/events/${_editingEventId}`, {
                    method: "PUT", headers: _ah(), body: JSON.stringify(body),
                });
                // If there are new photos, upload them separately
                if (photos.length) {
                    await fetch(`${API}/admin/events/${_editingEventId}/photos`, {
                        method: "POST", headers: _ah(),
                        body: JSON.stringify({ photos }),
                    });
                }
            } else {
                res = await fetch(`${API}/admin/events`, {
                    method: "POST", headers: _ah(), body: JSON.stringify(body),
                });
            }

            if (!res.ok) throw new Error(await res.text());
            _toast(_editingEventId ? "✅ Event updated!" : "✅ Event added!", "success");
            resetForm();
            await fetchAdminEvents();
        } catch (e) {
            _toast("❌ " + (e.message || "Error saving event"), "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-${_editingEventId ? "save" : "plus"}"></i> ${_editingEventId ? "Save Changes" : "Add Event"}`;
        }
    }

    function loadEditForm(eventId) {
        const ev = _adminEvents.find(e => e.id === eventId);
        if (!ev) return;

        _editingEventId = eventId;
        _pendingPhotos = [];

        const fh = document.getElementById("eventsFormHeading");
        if (fh) fh.innerHTML = `<i class="fas fa-edit"></i> Editing: ${_esc(ev.title)}`;

        _setVal("evTitle", ev.title);
        _setVal("evCategory", ev.category || "General");
        _setVal("evDate", ev.event_date || "");
        _setVal("evDescription", ev.description || "");

        const prev = document.getElementById("evPreview");
        if (prev) prev.innerHTML = "";

        const sb = document.getElementById("evSubmitBtn");
        if (sb) { sb.innerHTML = `<i class="fas fa-save"></i> Save Changes`; }

        const cb = document.getElementById("evCancelBtn");
        if (cb) cb.style.display = "inline-flex";

        document.getElementById("eventsAdminForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function resetForm() {
        _editingEventId = null;
        _pendingPhotos = [];

        const fh = document.getElementById("eventsFormHeading");
        if (fh) fh.innerHTML = `<i class="fas fa-plus-circle"></i> Add New Event`;

        ["evTitle", "evDate", "evDescription"].forEach(id => _setVal(id, ""));
        _setVal("evCategory", "General");

        const prev = document.getElementById("evPreview");
        if (prev) prev.innerHTML = "";
        const fi = document.getElementById("evFileInput");
        if (fi) fi.value = "";

        const sb = document.getElementById("evSubmitBtn");
        if (sb) sb.innerHTML = `<i class="fas fa-plus"></i> Add Event`;

        const cb = document.getElementById("evCancelBtn");
        if (cb) cb.style.display = "none";
    }

    /* ── Photo manager ─────────────────────────────────────────────────── */
    function openPhotoManager(eventId) {
        _pmEventId = eventId;
        _pmPending.length = 0;

        const ev = _adminEvents.find(e => e.id === eventId);
        if (!ev) return;

        const pmTitle = document.getElementById("evPmTitle");
        if (pmTitle) pmTitle.textContent = `Manage Photos — ${ev.title}`;

        // Render existing
        const existing = document.getElementById("evPmExisting");
        if (existing) {
            existing.innerHTML = (ev.photos || []).length
                ? (ev.photos).map(p => `
                    <div class="ev-thumb-wrap">
                        <img src="${_esc(p.url)}" alt="photo" style="width:72px;height:58px;object-fit:cover;border-radius:6px;border:1.5px solid #d0d8ea;">
                        <button class="ev-thumb-rm" data-fname="${_esc(p.filename)}">✕</button>
                    </div>`).join("")
                : `<p style="font-size:12px;color:#888">No photos yet.</p>`;

            existing.querySelectorAll(".ev-thumb-rm").forEach(btn =>
                btn.addEventListener("click", () => deletePhoto(_pmEventId, btn.dataset.fname))
            );
        }

        const prev = document.getElementById("evPmPreview");
        if (prev) prev.innerHTML = "";
        const fi = document.getElementById("evFileInputPm");
        if (fi) fi.value = "";

        const pm = document.getElementById("evPhotoManager");
        if (pm) { pm.style.display = "block"; pm.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }

    async function pmUpload() {
        if (!_pmPending.length) { _toast("No photos selected", "error"); return; }
        const btn = document.getElementById("evPmUploadBtn");
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading…`;

        try {
            const photos = await buildPayloads(_pmPending);
            const res = await fetch(`${API}/admin/events/${_pmEventId}/photos`, {
                method: "POST", headers: _ah(), body: JSON.stringify({ photos }),
            });
            if (!res.ok) throw new Error(await res.text());
            _toast("✅ Photos uploaded!", "success");
            _pmPending.length = 0;
            const prev = document.getElementById("evPmPreview");
            if (prev) prev.innerHTML = "";
            await fetchAdminEvents();
            openPhotoManager(_pmEventId);
        } catch (e) {
            _toast("❌ Upload failed: " + (e.message || ""), "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-upload"></i> Upload Selected`;
        }
    }

    async function deletePhoto(eventId, filename) {
        if (!confirm("Remove this photo?")) return;
        try {
            const res = await fetch(
                `${API}/admin/events/${eventId}/photos/${filename}`,
                { method: "DELETE", headers: _ah() }
            );
            if (!res.ok) throw new Error();
            _toast("Photo removed", "success");
            await fetchAdminEvents();
            openPhotoManager(eventId);
        } catch {
            _toast("Failed to remove photo", "error");
        }
    }

    function closePhotoManager() {
        const pm = document.getElementById("evPhotoManager");
        if (pm) pm.style.display = "none";
        _pmEventId = null;
        _pmPending.length = 0;
    }

    /* ── Delete event ────────────────────────────────────────────────────── */
    async function deleteEvent(eventId) {
        const ev = _adminEvents.find(e => e.id === eventId);
        if (!confirm(`Delete "${ev?.title}"? All photos will also be removed.`)) return;
        try {
            const res = await fetch(`${API}/admin/events/${eventId}`, {
                method: "DELETE", headers: _ah(),
            });
            if (!res.ok) throw new Error();
            _toast("🗑 Event deleted", "success");
            await fetchAdminEvents();
        } catch {
            _toast("Failed to delete event", "error");
        }
    }

    /* ══════════════════════════════════════════════════════════════════════
       ③ ADMIN PANEL OPEN HOOK
       We watch for when the admin panel becomes active so we can auto-load events.
    ══════════════════════════════════════════════════════════════════════ */
    function watchAdminPanel() {
        const panel = document.getElementById("adminPanel");
        if (!panel) return;

        // MutationObserver to detect when admin panel opens (active class added)
        const obs = new MutationObserver(() => {
            if (panel.classList.contains("active")) {
                fetchAdminEvents();
            }
        });
        obs.observe(panel, { attributes: true, attributeFilter: ["class"] });

        // If already open on page load (token was cached)
        if (panel.classList.contains("active")) {
            fetchAdminEvents();
        }
    }

    /* ══════════════════════════════════════════════════════════════════════
       ④ TOAST
    ══════════════════════════════════════════════════════════════════════ */
    let _toastTimer;
    function _toast(msg, type) {
        const t = document.getElementById("evToast");
        if (!t) return;
        t.textContent = msg;
        t.className = "show " + (type || "");
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => { t.className = ""; }, 3400);
    }

    /* ══════════════════════════════════════════════════════════════════════
       ⑤ UTILITY
    ══════════════════════════════════════════════════════════════════════ */
    function _esc(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function _setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    /* ══════════════════════════════════════════════════════════════════════
       ⑥ INIT
    ══════════════════════════════════════════════════════════════════════ */
    document.addEventListener("DOMContentLoaded", () => {
        /* Public gallery */
        bindGalleryFilters();
        bindLightbox();
        fetchPublicEvents();

        /* Admin — dropzones */
        bindDropzone("evDropzone", "evFileInput", _pendingPhotos, "evPreview");
        bindDropzone("evDropzonePm", "evFileInputPm", _pmPending, "evPmPreview");

        /* Admin — form buttons */
        const submitBtn = document.getElementById("evSubmitBtn");
        const cancelBtn = document.getElementById("evCancelBtn");
        const pmUploadB = document.getElementById("evPmUploadBtn");
        const pmCloseB = document.getElementById("evPmCloseBtn");

        if (submitBtn) submitBtn.addEventListener("click", submitForm);
        if (cancelBtn) cancelBtn.addEventListener("click", resetForm);
        if (pmUploadB) pmUploadB.addEventListener("click", pmUpload);
        if (pmCloseB) pmCloseB.addEventListener("click", closePhotoManager);

        /* Watch admin panel open */
        watchAdminPanel();
    });

})();