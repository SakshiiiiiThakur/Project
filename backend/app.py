import os, sys, json, subprocess, hashlib, uuid, re, io, urllib.parse, base64
from datetime import datetime
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from groq import Groq
from rag_engine import search

# APScheduler for nightly SPPU refresh
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False

# PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

load_dotenv()

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))
SCRAPER_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "scraper", "sppu_scraper.py"))
NOTICES_FILE = os.path.abspath(os.path.join(BASE_DIR, "..", "data", "notices_admin.json"))
EVENTS_FILE  = os.path.abspath(os.path.join(BASE_DIR, "..", "data", "events.json"))
UPLOADS_DIR  = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "uploads"))
os.makedirs(UPLOADS_DIR, exist_ok=True)
PDFS_DIR     = os.path.abspath(os.path.join(BASE_DIR, "..", "sppu_data", "pdfs"))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Precise document identification helpers ───────────────────────────────────
# KEY FIX: previously a PDF was "matched" if ANY single generic word
# (e.g. "pattern", "timetable", "sppu") overlapped with the query, which
# caused completely wrong documents to be returned (e.g. asking for the
# "B.E. 2019 pattern timetable" returned a "B.Lib. 2020 pattern" timetable,
# because both names contain "timetable" and "pattern").
# Now we extract the degree/program code and year(s) from both the query
# and each candidate document name, and require them to match whenever the
# query actually specifies them — these are the terms that truly identify
# *which* document the person wants.
_DEGREE_RE = re.compile(
    r"(?<![A-Za-z])("
    r"b\.?lib\.?i\.?sc|m\.?lib\.?i\.?sc|"   # B.Lib.I.Sc / M.Lib.I.Sc
    r"b\.?lib|m\.?lib|"
    r"b\.?tech|m\.?tech|"
    r"b\.?sc|m\.?sc|"
    r"b\.?com|m\.?com|"
    r"b\.?pharm|m\.?pharm|"
    r"b\.?a|m\.?a|"
    r"f\.?e|s\.?e|t\.?e|b\.?e|m\.?e|"        # engineering year codes
    r"bba|bca|mca|mba|llb|llm|ph\.?d"
    r")(?![A-Za-z])",
    re.IGNORECASE,
)
_YEAR_RE = re.compile(r"(?<!\d)(?:19|20)\d{2}(?!\d)")

def _norm_token(token: str) -> str:
    """Strip punctuation/whitespace so 'B.E.' and 'BE' compare equal."""
    return re.sub(r"[^a-z0-9]", "", token.lower())

def _extract_degrees(text: str) -> set:
    return {_norm_token(m) for m in _DEGREE_RE.findall(text)}

def _extract_years(text: str) -> set:
    return set(_YEAR_RE.findall(text))

def _doc_matches_query(query_lower: str, doc_name_lower: str) -> bool:
    """
    Decide whether a candidate document is really what the user asked for.
    1. If the query names a specific degree/program (B.E., F.E., B.Lib, etc.),
       the document must mention that SAME code (not just any code).
    2. If the query names a specific year (e.g. 2019), the document must
       contain that same year somewhere in its name.
    3. Otherwise, fall back to requiring at least one shared meaningful word
       (the previous, looser behaviour) so generic queries still work.
    """
    query_degrees = _extract_degrees(query_lower)
    if query_degrees:
        doc_degrees = _extract_degrees(doc_name_lower)
        if not doc_degrees or query_degrees.isdisjoint(doc_degrees):
            return False

    query_years = _extract_years(query_lower)
    if query_years:
        doc_years = _extract_years(doc_name_lower)
        if not doc_years or query_years.isdisjoint(doc_years):
            return False

    if query_degrees or query_years:
        # Identifying info matched — that's a strong enough signal.
        return True

    # No degree/year specified in the query — fall back to loose word overlap.
    query_words = {w for w in query_lower.split() if len(w) > 3}
    return any(w in doc_name_lower for w in query_words)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── Admin credentials ─────────────────────────────────────────────────────────
ADMIN_CREDENTIALS = {
    "admin": hashlib.sha256("pvpit@admin123".encode()).hexdigest()
}
SESSIONS = {}

# ── Student credentials (role-based) ─────────────────────────────────────────
# Format: username -> {password_hash, role, department, year}
STUDENTS_FILE = os.path.abspath(os.path.join(BASE_DIR, "..", "data", "students.json"))

