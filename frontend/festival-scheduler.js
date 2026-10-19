/**
 * FestivalScheduler v7 — PVPIT
 * ✅ NEVER changes original PVPIT hero/background
 * ✅ Only adds banner + canvas overlay
 * ✅ Creative per-festival particle systems
 * ✅ Covers ALL Calendarific Indian holidays
 * ✅ Fixes: Ramzan Id, Eid ul-Fitr, all Eid variants
 */

(function () {
  'use strict';

  var CANVAS_ID = 'festival-fx-canvas';
  var BANNER_ID = 'festival-banner-el';
  var STYLE_ID = 'festival-scheduler-styles';
  var API_KEY = "PClxT25UEwjuEdOBf8CfXSj9aJqTPMdQ";

  /* ══════════════════════════════════════════════════════════
     THEME MAP — banner colors only, hero is NEVER touched
  ══════════════════════════════════════════════════════════ */
  var THEMES = {
    diwali: {
      emoji: "🪔", emoji2: "✨",
      bg: "linear-gradient(135deg, rgba(255,107,0,0.55) 0%, rgba(255,140,0,0.5) 40%, rgba(255,165,0,0.45) 70%, rgba(255,215,0,0.4) 100%)",
      glow: "rgba(251,146,60,0.7)",
      titleColor: "#fde68a",
      subColor: "rgba(120,53,15,0.95)",
      particles: "diyas",
      msg: "Wishing you light, love & prosperity! 🪔"
    },
    christmas: {
      emoji: "🎄", emoji2: "⛄",
      bg: "linear-gradient(135deg,#052e16 0%,#166534 40%,#15803d 65%,#991b1b 100%)",
      glow: "rgba(34,197,94,0.6)", titleColor: "#bbf7d0", subColor: "rgba(187,247,208,0.85)",
      particles: "snow", msg: "Merry Christmas & a Happy New Year! 🎁"
    },
    holi: {
      emoji: "🎨", emoji2: "🌈",
      bg: "linear-gradient(90deg,#7e22ce 0%,#db2777 20%,#dc2626 37%,#ea580c 54%,#16a34a 72%,#0284c7 88%,#7c3aed 100%)",
      glow: "rgba(219,39,119,0.6)", titleColor: "#fff", subColor: "rgba(255,255,255,0.9)",
      particles: "colorBurst", msg: "Wishing you a colourful & joyful Holi! 🌈"
    },
    eid: {
      emoji: "🌙", emoji2: "⭐",
      bg: "linear-gradient(135deg,#020617 0%,#0f172a 35%,#1e3a8a 65%,#92400e 100%)",
      glow: "rgba(200,168,75,0.65)", titleColor: "#fde68a", subColor: "rgba(253,230,138,0.85)",
      particles: "crescentStars", msg: "Eid Mubarak! Peace, blessings & joy to all! ☪️"
    },
    republic: {
      emoji: "🇮🇳", emoji2: "🎉",
      bg: "linear-gradient(90deg,#ff9933 0%,#ff9933 33%,#fff 33%,#fff 66%,#138808 66%,#138808 100%)",
      glow: "rgba(255,153,51,0.55)", titleColor: "#000080", subColor: "rgba(0,0,128,0.85)",
      particles: "tricolor", msg: "Jai Hind! 🇮🇳 Proud to be Indian!"
    },
    independence: {
      emoji: "🇮🇳", emoji2: "🕊️",
      bg: "linear-gradient(90deg,#ff9933 0%,#ff9933 33%,#fff 33%,#fff 66%,#138808 66%,#138808 100%)",
      glow: "rgba(19,136,8,0.55)", titleColor: "#000080", subColor: "rgba(0,0,128,0.85)",
      particles: "tricolor", msg: "Jai Hind! Celebrating freedom & unity! 🕊️"
    },
    ganesh: {
      emoji: "🐘", emoji2: "🙏",
      bg: "linear-gradient(135deg,#451a03 0%,#92400e 28%,#d97706 55%,#7c3aed 85%,#4c1d95 100%)",
      glow: "rgba(217,119,6,0.65)", titleColor: "#fef3c7", subColor: "rgba(254,243,199,0.88)",
      particles: "marigolds", msg: "Ganpati Bappa Morya! May Bappa bless you! 🙏"
    },
    gudipadwa: {
      emoji: "🪅", emoji2: "🌺",
      bg: "linear-gradient(135deg,#431407 0%,#c2410c 30%,#fb923c 58%,#fbbf24 80%,#84cc16 100%)",
      glow: "rgba(251,146,60,0.6)", titleColor: "#fff7ed", subColor: "rgba(255,247,237,0.88)",
      particles: "flowers", msg: "Marathi Nava Varsha Chya Shubhechha! 🌺"
    },
    navratri: {
      emoji: "🪷", emoji2: "💃",
      bg: "linear-gradient(135deg,#4a044e 0%,#86198f 25%,#db2777 50%,#f59e0b 75%,#dc2626 100%)",
      glow: "rgba(134,25,143,0.65)", titleColor: "#fdf4ff", subColor: "rgba(253,244,255,0.88)",
      particles: "dandiya", msg: "Navratri Celebrations! Garba & Dandiya time! 💃"
    },
    dussehra: {
      emoji: "🏹", emoji2: "🔱",
      bg: "linear-gradient(135deg,#7c2d12 0%,#c2410c 30%,#f97316 58%,#fbbf24 80%,#ca8a04 100%)",
      glow: "rgba(249,115,22,0.65)", titleColor: "#fff7ed", subColor: "rgba(255,247,237,0.88)",
      particles: "arrowFireworks", msg: "Victory of good over evil! Happy Dussehra! 🏹"
    },
    onam: {
      emoji: "🌸", emoji2: "🌊",
      bg: "linear-gradient(135deg,#14532d 0%,#16a34a 35%,#4ade80 58%,#f59e0b 80%,#ca8a04 100%)",
      glow: "rgba(74,222,128,0.6)", titleColor: "#f0fdf4", subColor: "rgba(240,253,244,0.88)",
      particles: "flowers", msg: "Happy Onam! May King Mahabali bless your home! 🌸"
    },
    pongal: {
      emoji: "🍚", emoji2: "☀️",
      bg: "linear-gradient(135deg,#78350f 0%,#b45309 30%,#d97706 55%,#fbbf24 75%,#84cc16 100%)",
      glow: "rgba(217,119,6,0.6)", titleColor: "#fffbeb", subColor: "rgba(255,251,235,0.88)",
      particles: "sunRays", msg: "Pongal O Pongal! Happy Harvest Festival! ☀️"
    },
    makar: {
      emoji: "🪁", emoji2: "☀️",
      bg: "linear-gradient(135deg,#1d4ed8 0%,#7c3aed 35%,#c026d3 58%,#f59e0b 80%,#fbbf24 100%)",
      glow: "rgba(245,158,11,0.6)", titleColor: "#fef3c7", subColor: "rgba(254,243,199,0.88)",
      particles: "kites", msg: "Til Gul Ghya, God God Bola! Happy Sankranti! 🪁"
    },
    lohri: {
      emoji: "🔥", emoji2: "🌾",
      bg: "linear-gradient(135deg,#450a0a 0%,#991b1b 28%,#dc2626 50%,#f97316 72%,#fbbf24 100%)",
      glow: "rgba(220,38,38,0.7)", titleColor: "#fef2f2", subColor: "rgba(254,242,242,0.88)",
      particles: "bonfire", msg: "Happy Lohri! Dance around the bonfire! 🔥🌾"
    },
    baisakhi: {
      emoji: "🌾", emoji2: "💛",
      bg: "linear-gradient(135deg,#854d0e 0%,#ca8a04 30%,#fbbf24 55%,#16a34a 80%,#14532d 100%)",
      glow: "rgba(202,138,4,0.6)", titleColor: "#fefce8", subColor: "rgba(254,252,232,0.88)",
      particles: "wheat", msg: "Happy Baisakhi! Celebrate the harvest! 🌾"
    },
    raksha: {
      emoji: "🪢", emoji2: "💕",
      bg: "linear-gradient(135deg,#831843 0%,#be185d 30%,#f43f5e 55%,#fb923c 78%,#fbbf24 100%)",
      glow: "rgba(244,63,94,0.65)", titleColor: "#fff1f2", subColor: "rgba(255,241,242,0.88)",
      particles: "flowers", msg: "Happy Raksha Bandhan! The bond of love! 🪢💕"
    },
    janmashtami: {
      emoji: "🦚", emoji2: "🎶",
      bg: "linear-gradient(135deg,#0c1445 0%,#1e3a8a 30%,#3730a3 55%,#7c3aed 78%,#fbbf24 100%)",
      glow: "rgba(124,58,237,0.65)", titleColor: "#fef3c7", subColor: "rgba(254,243,199,0.88)",
      particles: "crescentStars", msg: "Jai Shri Krishna! Happy Janmashtami! 🦚"
    },
    buddha: {
      emoji: "☸️", emoji2: "🌸",
      bg: "linear-gradient(135deg,#3b0764 0%,#6d28d9 35%,#a855f7 60%,#f59e0b 82%,#fbbf24 100%)",
      glow: "rgba(168,85,247,0.6)", titleColor: "#fef3c7", subColor: "rgba(254,243,199,0.88)",
      particles: "flowers", msg: "Buddha Purnima! Spread peace & compassion! ☮️"
    },
    mahavir: {
      emoji: "🕊️", emoji2: "☮️",
      bg: "linear-gradient(135deg,#14532d 0%,#15803d 35%,#22c55e 60%,#fbbf24 82%,#ca8a04 100%)",
      glow: "rgba(34,197,94,0.6)", titleColor: "#f0fdf4", subColor: "rgba(240,253,244,0.88)",
      particles: "flowers", msg: "Ahimsa Parmo Dharma! Happy Mahavir Jayanti! 🕊️"
    },
    newyear: {
      emoji: "🎆", emoji2: "🥂",
      bg: "linear-gradient(135deg,#020617 0%,#1e3a8a 30%,#4f46e5 55%,#7c3aed 75%,#fbbf24 100%)",
      glow: "rgba(79,70,229,0.7)", titleColor: "#fde68a", subColor: "rgba(253,230,138,0.88)",
      particles: "fireworks", msg: "Happy New Year! May this year be amazing! 🎆"
    },
    easter: {
      emoji: "🐣", emoji2: "🌷",
      bg: "linear-gradient(135deg,#4c1d95 0%,#db2777 28%,#f43f5e 50%,#f59e0b 72%,#84cc16 100%)",
      glow: "rgba(219,39,119,0.55)", titleColor: "#fff", subColor: "rgba(255,255,255,0.9)",
      particles: "flowers", msg: "Happy Easter! Joy & new beginnings! 🐣🌷"
    }
  };

  /* ── Detect theme from holiday name ── */
  function detectTheme(name) {
    var n = name.toLowerCase().trim();
    if (n.includes("eid") || n.includes("ramzan") || n.includes("ramadan") ||
      n.includes("bakr") || n.includes("ul-adha") || n.includes("ul-fitr") ||
      n.includes("milad") || n.includes("mawlid")) return THEMES.eid;
    if (n.includes("diwali") || n.includes("deepavali") ||
      n.includes("deepawali")) return THEMES.diwali;
    if (n.includes("christmas")) return THEMES.christmas;
    if (n.includes("holi") || n.includes("dhuleti") ||
      n.includes("dhulandi")) return THEMES.holi;
    if (n.includes("republic")) return THEMES.republic;
    if (n.includes("independence")) return THEMES.independence;
    if (n.includes("ganesh") || n.includes("ganpati") ||
      n.includes("vinayaka")) return THEMES.ganesh;
    if (n.includes("gudi") || n.includes("ugadi") ||
      n.includes("vishu") || n.includes("bihu") ||
      n.includes("chaitra")) return THEMES.gudipadwa;
    if (n.includes("navratri") || n.includes("navaratri") ||
      n.includes("durga")) return THEMES.navratri;
    if (n.includes("dussehra") || n.includes("dasara") ||
      n.includes("vijayadashami")) return THEMES.dussehra;
    if (n.includes("onam")) return THEMES.onam;
    if (n.includes("pongal")) return THEMES.pongal;
    if (n.includes("makar") || n.includes("sankranti") ||
      n.includes("uttarayan") || n.includes("lohri")) return n.includes("lohri") ? THEMES.lohri : THEMES.makar;
    if (n.includes("baisakhi") || n.includes("vaisakhi")) return THEMES.baisakhi;
    if (n.includes("raksha") || n.includes("rakhi")) return THEMES.raksha;
    if (n.includes("janmashtami") || n.includes("krishna") ||
      n.includes("gokulashtami")) return THEMES.janmashtami;
    if (n.includes("buddha") || n.includes("vesak") ||
      n.includes("buddh")) return THEMES.buddha;
    if (n.includes("mahavir")) return THEMES.mahavir;
    if (n.includes("easter")) return THEMES.easter;
    if (n.includes("new year")) return THEMES.newyear;
    return null;
  }

  /* ── Auto color for unknown holidays ── */
  function autoColors(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    var h = Math.abs(hash % 360);
    return {
      emoji: "🎉", emoji2: "🌟",
      bg: "linear-gradient(135deg,hsl(" + h + ",85%,20%) 0%,hsl(" + h + ",80%,35%) 40%,hsl(" + ((h + 60) % 360) + ",75%,45%) 75%,hsl(" + ((h + 110) % 360) + ",70%,50%) 100%)",
      glow: "hsla(" + h + ",80%,50%,0.6)",
      titleColor: "#fff", subColor: "rgba(255,255,255,0.88)",
      particles: "stars",
      msg: "Warm wishes from PVPIT on this auspicious occasion! 🙏"
    };
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  function init() {
    // var today = todayStr(); // ← To test manually: change to e.g. "2026-10-02"
    var today = "2026-09-14";
    var year = today.slice(0, 4);
    
    fetch("https://calendarific.com/api/v2/holidays?api_key=" + API_KEY +
      "&country=IN&year=" + year + "&type=national,religious,observance")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var holidays = (data.response && data.response.holidays) || [];
        var todayList = holidays.filter(function (h) {
          return h.date && h.date.iso && h.date.iso.startsWith(today);
        });
        if (!todayList.length) return;
        var best = todayList.find(function (h) {
          return h.type && h.type.some(function (t) {
            return t === "National holiday" || t === "Religious Holiday";
          });
        }) || todayList[0];
        apply({ name: best.name, description: best.description || "" });
      })
      .catch(function (e) { console.warn("FestivalScheduler:", e); });
  }

  /* ══════════════════════════════════════════════════════════
     APPLY — banner + canvas ONLY, hero UNTOUCHED
  ══════════════════════════════════════════════════════════ */
  function apply(f) {
    clearPrev();
    var theme = detectTheme(f.name) || autoColors(f.name);
    injectStyles(theme);
    injectBanner(f, theme);
    injectCanvas(theme);
    midnight();
  }

  function clearPrev() {
    ["#" + CANVAS_ID, "#" + BANNER_ID, "#" + STYLE_ID].forEach(function (s) {
      var el = document.querySelector(s); if (el) el.remove();
    });
    // ⚠️ Hero styles are NEVER touched — original PVPIT design preserved
  }

  /* ══════════════════════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════════════════════ */
  function injectStyles(t) {
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');

      #festival-banner-el {
        position: sticky;
        top: 72px; left: 0; right: 0;
        z-index: 997; width: 100%; box-sizing: border-box;
        font-family: 'Nunito', sans-serif;
        overflow: hidden;
        animation: fbIn 0.65s cubic-bezier(0.34,1.56,0.64,1) both;
        box-shadow: 0 6px 32px ${t.glow};
      }
      @keyframes fbIn {
        from { transform: translateY(-110%); opacity: 0; }
        to   { transform: translateY(0);     opacity: 1; }
      }
      #festival-banner-el::before {
        content:''; position:absolute; inset:0;
        background: linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.22) 50%, transparent 75%);
        background-size: 250% 100%;
        animation: fbShimmer 3s ease-in-out infinite;
        pointer-events:none; z-index:2;
      }
      @keyframes fbShimmer {
        0%   { background-position: 250% 0; }
        100% { background-position: -250% 0; }
      }
      .fb-wrap {
        position:relative; z-index:3;
        display:flex; align-items:center; justify-content:center;
        gap:16px; padding:10px 56px 10px 20px; min-height:58px;
      }
      .fb-pulse {
        position:relative; display:flex;
        align-items:center; justify-content:center;
        flex-shrink:0; width:44px; height:44px;
      }
      .fb-pulse::before, .fb-pulse::after {
        content:''; position:absolute; border-radius:50%;
        background:rgba(255,255,255,0.2);
        animation:fbRing 2.2s ease-out infinite;
      }
      .fb-pulse::after { animation-delay:1.1s; }
      @keyframes fbRing {
        0%   { width:32px; height:32px; opacity:0.8; }
        100% { width:66px; height:66px; opacity:0; }
      }
      .fb-emoji {
        font-size:26px;
        animation:fbWiggle 2s ease-in-out infinite;
        filter:drop-shadow(0 2px 8px rgba(0,0,0,0.45));
        position:relative; z-index:1;
      }
      @keyframes fbWiggle {
        0%,100% { transform:rotate(-8deg) scale(1); }
        25%     { transform:rotate(8deg)  scale(1.12); }
        50%     { transform:rotate(-5deg) scale(1.06); }
        75%     { transform:rotate(5deg)  scale(1.10); }
      }
      .fb-sep { width:1px; height:36px; background:rgba(255,255,255,0.28); flex-shrink:0; }
      .fb-text { display:flex; flex-direction:column; gap:2px; }
      .fb-title {
        font-size:17px; font-weight:800;
        letter-spacing:0.02em; line-height:1.2;
        text-shadow:0 1px 8px rgba(0,0,0,0.5);
        color:${t.titleColor};
      }
      .fb-sub {
        font-size:11.5px; font-weight:500;
        letter-spacing:0.04em; line-height:1.3;
        color:${t.subColor};
        max-width:500px; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis;
      }
      .fb-badge {
        display:flex; align-items:center; gap:5px;
        background:rgba(255,255,255,0.16);
        border:1px solid rgba(255,255,255,0.38);
        border-radius:999px; padding:4px 13px; flex-shrink:0;
        font-size:10px; font-weight:700;
        letter-spacing:0.1em; color:#fff; text-transform:uppercase;
        backdrop-filter:blur(4px);
      }
      .fb-dot {
        width:7px; height:7px; border-radius:50%; background:#fff;
        animation:fbDotPulse 1.4s ease-in-out infinite;
      }
      @keyframes fbDotPulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%     { opacity:0.35; transform:scale(0.55); }
      }
      .fb-emoji2 {
        font-size:22px; flex-shrink:0;
        animation:fbWiggle 2s ease-in-out infinite 0.5s; opacity:0.88;
      }
      .fb-close {
        position:absolute; right:14px; top:50%;
        transform:translateY(-50%);
        background:rgba(0,0,0,0.25);
        border:1px solid rgba(255,255,255,0.35);
        border-radius:50%; width:28px; height:28px;
        color:#fff; font-size:13px; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:background 0.2s,transform 0.2s; z-index:4;
      }
      .fb-close:hover {
        background:rgba(0,0,0,0.52);
        transform:translateY(-50%) scale(1.18) rotate(90deg);
      }
      #festival-fx-canvas {
        position:fixed; top:0; left:0;
        width:100%; height:100%;
        pointer-events:none; z-index:10; opacity:0.82;
      }
      @media(max-width:768px){
        #festival-banner-el{top:62px;}
        .fb-emoji{font-size:21px;} .fb-title{font-size:15px;}
        .fb-sub,.fb-badge{display:none;}
      }
      @media(max-width:480px){
        #festival-banner-el{top:56px;}
        .fb-emoji2{display:none;} .fb-wrap{padding-right:44px;gap:10px;}
        .fb-title{font-size:14px;}
      }
      @media(prefers-reduced-motion:reduce){
        #festival-banner-el,.fb-emoji{animation:none!important;}
        #festival-fx-canvas{display:none!important;}
      }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════
     BANNER
  ══════════════════════════════════════════════════════════ */
  function injectBanner(f, t) {
    var b = document.createElement("div");
    b.id = BANNER_ID; b.style.background = t.bg;
    b.innerHTML =
      '<div class="fb-wrap">' +
      '<div class="fb-pulse"><span class="fb-emoji">' + t.emoji + '</span></div>' +
      '<div class="fb-sep"></div>' +
      '<div class="fb-text">' +
      '<span class="fb-title">Happy ' + esc(f.name) + '!</span>' +
      '<span class="fb-sub">' + esc(t.msg) + '</span>' +
      '</div>' +
      '<div class="fb-badge"><span class="fb-dot"></span>Today</div>' +
      '<span class="fb-emoji2">' + t.emoji2 + '</span>' +
      '<button class="fb-close" onclick="(function(){var b=document.getElementById(\'' + BANNER_ID + '\');if(b)b.remove();var c=document.getElementById(\'' + CANVAS_ID + '\');if(c)c.remove();})()" aria-label="Close">✕</button>' +
      '</div>';
    var header = document.querySelector("header,.header,nav");
    if (header && header.parentNode) header.parentNode.insertBefore(b, header.nextSibling);
    else document.body.prepend(b);
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ══════════════════════════════════════════════════════════
     CANVAS ROUTER
  ══════════════════════════════════════════════════════════ */
  function injectCanvas(theme) {
    var cv = document.createElement("canvas");
    cv.id = CANVAS_ID; document.body.appendChild(cv);
    var W = cv.width = window.innerWidth, H = cv.height = window.innerHeight;
    var ctx = cv.getContext("2d"), raf;
    window.addEventListener("resize", function () { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; });
    var type = theme.particles;
    cancelAnimationFrame(raf);
    var cb = function (r) { raf = r; };
    if (type === "fireworks") pFireworks(ctx, W, H, cb);
    else if (type === "diyas") pDiyas(ctx, W, H, cb);
    else if (type === "arrowFireworks") pArrowFireworks(ctx, W, H, cb);
    else if (type === "snow") pSnow(ctx, W, H, cb);
    else if (type === "colorBurst") pColorBurst(ctx, W, H, cb);
    else if (type === "tricolor") pTricolor(ctx, W, H, cb);
    else if (type === "marigolds") pMarigolds(ctx, W, H, cb);
    else if (type === "flowers") pFlowers(ctx, W, H, cb);
    else if (type === "dandiya") pDandiya(ctx, W, H, cb);
    else if (type === "crescentStars") pCrescentStars(ctx, W, H, cb);
    else if (type === "sunRays") pSunRays(ctx, W, H, cb);
    else if (type === "kites") pKites(ctx, W, H, cb);
    else if (type === "wheat") pWheat(ctx, W, H, cb);
    else if (type === "bonfire") pBonfire(ctx, W, H, cb);
    else pStars(ctx, W, H, cb);
  }

  /* ══════════════════════════════════════════════════════════
     PARTICLE SYSTEMS
  ══════════════════════════════════════════════════════════ */

  /* 🎆 Fireworks */
  function pFireworks(ctx, W, H, cb) {
    var sparks = [], frame = 0;
    function burst(x, y) {
      var hue = Math.random() * 360;
      for (var i = 0; i < 60; i++) {
        var a = (Math.PI * 2 / 60) * i, sp = 2 + Math.random() * 4;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue, r: 2 + Math.random() * 3, tail: [] });
      }
    }
    function loop() {
      frame++;
      ctx.clearRect(0, 0, W, H);
      if (frame % 55 === 0) burst(W * (0.2 + Math.random() * 0.6), H * (0.1 + Math.random() * 0.55));
      sparks = sparks.filter(function (s) { return s.life > 0.01; });
      sparks.forEach(function (s) {
        s.tail.push({ x: s.x, y: s.y }); if (s.tail.length > 6) s.tail.shift();
        s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.vx *= 0.98; s.life -= 0.016;
        for (var i = 0; i < s.tail.length; i++) {
          ctx.beginPath(); ctx.arc(s.tail[i].x, s.tail[i].y, s.r * (i / s.tail.length) * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = "hsla(" + s.hue + ",90%,65%," + ((i / s.tail.length) * s.life * 0.6) + ")"; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + s.hue + ",90%,70%," + s.life + ")"; ctx.fill();
      });
      cb(requestAnimationFrame(loop));
    }
    burst(W * 0.3, H * 0.28); burst(W * 0.7, H * 0.22); burst(W * 0.5, H * 0.35);
    cb(requestAnimationFrame(loop));
  }

  /* 🪔 Diyas — Diwali (glowing floating lamps + gentle sparkle bursts) */
  function pDiyas(ctx, W, H, cb) {
    var diyas = [], sparkles = [], frame = 0;
    for (var i = 0; i < 26; i++) {
      diyas.push({
        x: Math.random() * W, y: H + Math.random() * 200,
        vy: -(0.25 + Math.random() * 0.45), vx: (Math.random() - 0.5) * 0.25,
        r: 9 + Math.random() * 7, t: Math.random() * Math.PI * 2,
        flicker: 0.015 + Math.random() * 0.02
      });
    }
    function spawnSparkle() {
      sparkles.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2, life: 1, hue: 45 + Math.random() * 15 });
    }
    function drawDiya(ctx, x, y, r, glow) {
      ctx.save(); ctx.translate(x, y);
      // flame glow
      var g = ctx.createRadialGradient(0, -r * 0.9, 0, 0, -r * 0.9, r * 1.8);
      g.addColorStop(0, "rgba(255,210,90," + (0.55 * glow) + ")");
      g.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(0, -r * 0.9, r * 1.8, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      // flame
      ctx.beginPath(); ctx.ellipse(0, -r * 0.95, r * 0.22, r * 0.4 * glow, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,180,40,0.95)"; ctx.fill();
      // clay bowl (diya)
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI, false);
      ctx.fillStyle = "rgba(180,90,40,0.85)"; ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.78, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,170,60,0.55)"; ctx.fill();
      ctx.restore();
    }
    function loop() {
      frame++;
      ctx.clearRect(0, 0, W, H);
      if (frame % 18 === 0) spawnSparkle();
      diyas.forEach(function (d) {
        d.t += d.flicker; d.x += d.vx + Math.sin(d.t) * 0.3; d.y += d.vy;
        if (d.y < -30) { d.y = H + Math.random() * 60; d.x = Math.random() * W; }
        var glow = 0.75 + Math.sin(d.t * 3) * 0.25;
        drawDiya(ctx, d.x, d.y, d.r, glow);
      });
      sparkles = sparkles.filter(function (s) { return s.life > 0.01; });
      sparkles.forEach(function (s) {
        s.life -= 0.012;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + s.hue + ",95%,75%," + s.life + ")"; ctx.fill();
      });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🎆 Arrow Fireworks — Dussehra */
  function pArrowFireworks(ctx, W, H, cb) {
    var rockets = [], sparks = [], frame = 0;
    function launch() { rockets.push({ x: W * (0.2 + Math.random() * 0.6), y: H + 10, vy: -(5 + Math.random() * 4), targetY: H * (0.1 + Math.random() * 0.4), hue: 35 + Math.random() * 20, trail: [] }); }
    function burstAt(x, y, hue) { for (var i = 0; i < 50; i++) { var a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.5; sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, hue: hue + (Math.random() * 30 - 15), r: 2 + Math.random() * 2.5 }); } }
    function loop() {
      frame++; ctx.clearRect(0, 0, W, H);
      if (frame % 70 === 0) launch();
      rockets = rockets.filter(function (r) { return r.y > r.targetY; });
      rockets.forEach(function (r) {
        r.trail.push({ x: r.x, y: r.y }); if (r.trail.length > 10) r.trail.shift();
        r.y += r.vy;
        if (r.y <= r.targetY) { burstAt(r.x, r.y, r.hue); r.y = -999; return; }
        for (var i = 0; i < r.trail.length; i++) {
          ctx.beginPath(); ctx.arc(r.trail[i].x, r.trail[i].y, 2 * (i / r.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = "hsla(" + r.hue + ",85%,65%," + ((i / r.trail.length) * 0.8) + ")"; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(r.x, r.y, 3, 0, Math.PI * 2); ctx.fillStyle = "hsla(" + r.hue + ",90%,80%,1)"; ctx.fill();
      });
      sparks = sparks.filter(function (s) { return s.life > 0.01; });
      sparks.forEach(function (s) {
        s.x += s.vx; s.y += s.vy; s.vy += 0.055; s.vx *= 0.98; s.life -= 0.018;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + s.hue + ",90%,65%," + s.life + ")"; ctx.fill();
      });
      cb(requestAnimationFrame(loop));
    }
    launch(); launch(); cb(requestAnimationFrame(loop));
  }

  /* ❄️ Snow — Christmas */
  function pSnow(ctx, W, H, cb) {
    var flakes = [];
    for (var i = 0; i < 140; i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 3.5, sp: 0.4 + Math.random() * 1.1, sw: 0.3 + Math.random() * 0.8, t: Math.random() * Math.PI * 2, alpha: 0.5 + Math.random() * 0.5 });
    function loop() {
      ctx.clearRect(0, 0, W, H);
      flakes.forEach(function (f) {
        f.t += 0.018; f.x += Math.sin(f.t) * f.sw; f.y += f.sp;
        if (f.y > H + 8) { f.y = -8; f.x = Math.random() * W; }
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.t);
        ctx.beginPath();
        for (var a = 0; a < 6; a++) { ctx.moveTo(0, 0); ctx.lineTo(0, f.r * 2.2); ctx.rotate(Math.PI / 3); }
        ctx.strokeStyle = "rgba(255,255,255," + f.alpha + ")"; ctx.lineWidth = f.r * 0.55; ctx.stroke();
        ctx.restore();
      });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🎨 Color Burst — Holi */
  function pColorBurst(ctx, W, H, cb) {
    var orbs = [], powder = [];
    var hues = [0, 30, 60, 120, 180, 200, 260, 300, 330];
    for (var i = 0; i < 90; i++) { var h = hues[Math.floor(Math.random() * hues.length)]; orbs.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 1.4, vy: (Math.random() - 0.5) * 1.4, r: 6 + Math.random() * 14, hue: h, alpha: 0.35 + Math.random() * 0.45, t: Math.random() * Math.PI * 2 }); }
    for (var i = 0; i < 60; i++) powder.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.5, r: 2 + Math.random() * 5, hue: hues[Math.floor(Math.random() * hues.length)], life: 0.5 + Math.random() * 0.5, decay: 0.002 + Math.random() * 0.003 });
    function loop() {
      ctx.clearRect(0, 0, W, H);
      orbs.forEach(function (o) {
        o.t += 0.014; o.x += o.vx + Math.sin(o.t) * 0.5; o.y += o.vy + Math.cos(o.t) * 0.4;
        if (o.x < -20) o.x = W + 10; if (o.x > W + 20) o.x = -10; if (o.y < -20) o.y = H + 10; if (o.y > H + 20) o.y = -10;
        var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 2);
        g.addColorStop(0, "hsla(" + o.hue + ",95%,65%," + o.alpha + ")"); g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      });
      powder.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0) { p.x = Math.random() * W; p.y = Math.random() * H; p.life = 0.5 + Math.random() * 0.5; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + p.hue + ",90%,68%," + (p.life * 0.7) + ")"; ctx.fill();
      });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🇮🇳 Tricolor confetti */
  function pTricolor(ctx, W, H, cb) {
    var pieces = [];
    var cols = ["255,153,51", "255,255,255", "19,136,8", "0,0,128"];
    for (var i = 0; i < 110; i++) pieces.push({ x: Math.random() * W, y: -20 - Math.random() * H * 1.2, vx: (Math.random() - 0.5) * 1.2, vy: 0.9 + Math.random() * 1.8, w: 8 + Math.random() * 10, h: 4 + Math.random() * 5, rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.1, col: cols[Math.floor(Math.random() * cols.length)], t: Math.random() * Math.PI * 2 });
    function loop() {
      ctx.clearRect(0, 0, W, H);
      pieces.forEach(function (p) {
        p.t += 0.02; p.x += p.vx + Math.sin(p.t) * 0.5; p.y += p.vy; p.rot += p.rotV;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = "rgba(" + p.col + ",0.88)";
        ctx.beginPath(); ctx.moveTo(-p.w / 2, 0); ctx.bezierCurveTo(-p.w / 2, -p.h, p.w / 2, -p.h, p.w / 2, 0); ctx.bezierCurveTo(p.w / 2, p.h, -p.w / 2, p.h, -p.w / 2, 0); ctx.fill();
        ctx.restore();
      });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🐘 Marigolds — Ganesh */
  function pMarigolds(ctx, W, H, cb) {
    var flowers = [];
    var cols = ["255,165,0", "255,140,0", "255,200,0", "255,100,50", "255,180,50"];
    for (var i = 0; i < 55; i++) flowers.push({ x: Math.random() * W, y: -30 - Math.random() * H, vy: 0.5 + Math.random() * 1.2, vx: (Math.random() - 0.5) * 0.8, r: 8 + Math.random() * 12, col: cols[Math.floor(Math.random() * cols.length)], rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.04, t: Math.random() * Math.PI * 2, petals: 6 + Math.floor(Math.random() * 6) });
    function drawM(ctx, x, y, r, petals, col, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      for (var i = 0; i < petals; i++) { ctx.rotate(Math.PI * 2 / petals); ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.35, r * 0.55, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(" + col + ",0.82)"; ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,220,50,0.9)"; ctx.fill();
      ctx.restore();
    }
    function loop() {
      ctx.clearRect(0, 0, W, H);
      flowers.forEach(function (f) { f.t += 0.015; f.x += f.vx + Math.sin(f.t) * 0.7; f.y += f.vy; f.rot += f.rotV; if (f.y > H + 30) { f.y = -30; f.x = Math.random() * W; } drawM(ctx, f.x, f.y, f.r, f.petals, f.col, f.rot); });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🌸 Petals */
  function pFlowers(ctx, W, H, cb) {
    var petals = [];
    var cols = ["255,182,193", "255,218,185", "255,255,153", "180,235,180", "200,180,255", "255,160,122"];
    for (var i = 0; i < 75; i++) petals.push({ x: Math.random() * W, y: -30 - Math.random() * H, vx: (Math.random() - 0.5) * 1.0, vy: 0.6 + Math.random() * 1.3, r: 5 + Math.random() * 9, col: cols[Math.floor(Math.random() * cols.length)], rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.06, t: Math.random() * Math.PI * 2 });
    function loop() {
      ctx.clearRect(0, 0, W, H);
      petals.forEach(function (p) { p.t += 0.017; p.x += p.vx + Math.sin(p.t) * 0.65; p.y += p.vy; p.rot += p.rotV; if (p.y > H + 30) { p.y = -30; p.x = Math.random() * W; } ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(" + p.col + ",0.75)"; ctx.fill(); ctx.restore(); });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 💃 Dandiya — Navratri */
  function pDandiya(ctx, W, H, cb) {
    var sticks = [], orbs = [];
    var sc = ["255,50,100", "255,150,20", "180,30,200", "20,180,100", "50,100,255"];
    for (var i = 0; i < 40; i++) sticks.push({ x: Math.random() * W, y: -40 - Math.random() * H, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 2, len: 18 + Math.random() * 22, rot: Math.random() * Math.PI, rotV: (Math.random() - 0.5) * 0.12, col: sc[Math.floor(Math.random() * sc.length)], t: Math.random() * Math.PI * 2 });
    for (var i = 0; i < 50; i++) orbs.push({ x: Math.random() * W, y: Math.random() * H, r: 3 + Math.random() * 7, hue: Math.random() * 360, alpha: 0.2 + Math.random() * 0.4, t: Math.random() * Math.PI * 2, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8 });
    function loop() {
      ctx.clearRect(0, 0, W, H);
      orbs.forEach(function (o) { o.t += 0.02; o.x += o.vx + Math.sin(o.t) * 0.5; o.y += o.vy + Math.cos(o.t) * 0.4; if (o.x < -15) o.x = W + 10; if (o.x > W + 15) o.x = -10; if (o.y < -15) o.y = H + 10; if (o.y > H + 15) o.y = -10; var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 2.5); g.addColorStop(0, "hsla(" + o.hue + ",90%,65%," + o.alpha + ")"); g.addColorStop(1, "transparent"); ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 2.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); });
      sticks.forEach(function (s) {
        s.t += 0.02; s.x += s.vx + Math.sin(s.t) * 0.6; s.y += s.vy; s.rot += s.rotV;
        if (s.y > H + 40) { s.y = -40; s.x = Math.random() * W; }
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.lineCap = "round";
        for (var seg = 0; seg < 4; seg++) { var ss = -s.len / 2 + seg * (s.len / 4); ctx.beginPath(); ctx.moveTo(ss, 0); ctx.lineTo(ss + s.len / 4, 0); ctx.strokeStyle = seg % 2 === 0 ? "rgba(" + s.col + ",0.9)" : "rgba(255,215,0,0.9)"; ctx.lineWidth = 5; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(-s.len / 2, 0, 4, 0, Math.PI * 2); ctx.fillStyle = "rgba(" + s.col + ",1)"; ctx.fill();
        ctx.beginPath(); ctx.arc(s.len / 2, 0, 4, 0, Math.PI * 2); ctx.fillStyle = "rgba(" + s.col + ",1)"; ctx.fill();
        ctx.restore();
      });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🌙⭐ Crescent Stars — Eid, Janmashtami */
  function pCrescentStars(ctx, W, H, cb) {
    var stars = [], crescents = [];
    for (var i = 0; i < 80; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 4, t: Math.random() * Math.PI * 2, sp: 0.008 + Math.random() * 0.025, hue: 40 + Math.random() * 30 });
    for (var i = 0; i < 8; i++) crescents.push({ x: Math.random() * W, y: Math.random() * H, r: 12 + Math.random() * 18, t: Math.random() * Math.PI * 2, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3 });
    function drawC(ctx, x, y, r, t) { var a = 0.3 + Math.sin(t) * 0.2; ctx.save(); ctx.translate(x, y); ctx.rotate(t); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,215,50," + a + ")"; ctx.fill(); ctx.beginPath(); ctx.arc(r * 0.35, 0, r * 0.8, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill(); ctx.restore(); }
    function loop() {
      ctx.clearRect(0, 0, W, H);
      stars.forEach(function (s) { s.t += s.sp; var a = 0.2 + Math.abs(Math.sin(s.t)) * 0.75; drawStar5(ctx, s.x, s.y, s.r, s.r * 0.42, a, s.hue); });
      crescents.forEach(function (c) { c.t += 0.01; c.x += c.vx; c.y += c.vy; if (c.x < -40) c.x = W + 20; if (c.x > W + 40) c.x = -20; if (c.y < -40) c.y = H + 20; if (c.y > H + 40) c.y = -20; drawC(ctx, c.x, c.y, c.r, c.t); });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* ☀️ Sun Rays — Pongal */
  function pSunRays(ctx, W, H, cb) {
    var particles = [];
    for (var i = 0; i < 70; i++) particles.push({ x: Math.random() * W, y: Math.random() * H, r: 2 + Math.random() * 5, hue: 30 + Math.random() * 40, alpha: 0.3 + Math.random() * 0.5, t: Math.random() * Math.PI * 2, sp: 0.02 + Math.random() * 0.03 });
    function loop() {
      ctx.clearRect(0, 0, W, H);
      var sg = ctx.createRadialGradient(W / 2, -60, 0, W / 2, -60, 240); sg.addColorStop(0, "rgba(255,220,50,0.22)"); sg.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(W / 2, -60, 240, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
      for (var i = 0; i < 12; i++) { var a = i * (Math.PI / 6) + Date.now() * 0.0003; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * 80, Math.sin(a) * 80 - 60); ctx.lineTo(W / 2 + Math.cos(a) * (H * 0.9), Math.sin(a) * (H * 0.9) - 60); ctx.strokeStyle = "rgba(255,200,30,0.055)"; ctx.lineWidth = 18; ctx.stroke(); }
      particles.forEach(function (p) { p.t += p.sp; var a = 0.2 + Math.abs(Math.sin(p.t)) * 0.6; drawStar5(ctx, p.x, p.y, p.r, p.r * 0.45, a, p.hue); });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🪁 Kites — Makar Sankranti */
  function pKites(ctx, W, H, cb) {
    var kites = [];
    var kc = ["220,20,60", "30,144,255", "34,139,34", "255,165,0", "148,0,211"];
    for (var i = 0; i < 18; i++) kites.push({ x: Math.random() * W, y: Math.random() * H * 0.7, vx: 0.4 + Math.random() * 0.9, vy: (Math.random() - 0.5) * 0.5, size: 14 + Math.random() * 22, col: kc[Math.floor(Math.random() * kc.length)], t: Math.random() * Math.PI * 2 });
    function drawK(ctx, x, y, sz, col, t) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t) * 0.12); ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.6, 0); ctx.lineTo(0, sz * 1.3); ctx.lineTo(-sz * 0.6, 0); ctx.closePath(); ctx.fillStyle = "rgba(" + col + ",0.82)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-sz * 0.6, 0); ctx.lineTo(sz * 0.6, 0); ctx.moveTo(0, -sz); ctx.lineTo(0, sz * 1.3); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, sz * 1.3); for (var i = 0; i < 5; i++) ctx.lineTo(Math.sin(t + i) * 10, sz * 1.3 + i * 12); ctx.strokeStyle = "rgba(" + col + ",0.55)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
    function loop() {
      ctx.clearRect(0, 0, W, H);
      kites.forEach(function (k) { k.t += 0.025; k.x += k.vx; k.y += k.vy + Math.sin(k.t) * 0.3; if (k.x > W + 40) { k.x = -30; k.y = Math.random() * H * 0.7; } if (k.y < 0 || k.y > H * 0.8) k.vy *= -1; drawK(ctx, k.x, k.y, k.size, k.col, k.t); });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🌾 Wheat — Baisakhi */
  function pWheat(ctx, W, H, cb) {
    var stalks = [];
    for (var i = 0; i < 60; i++) stalks.push({ x: Math.random() * W, y: -30 - Math.random() * H, vy: 0.8 + Math.random() * 1.4, vx: (Math.random() - 0.5) * 0.6, h: 18 + Math.random() * 24, t: Math.random() * Math.PI * 2, gold: Math.floor(160 + Math.random() * 80) });
    function drawW(ctx, x, y, h, t, g) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t) * 0.15); ctx.strokeStyle = "rgba(" + g + "," + (Math.floor(g * 0.7)) + ",20,0.85)"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, h); ctx.stroke(); for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(Math.sin(i * 0.8) * 3, -i * 3, 2, 4, Math.sin(i) * 0.3, 0, Math.PI * 2); ctx.fillStyle = "rgba(" + g + "," + (Math.floor(g * 0.6)) + ",30,0.8)"; ctx.fill(); } ctx.restore(); }
    function loop() {
      ctx.clearRect(0, 0, W, H);
      stalks.forEach(function (s) { s.t += 0.018; s.x += s.vx + Math.sin(s.t) * 0.4; s.y += s.vy; if (s.y > H + 30) { s.y = -30; s.x = Math.random() * W; } drawW(ctx, s.x, s.y, s.h, s.t, s.gold); });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* 🔥 Bonfire — Lohri */
  function pBonfire(ctx, W, H, cb) {
    var embers = [], frame = 0;
    function spawn() { embers.push({ x: W / 2 + (Math.random() - 0.5) * 80, y: H, vx: (Math.random() - 0.5) * 3, vy: -(2 + Math.random() * 5), life: 0.8 + Math.random() * 0.8, r: 2 + Math.random() * 4, hue: 15 + Math.random() * 40 }); }
    function loop() {
      frame++; ctx.clearRect(0, 0, W, H);
      if (frame % 2 === 0) spawn();
      embers = embers.filter(function (e) { return e.life > 0; });
      embers.forEach(function (e) { e.x += e.vx; e.y += e.vy; e.vy -= 0.04; e.vx *= 0.99; e.life -= 0.012; var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2); g.addColorStop(0, "hsla(" + e.hue + ",95%,70%," + e.life + ")"); g.addColorStop(1, "transparent"); ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* ✦ Stars — fallback */
  function pStars(ctx, W, H, cb) {
    var stars = [];
    for (var i = 0; i < 80; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 3.5, t: Math.random() * Math.PI * 2, sp: 0.01 + Math.random() * 0.025, hue: 40 + Math.random() * 30, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15 });
    function loop() {
      ctx.clearRect(0, 0, W, H);
      stars.forEach(function (s) { s.t += s.sp; s.x += s.vx; s.y += s.vy; if (s.x < 0) s.x = W; if (s.x > W) s.x = 0; if (s.y < 0) s.y = H; if (s.y > H) s.y = 0; drawStar5(ctx, s.x, s.y, s.r, s.r * 0.42, 0.2 + Math.abs(Math.sin(s.t)) * 0.75, s.hue); });
      cb(requestAnimationFrame(loop));
    }
    cb(requestAnimationFrame(loop));
  }

  /* shared 5-point star */
  function drawStar5(ctx, cx, cy, outerR, innerR, alpha, hue) {
    ctx.save(); var rot = -Math.PI / 2, step = Math.PI / 5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    for (var i = 0; i < 5; i++) { rot += step; ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step; ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); }
    ctx.closePath(); ctx.fillStyle = "hsla(" + hue + ",88%,70%," + alpha + ")"; ctx.fill(); ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════
     MIDNIGHT REFRESH
  ══════════════════════════════════════════════════════════ */
  function midnight() {
    var now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    setTimeout(function () { location.reload(); }, next - now);
  }

  /* ══════════════════════════════════════════════════════════
     START
  ══════════════════════════════════════════════════════════ */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

})();