def load_students():
    if os.path.exists(STUDENTS_FILE):
        with open(STUDENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    # Default demo students
    return {
        "student1": {
            "password": hashlib.sha256("student123".encode()).hexdigest(),
            "role": "student", "name": "Demo Student",
            "department": "Computer Engineering", "year": "SE"
        },
        "visitor1": {
            "password": hashlib.sha256("visitor123".encode()).hexdigest(),
            "role": "visitor", "name": "Demo Visitor",
            "department": "", "year": ""
        }
    }

def save_students(students):
    os.makedirs(os.path.dirname(STUDENTS_FILE), exist_ok=True)
    with open(STUDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(students, f, indent=2, ensure_ascii=False)

# ── Notices helpers ───────────────────────────────────────────────────────────
def load_notices():
    if os.path.exists(NOTICES_FILE):
        with open(NOTICES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return [
        {"id": str(uuid.uuid4()), "title": "Tech Fest 2026",
         "body": "Annual technical festival featuring coding competitions, robotics, and innovation challenges.",
         "date": "March 2026", "created_at": datetime.now().isoformat()},
        {"id": str(uuid.uuid4()), "title": "Industry Expert Lecture Series",
         "body": "Renowned experts from leading tech companies share insights on emerging technologies.",
         "date": "February 2026", "created_at": datetime.now().isoformat()},
        {"id": str(uuid.uuid4()), "title": "Hackathon Winners Announced",
         "body": "PVPIT students won first place in the national-level coding hackathon.",
         "date": "January 2026", "created_at": datetime.now().isoformat()},
    ]

def save_notices(notices):
    os.makedirs(os.path.dirname(NOTICES_FILE), exist_ok=True)
    with open(NOTICES_FILE, "w", encoding="utf-8") as f:
        json.dump(notices, f, indent=2, ensure_ascii=False)

def require_auth():
    token = request.headers.get("X-Admin-Token", "")
    return SESSIONS.get(token)


# ── Per-language system prompt instructions ───────────────────────────────────
LANG_INSTRUCTIONS = {
    "en": {
        "respond_in": "YOU MUST respond ONLY in English. Every sentence must be in English.",
        "not_found":  "I could not find specific details in my data. Please check collegecirculars.unipune.ac.in directly or contact the college office.",
        "table_hint": "For timetable questions, use a markdown table: | Date | Day | Subject | Time |",
    },
    "hi": {
        "respond_in": "आपको केवल हिंदी में जवाब देना है। हर वाक्य हिंदी में होना चाहिए। अंग्रेजी में जवाब मत दो।",
        "not_found":  "मुझे यह जानकारी नहीं मिली। कृपया collegecirculars.unipune.ac.in देखें या कॉलेज से संपर्क करें।",
        "table_hint": "परीक्षा वेळापत्रक के सवालों के लिए तालिका बनाएं: | तारीख | दिन | विषय | समय |",
    },
    "mr": {
        "respond_in": "तुम्ही फक्त मराठीत उत्तर दिले पाहिजे. प्रत्येक वाक्य मराठीत असले पाहिजे. इंग्रजीत उत्तर देऊ नका.",
        "not_found":  "मला ही माहिती सापडली नाही. कृपया collegecirculars.unipune.ac.in तपासा किंवा महाविद्यालयाशी संपर्क करा.",
        "table_hint": "परीक्षा वेळापत्रकासाठी तक्ता वापरा: | तारीख | दिवस | विषय | वेळ |",
    },
    "gu": {
        "respond_in": "તમારે ફક્ત ગુજરાતીમાં જ જવાબ આપવો જોઈએ. દરેક વાક્ય ગુજરાતીમાં હોવું જોઈએ. અંગ્રેજીમાં જવાબ ન આપો.",
        "not_found":  "મારી પાસે આ માહિતી મળી નથી. કૃપા કરીને collegecirculars.unipune.ac.in તપાસો અથવા કૉલેજ સાથે સંપર્ક કરો.",
        "table_hint": "પરીક્ષા સમયપત્રક માટે કોષ્ટક વાપરો: | તારીખ | દિવસ | વિષય | સમય |",
    },
}

# ── FIXED SYSTEM PROMPT ───────────────────────────────────────────────────────
# KEY FIX: Now instructs the LLM to USE the context directly instead of
# saying "I don't have this information" when the answer IS in context.
SYSTEM_PROMPT = """\
You are PVPIT Assistant for PVPIT college Pune, affiliated to SPPU.

══════════════════════════════════════════
LANGUAGE RULE — MOST IMPORTANT:
══════════════════════════════════════════
{respond_in}
ALL your text must be in that language.
Only keep URLs, document filenames, and proper nouns (SPPU, PVPIT, B.E.) in English.

══════════════════════════════════════════
YOUR DATABASE CONTEXT:
══════════════════════════════════════════
{context}
══════════════════════════════════════════

ANSWERING RULES:

1. READ the context above carefully. If the answer is there, use it directly.
   Never say "I don't have this information" when the context has the answer.

2. For EXAM FORM / HOW TO questions:
   - Explain the steps clearly in {respond_in} language
   - Exam forms are filled at: studentportal.unipune.ac.in
   - Steps: Login → Select exam → Fill details → Pay fee → Submit → Download receipt

3. For RESULTS: results.unipune.ac.in
   For SCHOLARSHIPS: mahadbt.maharashtra.gov.in
   For TIMETABLES: collegecirculars.unipune.ac.in

4. {table_hint}

5. If not in context: {not_found}
"""

# ── PDF Generator ─────────────────────────────────────────────────────────────
def build_pdf(title: str, content: str) -> io.BytesIO:
    """Convert chatbot reply text → styled A4 PDF in memory."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )

    styles = getSampleStyleSheet()
    s_title = ParagraphStyle("pvp_title",
        parent=styles["Title"],
        fontSize=18, textColor=colors.HexColor("#c0392b"),
        spaceAfter=6, alignment=TA_CENTER, fontName="Helvetica-Bold")
    s_sub = ParagraphStyle("pvp_sub",
        parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#888888"),
        spaceAfter=12, alignment=TA_CENTER)
    s_body = ParagraphStyle("pvp_body",
        parent=styles["Normal"],
        fontSize=11, leading=16, spaceAfter=8)
    s_head = ParagraphStyle("pvp_head",
        parent=styles["Heading2"],
        fontSize=13, textColor=colors.HexColor("#c0392b"),
        spaceBefore=10, spaceAfter=4, fontName="Helvetica-Bold")

    story = []

    story.append(Paragraph("PVPIT – Padmabhooshan Vasantdada Patil Institute of Technology", s_title))
    story.append(Paragraph(
        f"Generated by EduSite AI Assistant &nbsp;|&nbsp; {datetime.now().strftime('%d %b %Y, %I:%M %p')}",
        s_sub))
    story.append(HRFlowable(width="100%", thickness=1.5,
                             color=colors.HexColor("#c0392b"), spaceAfter=10))
    story.append(Paragraph(title, s_head))
    story.append(Spacer(1, 0.3*cm))

    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if line.startswith("|") and i + 1 < len(lines) and "|" in lines[i+1]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1
            rows = []
            for tl in table_lines:
                if re.match(r"^\|[\s\-|:]+\|$", tl):
                    continue
                cells = [c.strip() for c in tl.strip("|").split("|")]
                rows.append(cells)

            if rows:
                col_count = max(len(r) for r in rows)
                rows = [r + [""] * (col_count - len(r)) for r in rows]
                tbl = Table(rows, repeatRows=1, hAlign="LEFT")
                tbl.setStyle(TableStyle([
                    ("BACKGROUND",  (0,0), (-1,0), colors.HexColor("#c0392b")),
                    ("TEXTCOLOR",   (0,0), (-1,0), colors.white),
                    ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
                    ("FONTSIZE",    (0,0), (-1,0), 10),
                    ("ALIGN",       (0,0), (-1,0), "CENTER"),
                    ("FONTNAME",    (0,1), (-1,-1), "Helvetica"),
                    ("FONTSIZE",    (0,1), (-1,-1), 9),
                    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#fdf2f2")]),
                    ("GRID",        (0,0), (-1,-1), 0.5, colors.HexColor("#dddddd")),
                    ("TOPPADDING",  (0,0), (-1,-1), 5),
                    ("BOTTOMPADDING",(0,0),(-1,-1), 5),
                    ("LEFTPADDING", (0,0), (-1,-1), 6),
                    ("RIGHTPADDING",(0,0), (-1,-1), 6),
                    ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
                    ("BOX",         (0,0), (-1,-1), 1.2, colors.HexColor("#c0392b")),
                ]))
                story.append(tbl)
                story.append(Spacer(1, 0.4*cm))
            continue

        if line.startswith("## "):
            story.append(Paragraph(line[3:], s_head))
            i += 1; continue
        if line.startswith("# "):
            story.append(Paragraph(line[2:], s_head))
            i += 1; continue
        if line.startswith(("- ", "* ", "• ")):
            story.append(Paragraph("• " + line[2:], s_body))
            i += 1; continue
        if line:
            story.append(Paragraph(line, s_body))
        else:
            story.append(Spacer(1, 0.2*cm))
        i += 1

    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=0.5,
                             color=colors.HexColor("#cccccc"), spaceAfter=6))
    story.append(Paragraph(
        "This document was auto-generated by EduSite AI. "
        "For official information visit <b>unipune.ac.in</b> or contact PVPIT administration.",
        ParagraphStyle("footer", parent=styles["Normal"],
                       fontSize=8, textColor=colors.HexColor("#999999"),
                       alignment=TA_CENTER)
    ))

    doc.build(story)
    buf.seek(0)
    return buf

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "groq_key": bool(os.getenv("GROQ_API_KEY")),
        "frontend": os.path.exists(os.path.join(FRONTEND_DIR, "index.html")),
        "notices_file": os.path.exists(NOTICES_FILE),
        "pdfs_dir": os.path.exists(PDFS_DIR),
        "pdfs_count": len(os.listdir(PDFS_DIR)) if os.path.exists(PDFS_DIR) else 0,
    })

@app.route("/pdfs/<path:filename>")
def serve_pdf(filename):
    """Serve locally downloaded SPPU PDFs directly from sppu_data/pdfs/."""
    import urllib.parse
    decoded = urllib.parse.unquote(filename)
    if not os.path.exists(PDFS_DIR):
        return jsonify({"error": "PDFs directory not found"}), 404
    return send_from_directory(PDFS_DIR, decoded, as_attachment=False)

# ── Chat ──────────────────────────────────────────────────────────────────────
@app.route("/chat", methods=["POST"])
def chat():
    data         = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    lang         = data.get("lang", "en").strip().lower()
    if lang not in LANG_INSTRUCTIONS:
        lang = "en"
    if not user_message:
        return jsonify({"reply": "Please send a message."}), 400

    # FIXED: increased top_k to 8 for better recall
    results = search(user_message, top_k=8)
    context = "\n\n---\n\n".join(results) if results else "No relevant data found in database."

    # DEBUG
    print(f"\n[CHAT DEBUG] Query: {user_message[:80]}")
    print(f"[CHAT DEBUG] Context chunks: {len(results)}")
    for i, r in enumerate(results[:3]):
        print(f"[CHAT DEBUG] chunk[{i}]: {r[:120]}")
    print()

    li = LANG_INSTRUCTIONS[lang]

    # ── Translated labels for PDF-found reply ─────────────────────────────
    PDF_LABELS = {
        "en": {
            "found":    "✅ Found it!",
            "doc":      "📄 **Document:**",
            "download": "📥 **Download directly:**",
            "sppu":     "🔗 **Also on SPPU:**",
            "hint":     "Click **⬇️ Download PDF** below to get the actual file.",
        },
        "hi": {
            "found":    "✅ मिल गया!",
            "doc":      "📄 **दस्तावेज़:**",
            "download": "📥 **सीधे डाउनलोड करें:**",
            "sppu":     "🔗 **SPPU पर भी देखें:**",
            "hint":     "नीचे **⬇️ Download PDF** बटन दबाकर असली फ़ाइल डाउनलोड करें।",
        },
        "mr": {
            "found":    "✅ सापडले!",
            "doc":      "📄 **दस्तऐवज:**",
            "download": "📥 **थेट डाउनलोड करा:**",
            "sppu":     "🔗 **SPPU वर देखील पहा:**",
            "hint":     "खाली **⬇️ Download PDF** बटण दाबून खरी फाइल डाउनलोड करा.",
        },
        "gu": {
            "found":    "✅ મળ્યું!",
            "doc":      "📄 **દસ્તાવેજ:**",
            "download": "📥 **સીધું ડાઉનલોડ કરો:**",
            "sppu":     "🔗 **SPPU પર પણ જુઓ:**",
            "hint":     "નીચે **⬇️ Download PDF** બટન દબાવી અસલ ફાઇલ ડાઉનલોડ કરો.",
        },
    }
    lbl = PDF_LABELS.get(lang, PDF_LABELS["en"])

    # ── Only extract PDF when query clearly asks for a document ───────────
    DOCUMENT_KEYWORDS = {
        "timetable","time table","time-table","endsem","insem","exam schedule",
        "schedule","syllabus","pdf","download","circular","admit card",
        "hall ticket","result","fee structure","notice","corrigendum","revised",
        "वेळापत्रक","टाइमटेबल","परीक्षा वेळ","समय सारणी","सूचना",
        "સમયપત્રક","પરીક્ષા","પરિણામ","वेळापत्रक","निकाल"
    }
    query_lower = user_message.lower()
    is_document_query = any(kw in query_lower for kw in DOCUMENT_KEYWORDS)

    direct_pdf_url = None
    sppu_pdf_url   = None
    pdf_doc_name   = None

    if is_document_query:
        for r in results:
            if "Local download:" in r and "EXAM DOCUMENT:" in r:
                c_name = c_local = c_sppu = None
                for line in r.splitlines():
                    line = line.strip()
                    if line.startswith("EXAM DOCUMENT:"):
                        c_name = line.replace("EXAM DOCUMENT:", "").strip()
                    elif line.startswith("Local download:"):
                        path = line.replace("Local download:", "").strip()
                        c_local = f"http://localhost:5000{path}"
                    elif line.startswith("SPPU link:"):
                        c_sppu = line.replace("SPPU link:", "").strip()
                # FIXED: require degree code + year to match when the query
                # specifies them, instead of accepting any single shared word.
                if c_name and c_local and _doc_matches_query(query_lower, c_name.lower()):
                    pdf_doc_name   = c_name
                    direct_pdf_url = c_local
                    sppu_pdf_url   = c_sppu
                    break  # `results` is already ranked best-first

    # If a matching PDF found — return immediately in the correct language
    if direct_pdf_url and pdf_doc_name:
        reply  = f"{lbl['found']}\n"
        reply += f"{lbl['doc']} {pdf_doc_name}\n"
        reply += f"{lbl['download']} {direct_pdf_url}\n"
        if sppu_pdf_url:
            reply += f"{lbl['sppu']} {sppu_pdf_url}\n"
        reply += f"\n{lbl['hint']}"
        return jsonify({
            "reply":         reply,
            "pdf_available": True,
            "pdf_title":     user_message[:80],
            "lang":          lang,
            "direct_pdf":    direct_pdf_url,
        })

    # ── No exact document matched a specific request — say so plainly ─────
    # FIXED: previously this fell through to the LLM with the same (wrong)
    # context chunks still attached, so it could still describe/imply the
    # mismatched document in prose. If the user clearly named a degree code
    # or year and nothing in our data matched it, tell them directly rather
    # than risk a confident-sounding wrong answer.
    if is_document_query and (_extract_degrees(query_lower) or _extract_years(query_lower)):
        return jsonify({
            "reply":         li["not_found"],
            "pdf_available": False,
            "pdf_title":     user_message[:80],
            "lang":          lang,
        })

    # ── General question — send to LLM ────────────────────────────────────
    prompt = SYSTEM_PROMPT.format(
        respond_in = li["respond_in"],
        not_found  = li["not_found"],
        table_hint = li["table_hint"],
        context    = context,
    )

    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user",   "content": user_message},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=1000,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        reply = f"Error contacting AI: {str(e)}"

    has_table    = "|" in (reply or "") and "---" in (reply or "")
    pdf_keywords = ["timetable","exam","schedule","result","hall ticket",
                    "admit card","fee","syllabus","notice","circular",
                    "परीक्षा","वेळापत्रक","टाइमटेबल","निकाल",
                    "समय सारणी","परिणाम","પરીક્ષા","સમયપત્રક"]
    is_pdf_worthy = has_table or any(kw in user_message.lower() for kw in pdf_keywords)

    return jsonify({
        "reply":         reply or "No response generated.",
        "pdf_available": is_pdf_worthy,
        "pdf_title":     user_message[:80],
        "lang":          lang,
    })

# ── TTS Proxy ─────────────────────────────────────────────────────────────────
@app.route("/tts", methods=["GET"])
def tts_proxy():
    text = request.args.get("text", "").strip()
    lang = request.args.get("lang", "en").strip()
    if not text:
        return jsonify({"error": "No text"}), 400
    allowed = {"en", "hi", "mr", "gu"}
    if lang not in allowed:
        lang = "en"
    try:
        import urllib.request
        url = (
            f"https://translate.google.com/translate_tts"
            f"?ie=UTF-8&tl={lang}&client=tw-ob&q={urllib.parse.quote(text)}"
        )
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 Chrome/120 Safari/537.36",
            "Referer": "https://translate.google.com/",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            audio_data = resp.read()
        response = app.response_class(audio_data, mimetype="audio/mpeg")
        response.headers["Cache-Control"] = "no-cache"
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── PDF Download ──────────────────────────────────────────────────────────────
@app.route("/chat/pdf", methods=["POST"])
def chat_pdf():
    data    = request.get_json(silent=True) or {}
    title   = data.get("title", "EduSite Response").strip()[:120]
    content = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "No content provided"}), 400
    try:
        buf = build_pdf(title, content)
        safe_title = re.sub(r"[^a-zA-Z0-9_\-]", "_", title)[:40]
        filename = f"PVPIT_{safe_title}_{datetime.now().strftime('%Y%m%d')}.pdf"
        return send_file(buf, mimetype="application/pdf",
                         as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── SPPU refresh ──────────────────────────────────────────────────────────────
@app.route("/sppu/refresh", methods=["POST"])
def refresh_sppu():
    try:
        result = subprocess.run(
            [sys.executable, SCRAPER_PATH],
            capture_output=True, text=True, timeout=900,
            cwd=os.path.dirname(SCRAPER_PATH)
        )
        log_out = (result.stdout or "")[-3000:]
        log_err = (result.stderr or "")[-1000:]
        if result.returncode == 0:
            try:
                from rag_engine import reload_sppu_index
                reload_sppu_index()
                reload_msg = "RAG index hot-reloaded ✅"
            except Exception as re:
                reload_msg = f"RAG reload skipped (restart Flask to apply): {re}"
            return jsonify({"status": "success", "log": log_out, "reload": reload_msg})
        return jsonify({"status": "error", "log": log_out, "stderr": log_err}), 500
    except subprocess.TimeoutExpired:
        return jsonify({"status": "error", "message": "Scraper timed out (>900 s)"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ── Admin: login / logout ─────────────────────────────────────────────────────
@app.route("/admin/login", methods=["POST"])
def admin_login():
    data     = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    pw_hash  = hashlib.sha256(password.encode()).hexdigest()
    if ADMIN_CREDENTIALS.get(username) == pw_hash:
        token = str(uuid.uuid4())
        SESSIONS[token] = username
        return jsonify({"status": "ok", "token": token, "username": username})
    return jsonify({"status": "error", "message": "Invalid username or password"}), 401

@app.route("/admin/logout", methods=["POST"])
def admin_logout():
    token = request.headers.get("X-Admin-Token", "")
    SESSIONS.pop(token, None)
    return jsonify({"status": "ok"})

# ── Admin: notices CRUD ───────────────────────────────────────────────────────
@app.route("/admin/notices", methods=["GET"])
def get_notices():
    return jsonify(load_notices())

@app.route("/admin/notices", methods=["POST"])
def add_notice():
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    if not data.get("title") or not data.get("body"):
        return jsonify({"status": "error", "message": "Title and body required"}), 400
    notices = load_notices()
    notice  = {
        "id":         str(uuid.uuid4()),
        "title":      data["title"].strip(),
        "body":       data["body"].strip(),
        "date":       data.get("date", datetime.now().strftime("%B %Y")),
        "created_at": datetime.now().isoformat(),
    }
    notices.insert(0, notice)
    save_notices(notices)
    return jsonify({"status": "ok", "notice": notice})

@app.route("/admin/notices/<notice_id>", methods=["PUT"])
def edit_notice(notice_id):
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data    = request.get_json(silent=True) or {}
    notices = load_notices()
    for n in notices:
        if n["id"] == notice_id:
            n["title"]      = data.get("title", n["title"]).strip()
            n["body"]       = data.get("body",  n["body"]).strip()
            n["date"]       = data.get("date",  n["date"])
            n["updated_at"] = datetime.now().isoformat()
            save_notices(notices)
            return jsonify({"status": "ok", "notice": n})
    return jsonify({"status": "error", "message": "Not found"}), 404

@app.route("/admin/notices/<notice_id>", methods=["DELETE"])
def delete_notice(notice_id):
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    notices  = load_notices()
    # Also delete any attachments for this notice
    for n in notices:
        if n["id"] == notice_id:
            for att in n.get("attachments", []):
                try:
                    fpath = os.path.join(UPLOADS_DIR, att["filename"])
                    if os.path.exists(fpath):
                        os.remove(fpath)
                except Exception:
                    pass
    filtered = [n for n in notices if n["id"] != notice_id]
    if len(filtered) == len(notices):
        return jsonify({"status": "error", "message": "Not found"}), 404
    save_notices(filtered)
    return jsonify({"status": "ok"})

# ── Notice attachment upload ───────────────────────────────────────────────────
ALLOWED_NOTICE_EXTS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".zip"}

@app.route("/admin/notices/<notice_id>/attachments", methods=["POST"])
def add_notice_attachment(notice_id):
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file provided"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"status": "error", "message": "Empty filename"}), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in ALLOWED_NOTICE_EXTS:
        return jsonify({"status": "error", "message": f"File type {ext} not allowed"}), 400
    notices = load_notices()
    notice  = next((n for n in notices if n["id"] == notice_id), None)
    if not notice:
        return jsonify({"status": "error", "message": "Notice not found"}), 404
    unique_name = f"notice_{notice_id}_{uuid.uuid4().hex[:8]}{ext}"
    save_path   = os.path.join(UPLOADS_DIR, unique_name)
    f.save(save_path)
    att = {"filename": unique_name, "original_name": f.filename, "ext": ext}
    if "attachments" not in notice:
        notice["attachments"] = []
    notice["attachments"].append(att)
    save_notices(notices)
    return jsonify({"status": "ok", "attachment": att})

@app.route("/admin/notices/<notice_id>/attachments/<filename>", methods=["DELETE"])
def delete_notice_attachment(notice_id, filename):
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    notices = load_notices()
    notice  = next((n for n in notices if n["id"] == notice_id), None)
    if not notice:
        return jsonify({"status": "error", "message": "Notice not found"}), 404
    original_len = len(notice.get("attachments", []))
    notice["attachments"] = [a for a in notice.get("attachments", []) if a["filename"] != filename]
    if len(notice["attachments"]) == original_len:
        return jsonify({"status": "error", "message": "Attachment not found"}), 404
    try:
        fpath = os.path.join(UPLOADS_DIR, filename)
        if os.path.exists(fpath):
            os.remove(fpath)
    except Exception:
        pass
    save_notices(notices)
    return jsonify({"status": "ok"})

# ── NLP Admin Command Interface ───────────────────────────────────────────────
# This is the core paper contribution: natural language → intent → action
NLP_COMMAND_PROMPT = """\
You are an AI assistant that converts natural language admin commands into structured JSON actions for a college website.

Extract the intent and entities from the admin's command and return ONLY valid JSON (no markdown, no explanation).

Supported actions:
- "add_notice": add a new notice/announcement
- "delete_notice": remove a notice by title keyword
- "edit_notice": update an existing notice by title keyword
- "schedule_event": schedule a cultural or college event
- "refresh_sppu": refresh SPPU data from the university portal
- "unknown": if the command doesn't match any action

Return this exact JSON structure:
{
  "action": "<action_name>",
  "title": "<notice title>",
  "body": "<notice body/description>",
  "date": "<date string, e.g. March 2026>",
  "department": "<department if mentioned, else ''>",
  "keyword": "<keyword to find notice for delete/edit>",
  "confidence": <0.0 to 1.0>,
  "explanation": "<one sentence: what you understood>"
}

Examples:
Command: "Add a notice about exam postponement for SE Computer on 20th March"
→ {"action":"add_notice","title":"Exam Postponement — SE Computer","body":"Examination for SE Computer Engineering has been postponed. Please check updated schedule.","date":"March 2026","department":"SE Computer","keyword":"","confidence":0.95,"explanation":"Adding exam postponement notice for SE Computer department."}

Command: "Post that the library will be closed on 25th June for maintenance"
→ {"action":"add_notice","title":"Library Closure — 25th June","body":"The college library will remain closed on 25th June due to maintenance work.","date":"June 2026","department":"","keyword":"","confidence":0.92,"explanation":"Adding library closure notice for 25th June."}

Command: "Remove the notice about Tech Fest"
→ {"action":"delete_notice","title":"","body":"","date":"","department":"","keyword":"Tech Fest","confidence":0.90,"explanation":"Deleting the notice that contains 'Tech Fest'."}

Command: "Refresh SPPU data"
→ {"action":"refresh_sppu","title":"","body":"","date":"","department":"","keyword":"","confidence":1.0,"explanation":"Triggering SPPU data refresh."}
"""

@app.route("/admin/nlp-command", methods=["POST"])
def admin_nlp_command():
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data    = request.get_json(silent=True) or {}
    command = data.get("command", "").strip()
    if not command:
        return jsonify({"status": "error", "message": "No command provided"}), 400

    # Step 1: Parse intent with LLaMA 3
    try:
        llm_response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": NLP_COMMAND_PROMPT},
                {"role": "user",   "content": command}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.0,
            max_tokens=400,
        )
        raw = llm_response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"```json|```", "", raw).strip()
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        return jsonify({"status": "error", "message": f"LLM returned invalid JSON: {e}", "raw": raw}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"LLM error: {str(e)}"}), 500

    action = parsed.get("action", "unknown")

    # Step 2: Execute the action
    if action == "add_notice":
        if not parsed.get("title"):
            return jsonify({"status": "error", "message": "Could not extract notice title from command", "parsed": parsed}), 400
        notices = load_notices()
        notice  = {
            "id":         str(uuid.uuid4()),
            "title":      parsed["title"].strip(),
            "body":       parsed.get("body", "").strip(),
            "date":       parsed.get("date") or datetime.now().strftime("%B %Y"),
            "department": parsed.get("department", ""),
            "created_at": datetime.now().isoformat(),
            "created_by": "nlp_command",
        }
        notices.insert(0, notice)
        save_notices(notices)
        return jsonify({
            "status":      "ok",
            "action":      action,
            "notice":      notice,
            "explanation": parsed.get("explanation", ""),
            "confidence":  parsed.get("confidence", 0),
            "message":     f"✅ Notice added: \"{notice['title']}\""
        })

    elif action == "delete_notice":
        keyword = parsed.get("keyword") or parsed.get("title") or ""
        if not keyword:
            return jsonify({"status": "error", "message": "Could not identify which notice to delete", "parsed": parsed}), 400
        notices = load_notices()
        before  = len(notices)
        notices = [n for n in notices if keyword.lower() not in n["title"].lower() and keyword.lower() not in n["body"].lower()]
        removed = before - len(notices)
        if removed == 0:
            return jsonify({"status": "error", "message": f"No notice found matching '{keyword}'", "parsed": parsed}), 404
        save_notices(notices)
        return jsonify({
            "status":      "ok",
            "action":      action,
            "removed":     removed,
            "explanation": parsed.get("explanation", ""),
            "message":     f"🗑️ Deleted {removed} notice(s) matching '{keyword}'"
        })

    elif action == "edit_notice":
        keyword = parsed.get("keyword") or ""
        if not keyword:
            return jsonify({"status": "error", "message": "Could not identify which notice to edit", "parsed": parsed}), 400
        notices = load_notices()
        updated = 0
        for n in notices:
            if keyword.lower() in n["title"].lower() or keyword.lower() in n["body"].lower():
                if parsed.get("title"):  n["title"] = parsed["title"]
                if parsed.get("body"):   n["body"]  = parsed["body"]
                if parsed.get("date"):   n["date"]  = parsed["date"]
                n["updated_at"] = datetime.now().isoformat()
                updated += 1
                break
        if updated == 0:
            return jsonify({"status": "error", "message": f"No notice found matching '{keyword}'"}), 404
        save_notices(notices)
        return jsonify({
            "status":      "ok",
            "action":      action,
            "explanation": parsed.get("explanation", ""),
            "message":     f"✏️ Updated notice matching '{keyword}'"
        })

    elif action == "refresh_sppu":
        try:
            result = subprocess.run(
                [sys.executable, SCRAPER_PATH],
                capture_output=True, text=True, timeout=900,
                cwd=os.path.dirname(SCRAPER_PATH)
            )
            if result.returncode == 0:
                try:
                    from rag_engine import reload_sppu_index
                    reload_sppu_index()
                except Exception:
                    pass
                return jsonify({"status": "ok", "action": action, "message": "🔄 SPPU data refreshed and RAG index reloaded."})
            return jsonify({"status": "error", "message": "Scraper failed", "log": result.stderr[-500:]}), 500
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    else:
        return jsonify({
            "status":      "error",
            "action":      "unknown",
            "explanation": parsed.get("explanation", ""),
            "message":     "❓ Could not understand the command. Try: 'Add a notice about...' or 'Delete the notice about...'"
        }), 422


# ── Student / Visitor Auth ────────────────────────────────────────────────────
@app.route("/student/login", methods=["POST"])
def student_login():
    data     = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    pw_hash  = hashlib.sha256(password.encode()).hexdigest()
    students = load_students()
    user     = students.get(username)
    if user and user.get("password") == pw_hash:
        token = str(uuid.uuid4())
        SESSIONS[token] = {
            "username":   username,
            "role":       user.get("role", "student"),
            "name":       user.get("name", username),
            "department": user.get("department", ""),
            "year":       user.get("year", ""),
        }
        return jsonify({
            "status":     "ok",
            "token":      token,
            "role":       user.get("role", "student"),
            "name":       user.get("name", username),
            "department": user.get("department", ""),
            "year":       user.get("year", ""),
        })
    return jsonify({"status": "error", "message": "Invalid username or password"}), 401

@app.route("/student/logout", methods=["POST"])
def student_logout():
    token = request.headers.get("X-Student-Token", "")
    SESSIONS.pop(token, None)
    return jsonify({"status": "ok"})

@app.route("/student/register", methods=["POST"])
def student_register():
    data       = request.get_json(silent=True) or {}
    username   = data.get("username", "").strip()
    password   = data.get("password", "")
    name       = data.get("name", "").strip()
    department = data.get("department", "").strip()
    year       = data.get("year", "").strip()
    role       = data.get("role", "student").strip()

    if not username or not password or not name:
        return jsonify({"status": "error", "message": "Username, password and name are required"}), 400
    if role not in ("student", "visitor"):
        role = "student"

    students = load_students()
    if username in students:
        return jsonify({"status": "error", "message": "Username already exists"}), 409

    students[username] = {
        "password":   hashlib.sha256(password.encode()).hexdigest(),
        "role":       role,
        "name":       name,
        "department": department,
        "year":       year,
    }
    save_students(students)
    return jsonify({"status": "ok", "message": "Registration successful"})

@app.route("/student/profile", methods=["GET"])
def student_profile():
    token = request.headers.get("X-Student-Token", "")
    session = SESSIONS.get(token)
    if not session or session.get("role") == "admin":
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    return jsonify({"status": "ok", **session})

# Role-aware notices endpoint: students see dept-filtered notices too
@app.route("/notices/public", methods=["GET"])
def public_notices():
    token      = request.headers.get("X-Student-Token", "")
    session    = SESSIONS.get(token)
    department = request.args.get("department", "").strip().lower()
    notices    = load_notices()

    if session and session.get("department") and not department:
        department = session["department"].lower()

    if department:
        # Show notices that match the department or have no department tag
        filtered = [n for n in notices if
                    not n.get("department") or
                    department in n.get("department", "").lower()]
        return jsonify({"notices": filtered, "filtered": True, "department": department})

    return jsonify({"notices": notices, "filtered": False})


# ── Nightly SPPU Auto-Refresh (APScheduler) ───────────────────────────────────
def _nightly_sppu_refresh():
    """Runs automatically every night at 2 AM to keep SPPU data fresh."""
    print(f"[CRON] Starting nightly SPPU refresh at {datetime.now().isoformat()}")
    try:
        result = subprocess.run(
            [sys.executable, SCRAPER_PATH],
            capture_output=True, text=True, timeout=900,
            cwd=os.path.dirname(SCRAPER_PATH)
        )
        if result.returncode == 0:
            try:
                from rag_engine import reload_sppu_index
                reload_sppu_index()
                print(f"[CRON] ✅ Nightly refresh complete. RAG index reloaded.")
            except Exception as e:
                print(f"[CRON] ⚠️ Scraper OK but RAG reload failed: {e}")
        else:
            print(f"[CRON] ❌ Scraper failed:\n{result.stderr[-500:]}")
    except Exception as e:
        print(f"[CRON] ❌ Exception during nightly refresh: {e}")




# ── Events Gallery helpers ────────────────────────────────────────────────────
ALLOWED_IMG_EXTS = {"jpg", "jpeg", "png", "gif", "webp"}
MAX_IMG_BYTES    = 5 * 1024 * 1024   # 5 MB

def load_events():
    if not os.path.exists(EVENTS_FILE):
        return []
    with open(EVENTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_events(events):
    with open(EVENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)

def _save_photos(photos_b64: list) -> list:
    """Decode base64 photo payloads, write to UPLOADS_DIR, return metadata list."""
    saved = []
    for photo in photos_b64:
        raw_name = secure_filename(photo.get("filename", "photo.jpg"))
        ext      = raw_name.rsplit(".", 1)[-1].lower() if "." in raw_name else "jpg"
        if ext not in ALLOWED_IMG_EXTS:
            continue
        try:
            img_bytes = base64.b64decode(photo["data"])
        except Exception:
            continue
        if len(img_bytes) > MAX_IMG_BYTES:
            continue
        unique_name = f"{uuid.uuid4().hex}_{raw_name}"
        with open(os.path.join(UPLOADS_DIR, unique_name), "wb") as fh:
            fh.write(img_bytes)
        saved.append({
            "filename": unique_name,
            "url":      f"/uploads/{unique_name}",
            "mime":     photo.get("mime", "image/jpeg"),
        })
    return saved

# ── Serve uploaded images ──────────────────────────────────────────────────────
@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOADS_DIR, filename)

# ── Public events endpoint ────────────────────────────────────────────────────
@app.route("/events/public", methods=["GET"])
def public_events():
    return jsonify(load_events())

# ── Admin: list all events ─────────────────────────────────────────────────────
@app.route("/admin/events", methods=["GET"])
def admin_get_events():
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    return jsonify(load_events())

# ── Admin: create event + photos ──────────────────────────────────────────────
@app.route("/admin/events", methods=["POST"])
def admin_add_event():
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data        = request.get_json(silent=True) or {}
    title       = (data.get("title") or "").strip()
    if not title:
        return jsonify({"status": "error", "message": "Title is required"}), 400
    saved_photos = _save_photos(data.get("photos", []))
    event = {
        "id":          str(uuid.uuid4()),
        "title":       title,
        "description": (data.get("description") or "").strip(),
        "event_date":  (data.get("event_date") or "").strip(),
        "category":    (data.get("category") or "General").strip(),
        "photos":      saved_photos,
        "created_at":  datetime.now().isoformat(),
        "created_by":  "admin",
    }
    events = load_events()
    events.insert(0, event)
    save_events(events)
    return jsonify({"status": "ok", "event": event}), 201

# ── Admin: edit event metadata ────────────────────────────────────────────────
@app.route("/admin/events/<event_id>", methods=["PUT"])
def admin_edit_event(event_id):
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data   = request.get_json(silent=True) or {}
    events = load_events()
    for ev in events:
        if ev["id"] == event_id:
            ev["title"]       = (data.get("title")       or ev["title"]).strip()
            ev["description"] = (data.get("description") or ev.get("description","")).strip()
            ev["event_date"]  = (data.get("event_date")  or ev.get("event_date","")).strip()
            ev["category"]    = (data.get("category")    or ev.get("category","General")).strip()
            ev["updated_at"]  = datetime.now().isoformat()
            save_events(events)
            return jsonify({"status": "ok", "event": ev})
    return jsonify({"status": "error", "message": "Event not found"}), 404

# ── Admin: add photos to existing event ───────────────────────────────────────
@app.route("/admin/events/<event_id>/photos", methods=["POST"])
def admin_add_photos(event_id):
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    data   = request.get_json(silent=True) or {}
    events = load_events()
    for ev in events:
        if ev["id"] == event_id:
            new_photos        = _save_photos(data.get("photos", []))
            ev["photos"]      = ev.get("photos", []) + new_photos
            ev["updated_at"]  = datetime.now().isoformat()
            save_events(events)
            return jsonify({"status": "ok", "event": ev})
    return jsonify({"status": "error", "message": "Event not found"}), 404

# ── Admin: remove a single photo ──────────────────────────────────────────────
@app.route("/admin/events/<event_id>/photos/<photo_filename>", methods=["DELETE"])
def admin_delete_photo(event_id, photo_filename):
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    events = load_events()
    for ev in events:
        if ev["id"] == event_id:
            ev["photos"]     = [p for p in ev.get("photos", []) if p["filename"] != photo_filename]
            ev["updated_at"] = datetime.now().isoformat()
            save_events(events)
            try:
                os.remove(os.path.join(UPLOADS_DIR, photo_filename))
            except Exception:
                pass
            return jsonify({"status": "ok"})
    return jsonify({"status": "error", "message": "Event not found"}), 404

# ── Admin: delete entire event ────────────────────────────────────────────────
@app.route("/admin/events/<event_id>", methods=["DELETE"])
def admin_delete_event(event_id):
    if not require_auth():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    events   = load_events()
    to_del   = next((ev for ev in events if ev["id"] == event_id), None)
    if not to_del:
        return jsonify({"status": "error", "message": "Event not found"}), 404
    for photo in to_del.get("photos", []):
        try:
            os.remove(os.path.join(UPLOADS_DIR, photo["filename"]))
        except Exception:
            pass
    save_events([ev for ev in events if ev["id"] != event_id])
    return jsonify({"status": "ok"})


# ── Start ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "="*52)
    print("  EduSite Flask Server")
    print("="*52)
    print(f"  Frontend : {FRONTEND_DIR}")
    key_ok = bool(os.getenv("GROQ_API_KEY")) and os.getenv("GROQ_API_KEY") != "your_groq_api_key_here"
    print(f"  Groq key : {'SET' if key_ok else 'NOT SET — open .env and add your key!'}")

    # Start nightly SPPU refresh scheduler
    if SCHEDULER_AVAILABLE:
        scheduler = BackgroundScheduler()
        scheduler.add_job(
            func=_nightly_sppu_refresh,
            trigger="cron",
            hour=2, minute=0,        # runs every night at 2:00 AM
            id="nightly_sppu_refresh",
            replace_existing=True,
        )
        scheduler.start()
        print("  Scheduler: Nightly SPPU refresh at 2:00 AM ✅")
    else:
        print("  Scheduler: APScheduler not installed — run: pip install apscheduler")

    print()
    print("  Open in browser: http://localhost:5000")
    print("  Health check:    http://localhost:5000/health")
    print()
    print("  New endpoints:")
    print("    POST /admin/nlp-command  — Natural language admin commands")
    print("    POST /student/login      — Student/visitor login")
    print("    POST /student/register   — Student/visitor registration")
    print("    GET  /student/profile    — Get logged-in student profile")
    print("    GET  /notices/public     — Role-aware filtered notices")
    print()
    print("  DO NOT open index.html directly as a file.")
    print("="*52 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=True)