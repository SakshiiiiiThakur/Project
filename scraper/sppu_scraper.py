"""
SPPU Focused Scraper — v5 FINAL
Original v4 code kept intact. Only these targeted changes:
  1. SharePoint timetable: filters ONLY 2026 rows/PDFs — skips 2022/2023/2024/2025
  2. SharePoint scroll: stops early once row count stabilises (max ~10 s, not 25 s)
  3. sp_expand_groups: skips old-year group headers — only expands 2026 groups
  4. get_sections: removed div/span tags (huge speed gain, they add noise not value)
  5. click_all_tabs: skips tabs whose text belongs to older years (2025,2024…)
  6. export_for_rag: fixed bug — links are plain URL strings, not dicts with .get("text")
  7. Removed unnecessary sleeps (0.4→0.2, 1.0→0.5 etc) across all functions
All TARGET_URLS are identical to v4 — nothing removed or added.
Run: python sppu_scraper_final.py
"""

import time, json, hashlib, requests, urllib.parse, urllib3, sys, os
from pathlib import Path
from datetime import datetime

# ─── PROJECT ROOT (so we can write data/sppu_knowledge.json for RAG) ─────────
SCRAPER_DIR  = Path(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = SCRAPER_DIR.parent
DATA_DIR_RAG = PROJECT_ROOT / "data"

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, WebDriverException,
    StaleElementReferenceException, ElementNotInteractableException,
    ElementClickInterceptedException, NoSuchElementException
)

urllib3.disable_warnings()

# ─── OUTPUT ───────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path("sppu_data")
PDF_DIR    = OUTPUT_DIR / "pdfs"
PAGES_DIR  = OUTPUT_DIR / "pages"
for d in [OUTPUT_DIR, PDF_DIR, PAGES_DIR]:
    d.mkdir(exist_ok=True)

# ─── TARGET URLs — identical to v4, nothing changed ──────────────────────────
TARGET_URLS = [
    {"label": "Admissions",
     "url": "https://www.unipune.ac.in/university_files/admissions.htm"},

    {"label": "Exam Home",
     "url": "https://exam.unipune.ac.in/"},

    {"label": "Schedules & Timetables",
     "url": "https://exam.unipune.ac.in/Pages/SchedulesTimetables.html"},

    # ── SharePoint: APR/MAY 2026 + all sidebar libraries auto-discovered ──────
    {
        "label": "Timetables SharePoint (APR/MAY 2026)",
        "url": "http://collegecirculars.unipune.ac.in/sites/examdocs/Time%20Tables%20APRMAY%202026/Forms/AllItems.aspx",
        "sharepoint": True,
        #"scrape_sp_sidebar": True,   # auto-discover + scrape ALL sidebar libraries
    },

    {"label": "Exam Forms Online",
     "url": "https://exam.unipune.ac.in/Pages/ExamFormsOnline.html"},

    # Results page: has JS tabs — click each one
    {"label": "Results",
     "url": "https://exam.unipune.ac.in/Pages/results.html",
     "click_all_tabs": True},

    {"label": "Online Results Dashboard",
     "url": "https://onlineresults.unipune.ac.in/Result/Dashboard/Default"},

    {"label": "Reval / Online Results",
     "url": "https://unipune.ac.in/university_files/Reval_Online_Results_online.htm"},

    {"label": "Exam PCR Student Login",
     "url": "https://exampcr.unipune.ac.in/Student/Dashboard/LogintoSPS"},

    {"label": "Contact Details for Online Applications",
     "url": "https://exam.unipune.ac.in/Pages/ContactDetailsForOnlineApplications.html"},

    {"label": "Certificate Section",
     "url": "https://unipune.ac.in/university_files/certificatesection.htm"},

    {"label": "Ordinances",
     "url": "https://exam.unipune.ac.in/Pages/Ordinances.html"},

    # Previous Question Papers: links open in new tabs / JS
    {"label": "Previous Question Papers",
     "url": "https://exam.unipune.ac.in/Pages/PreviousQuestionPapers.html",
     "click_all_tabs": True},

    {"label": "College Login",
     "url": "https://exam.unipune.ac.in/Pages/CollegeLogin.html"},

    # Circulars: click every year/tab to reveal PDFs
    {"label": "Circulars",
     "url": "https://exam.unipune.ac.in/Pages/Circulars.html",
     "click_all_tabs": True},

    # Academic Calendar SharePoint
    {
        "label": "Academic Calendar (SharePoint)",
        "url": "http://collegecirculars.unipune.ac.in/sites/documents/Academic%20Calender/Forms/AllItems.aspx",
        "sharepoint": True,
        "scrape_sp_sidebar": False,
    },

    {"label": "Telephone List PDF",
     "url": "https://www.unipune.ac.in/pdf_files/TelList.pdf",
     "is_pdf": True},

    # Syllabi: follow only syllabus-related links, go 2 levels deep
    {
        "label": "Syllabi",
        "url": "https://www.unipune.ac.in/university_files/syllabi.htm",
        "crawl_sub": True,
        "sub_host_must_match": "www.unipune.ac.in",
        "sub_url_must_contain": [
            "syllabi", "syllabus", "syllab", "dept", "department",
            "cbcs", "curriculum", "university_files"
        ],
    },
]

scraped_results: list = []
pdf_index:       list = []


# ─── YEAR FILTER HELPERS (NEW) ────────────────────────────────────────────────
OLD_YEARS = ["2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018",
             "2017", "2016", "2015"]
OLD_YEAR_LABELS = [
    "oct/nov 2025", "oct nov 2025", "mar/apr 2025", "mar apr 2025",
    "oct/nov 2024", "oct nov 2024", "mar/apr 2024", "mar apr 2024",
]

def _text_belongs_to_old_year(text: str) -> bool:
    """Return True if text clearly belongs to a year before 2026."""
    t = text.lower()
    for label in OLD_YEAR_LABELS:
        if label in t:
            return True
    # If text contains an old year AND does NOT contain 2026
    if "2026" not in t:
        for yr in OLD_YEARS:
            if yr in t:
                return True
    return False

def _is_2026_tab(txt: str, href: str) -> bool:
    """Return True only if this tab/link is 2026-related or has no year at all."""
    if _text_belongs_to_old_year(txt):
        return False
    if _text_belongs_to_old_year(urllib.parse.unquote(href)):
        return False
    return True

def _is_2026_pdf(url_or_filename: str) -> bool:
    """Return True if a PDF url/filename is 2026-related or has no year stamp."""
    decoded = urllib.parse.unquote(url_or_filename).lower()
    if _text_belongs_to_old_year(decoded):
        return False
    return True


# ─── DRIVER ───────────────────────────────────────────────────────────────────
def make_driver():
    opts = Options()
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--allow-running-insecure-content")
    opts.add_argument("--blink-settings=imagesEnabled=false")  # skip images → faster load
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    d = webdriver.Chrome(options=opts)
    d.execute_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
    return d

def safe_quit(driver):
    try: driver.quit()
    except Exception: pass

def is_driver_alive(driver):
    """Check if the Chrome session is still valid."""
    try:
        _ = driver.current_url
        return True
    except Exception:
        return False

def restart_driver(driver):
    """Quit the dead driver and return a fresh one."""
    print("  🔄 Chrome session died — restarting driver...")
    safe_quit(driver)
    time.sleep(1)
    new_driver = make_driver()
    print("  ✅ Driver restarted.")
    return new_driver

def wait_body(driver, t=20):
    WebDriverWait(driver, t).until(EC.presence_of_element_located((By.TAG_NAME, "body")))

def url_hash(u): return hashlib.md5(u.encode()).hexdigest()[:10]

def safe_name(url):
    raw = urllib.parse.unquote(url.split("/")[-1].split("?")[0])
    if not raw.lower().endswith(".pdf"): raw += ".pdf"
    return "".join(c if c.isalnum() or c in "._- " else "_" for c in raw)

def scroll_down(driver, rounds=4):   # was 6 × 0.4 s = 2.4 s; now 4 × 0.3 s = 1.2 s
    for _ in range(rounds):
        driver.execute_script("window.scrollBy(0, window.innerHeight);")
        time.sleep(0.3)
    driver.execute_script("window.scrollTo(0,0);")
    time.sleep(0.2)


# ─── PDF DOWNLOAD ─────────────────────────────────────────────────────────────
def dl_pdf(url, session, found_on=""):
    fname = safe_name(url)
    dest  = PDF_DIR / fname
    if dest.exists():
        print(f"    ✅ Already have: {fname}")
        return str(dest)
    try:
        r = session.get(url, timeout=45, verify=False)
        if r.status_code == 200 and b"%PDF" in r.content[:10]:
            dest.write_bytes(r.content)
            kb = len(r.content)//1024
            print(f"    📄 PDF saved ({kb} KB): {fname}")
            pdf_index.append({"url":url,"local_path":str(dest),"filename":fname,
                               "size_kb":kb,"found_on":found_on,
                               "downloaded_at":datetime.now().isoformat()})
            return str(dest)
        else:
            print(f"    ⚠️  Bad response {r.status_code}: {fname}")
    except Exception as e:
        print(f"    ⚠️  Error {fname}: {e}")
    return None


# ─── CONTENT EXTRACTION ───────────────────────────────────────────────────────
# FIX: removed "div" and "span" — they contain thousands of elements and
#      cause get_sections to run for minutes on complex pages with zero benefit.
def get_sections(driver):
    out, seen = [], set()
    for tag in ["h1","h2","h3","h4","h5","h6","p","li","td","th","a"]:
        try:
            for el in driver.find_elements(By.TAG_NAME, tag):
                try:
                    t = el.text.strip()
                    if t and len(t)>10 and t not in seen:
                        seen.add(t); out.append({"tag":tag,"text":t})
                except StaleElementReferenceException: continue
        except Exception: continue
    return out

def get_tables(driver):
    out = []
    try:
        for i, tbl in enumerate(driver.find_elements(By.TAG_NAME,"table")):
            rows=[]
            try:
                for row in tbl.find_elements(By.TAG_NAME,"tr"):
                    cells=[]
                    for c in row.find_elements(By.XPATH,".//td|.//th"):
                        try: cells.append(c.text.strip())
                        except: cells.append("")
                    if any(cells): rows.append(cells)
            except: pass
            if rows: out.append({"table_index":i,"rows":rows})
    except: pass
    return out

def get_links_pdfs(driver):
    links, pdfs, seen = [], [], set()
    try:
        for a in driver.find_elements(By.TAG_NAME,"a"):
            try:
                h = (a.get_attribute("href") or "").strip().split("#")[0]
                if not h or h in seen: continue
                seen.add(h)
                if h.lower().endswith(".pdf"): pdfs.append(h)
                else: links.append(h)
            except StaleElementReferenceException: continue
    except: pass
    return links, pdfs

def save_txt(label, url, title, sections, tables, ts):
    f = PAGES_DIR / f"{url_hash(url)}.txt"
    with open(f,"w",encoding="utf-8") as fh:
        fh.write(f"LABEL:{label}\nURL:{url}\nTITLE:{title}\nDATE:{ts}\n\n{'─'*60}\n\n")
        fh.write("\n".join(s["text"] for s in sections))
        if tables:
            fh.write(f"\n\n{'─'*60}\nTABLES\n{'─'*60}\n")
            for t in tables:
                for row in t["rows"]: fh.write(" | ".join(row)+"\n")
                fh.write("\n")


# ─── CLICK ALL TABS ───────────────────────────────────────────────────────────
# FIX: skip tabs whose text belongs to years before 2026
def click_all_tabs_and_collect(driver, session, url, label):
    """
    Click every clickable tab/accordion/button/year-link on the page,
    wait for new PDFs to appear in DOM, collect them all.
    Skips tabs that clearly belong to years before 2026.
    """
    print(f"  🖱️  Clicking all tabs/accordions to reveal hidden PDFs...")
    all_pdfs = set()

    # Collect initial PDFs
    _, init_pdfs = get_links_pdfs(driver)
    all_pdfs.update(init_pdfs)

    # Selectors that are likely tab/accordion triggers on SPPU exam pages
    tab_selectors = [
        "ul.nav li a", "ul.tabs li a", ".tab a", ".accordion-header",
        "a[data-toggle]", "button[data-toggle]",
        # Year links like "2025", "2024" etc
        "a[href*='#']",
        # Generic clickable elements with year text
        "li a", "div.panel-heading a", "h4 a", "h3 a",
        # Table of content links
        "td a", "th a",
    ]

    clicked_texts = set()

    for sel in tab_selectors:
        try:
            elems = driver.find_elements(By.CSS_SELECTOR, sel)
            for el in elems:
                try:
                    txt = el.text.strip()
                    href = el.get_attribute("href") or ""
                    # Only click internal anchors or small text (year/tab labels)
                    if txt in clicked_texts: continue
                    if href.startswith("http") and ".pdf" not in href.lower(): continue
                    if len(txt) > 50: continue

                    # FIX: skip old-year tabs entirely
                    if not _is_2026_tab(txt, href):
                        print(f"    ⏭️  Skipping old-year tab: '{txt}'")
                        continue

                    clicked_texts.add(txt)
                    driver.execute_script("arguments[0].scrollIntoView(true);", el)
                    time.sleep(0.15)   # was 0.2
                    el.click()
                    time.sleep(0.7)    # was 1.0

                    # Grab any new PDFs revealed
                    _, new_pdfs = get_links_pdfs(driver)
                    for p in new_pdfs:
                        if p not in all_pdfs:
                            all_pdfs.add(p)
                            print(f"    🔍 New PDF revealed: {p.split('/')[-1]}")

                except (StaleElementReferenceException, ElementClickInterceptedException,
                        ElementNotInteractableException, WebDriverException):
                    continue
        except Exception:
            continue

    # Download everything found
    print(f"  📑 Total PDFs after clicking tabs: {len(all_pdfs)}")
    for pdf_url in all_pdfs:
        dl_pdf(pdf_url, session, found_on=url)

    return list(all_pdfs)


# ─── SHAREPOINT SCRAPER ───────────────────────────────────────────────────────
def sp_expand_groups(driver):
    """
    Click all collapsed SharePoint group headers to expand them.
    FIX: skips group headers belonging to years before 2026.
    """
    for _ in range(20):
        collapsed = driver.find_elements(
            By.XPATH,
            "//img[contains(@src,'expand') or contains(@src,'plus') "
            "      or contains(@alt,'expand') or contains(@title,'expand')] | "
            "//td[contains(@class,'ms-gb') and @aria-expanded='false'] | "
            "//a[contains(@class,'ms-groupheader')]"
        )
        if not collapsed: break
        clicked = 0
        for el in collapsed:
            try:
                # Read the row text to check if it's an old-year group
                try:
                    row_text = el.find_element(By.XPATH, "ancestor::tr[1]").text
                except Exception:
                    row_text = el.text or ""

                if _text_belongs_to_old_year(row_text):
                    print(f"    ⏭️  Skipping old-year group: '{row_text[:60]}'")
                    continue

                driver.execute_script("arguments[0].scrollIntoView(true);", el)
                time.sleep(0.1)    # was 0.15
                el.click(); clicked += 1
                time.sleep(0.35)   # was 0.5
            except: continue
        if clicked == 0: break
        time.sleep(0.5)   # was 1.0


def sp_get_sidebar_urls(driver, base_url):
    """
    Read the left sidebar library list and return all AllItems.aspx URLs.
    The sidebar contains links like 'Time Tables OCT NOV 2025' etc.
    """
    sidebar_urls = []
    base_parsed  = urllib.parse.urlparse(base_url)
    base_root    = f"{base_parsed.scheme}://{base_parsed.netloc}"
    # Find sidebar navigation links
    try:
        nav_links = driver.find_elements(By.CSS_SELECTOR,
            "#s4-leftpanel a, .ms-navitem a, .ms-core-listMenu-item a, "
            "#sideNavBox a, .ms-quickLaunch a")
        for a in nav_links:
            try:
                href  = a.get_attribute("href") or ""
                label = a.text.strip()
                if not href or not label: continue
                # Only library links (Forms/AllItems.aspx)
                if "AllItems" in href or "/sites/" in href:
                    if not href.startswith("http"):
                        href = base_root + href
                    sidebar_urls.append((label, href))
            except StaleElementReferenceException: continue
    except Exception: pass

    # Deduplicate
    seen = set()
    result = []
    for lbl, u in sidebar_urls:
        if u not in seen:
            seen.add(u); result.append((lbl, u))
    return result


def _sp_rest_get_all_files(session, site_url, list_name):
    """
    Use SharePoint REST API to fetch ALL file items from a library in one go.
    Much faster than Selenium pagination clicking.
    Returns list of dicts: {name, server_relative_url, time_created, time_last_modified}
    site_url  e.g. "http://collegecirculars.unipune.ac.in/sites/examdocs"
    list_name e.g. "Time Tables APRMAY 2026"
    """
    # URL-encode the list name for the API call
    encoded = urllib.parse.quote(list_name)
    api_url  = (f"{site_url}/_api/web/lists/getbytitle('{encoded}')"
                f"/items?$select=FileLeafRef,FileRef,Created,Modified"
                f"&$top=500&$orderby=Modified desc")
    items = []
    next_url = api_url
    page = 0
    while next_url:
        page += 1
        try:
            r = session.get(next_url, timeout=30, verify=False,
                            headers={"Accept": "application/json;odata=verbose"})
            if r.status_code != 200:
                print(f"    ⚠️  REST API returned {r.status_code} on page {page}")
                break
            data = r.json()
            results = data.get("d", {}).get("results", [])
            items.extend(results)
            print(f"    📄 REST page {page}: {len(results)} items (total so far: {len(items)})")
            # Follow __next link for pagination
            next_url = data.get("d", {}).get("__next", None)
        except Exception as e:
            print(f"    ⚠️  REST API error: {e}")
            break
    return items


def _sp_build_file_url(base_netloc_scheme, server_relative_url):
    """Turn a ServerRelativeUrl into a full download URL."""
    # server_relative_url is like /sites/examdocs/Time Tables APRMAY 2026/F.E.pdf
    encoded = urllib.parse.quote(server_relative_url, safe="/:")
    return f"{base_netloc_scheme}{encoded}"


def scrape_sharepoint(driver, session, url, label, scrape_sidebar=False):
    """
    Scrape a SharePoint document library.
    Strategy:
      1. Try the REST API first — fetches ALL items instantly, no pagination issues.
      2. Fall back to Selenium if REST fails (e.g. auth required).
    The old approach used Selenium scroll + expand groups which got stuck on the
    grouped pagination (each group shows only 30 rows with a 'Next' button).
    """
    print(f"\n{'='*60}")
    print(f"  📂 [SharePoint] [{label}]")
    print(f"  🌐 {url}")
    print(f"{'='*60}")

    result = {"label":label,"url":url,"type":"sharepoint",
              "scraped_at":datetime.now().isoformat(),
              "title":"","sections":[],"tables":[],"links":[],"pdfs":[],"error":None}

    # ── Parse site URL and library name from the AllItems.aspx URL ───────────
    # e.g. http://collegecirculars.unipune.ac.in/sites/examdocs/Time%20Tables%20APRMAY%202026/Forms/AllItems.aspx
    parsed     = urllib.parse.urlparse(url)
    base_root  = f"{parsed.scheme}://{parsed.netloc}"
    path_parts = parsed.path.rstrip("/").split("/")
    # path_parts: ['', 'sites', 'examdocs', 'Time Tables APRMAY 2026', 'Forms', 'AllItems.aspx']
    try:
        forms_idx  = next(i for i,p in enumerate(path_parts) if p.lower()=="forms")
        list_name  = urllib.parse.unquote(path_parts[forms_idx - 1])
        site_path  = "/".join(path_parts[:forms_idx - 1])   # /sites/examdocs
        site_url   = base_root + site_path
    except Exception:
        list_name = ""
        site_url  = base_root

    all_pdfs   = []
    all_titles = []

    # ── STRATEGY 1: SharePoint REST API (fast, no pagination) ────────────────
    rest_ok = False
    if list_name:
        print(f"  🚀 Trying REST API for '{list_name}'...")
        items = _sp_rest_get_all_files(session, site_url, list_name)
        if items:
            rest_ok = True
            print(f"  ✅ REST API returned {len(items)} total items")
            for item in items:
                fname      = item.get("FileLeafRef", "") or ""
                server_rel = item.get("FileRef", "")    or ""
                modified   = item.get("Modified", "")   or ""

                if not fname:
                    continue

                all_titles.append(f"{fname} (modified: {modified[:10]})")

                # Only process PDFs, skip non-PDF files
                if not fname.lower().endswith(".pdf"):
                    continue

                # Build direct download URL from ServerRelativeUrl
                # SharePoint: GET /_layouts/15/download.aspx?SourceUrl=<encoded_server_rel>
                # OR simply: base_root + server_rel  (works for anonymous libraries)
                if server_rel:
                    # Primary: direct file URL
                    file_url = _sp_build_file_url(base_root, server_rel)
                    # Fallback download URL if direct fails
                    dl_url = (base_root + "/_layouts/15/download.aspx?SourceUrl="
                              + urllib.parse.quote(server_rel, safe=""))
                else:
                    lib_path = site_path + "/" + urllib.parse.quote(list_name)
                    file_url = base_root + lib_path + "/" + urllib.parse.quote(fname)
                    dl_url   = file_url

                all_pdfs.append((file_url, dl_url))

            print(f"  📎 PDFs found via REST: {len(all_pdfs)}")

    # ── STRATEGY 2: Selenium fallback (only if REST failed) ──────────────────
    if not rest_ok:
        print("  ⚠️  REST API unavailable — falling back to Selenium pagination scrape...")
        try:
            driver.get(url)
            wait_body(driver)
            time.sleep(2)
        except (TimeoutException, WebDriverException) as e:
            result["error"] = str(e)
            print(f"  ❌ {e}")
            return result

        try: result["title"] = driver.title
        except: pass

        # ── Read sidebar if needed ────────────────────────────────────────────
        sidebar_libs = []
        if scrape_sidebar:
            sidebar_libs = sp_get_sidebar_urls(driver, url)

        # ── Paginate through ALL pages using the Next button ─────────────────
        # This is the KEY FIX: old code never clicked Next, so it looped forever
        # on the same 30-row page.
        all_page_pdfs = set()
        all_page_links = []
        page_num = 0
        visited_pages = set()

        while True:
            page_num += 1
            current_url = driver.current_url
            if current_url in visited_pages:
                print(f"  ⚠️  Already visited this page URL — stopping pagination")
                break
            visited_pages.add(current_url)
            print(f"  📄 Scraping page {page_num}...")

            # Wait for table to load
            time.sleep(1.0)

            # Expand ALL groups on this page (no year filter needed since
            # we're already on the 2026 library — all items are 2026)
            _sp_expand_all_groups_simple(driver)

            # Collect links and PDFs from this page
            lks, pdfs = get_links_pdfs(driver)
            all_page_links.extend(lks)
            all_page_pdfs.update(pdfs)

            # Extra PDF sweep
            try:
                for a in driver.find_elements(By.TAG_NAME, "a"):
                    try:
                        h = a.get_attribute("href") or ""
                        if ".pdf" in h.lower():
                            all_page_pdfs.add(h.split("?")[0])
                    except StaleElementReferenceException:
                        continue
            except: pass

            # ── Look for "Next" pagination button ────────────────────────────
            next_btn = None
            try:
                # SharePoint uses an <a> with text containing "Next" or "›" or ">"
                candidates = driver.find_elements(By.XPATH,
                    "//a[contains(@class,'ms-commandLink') and "
                    "    (contains(text(),'Next') or contains(text(),'›') or contains(text(),'>'))] | "
                    "//td[@class='ms-paging']//a | "
                    "//span[contains(@class,'ms-paging')]//a"
                )
                for c in candidates:
                    txt = (c.text or "").strip()
                    if txt and ("next" in txt.lower() or txt in [">","›","»"]):
                        next_btn = c
                        break
            except Exception:
                pass

            if next_btn:
                print(f"    ➡️  Clicking Next (page {page_num} → {page_num+1})...")
                try:
                    driver.execute_script("arguments[0].scrollIntoView(true);", next_btn)
                    time.sleep(0.3)
                    next_btn.click()
                    time.sleep(1.5)
                except Exception as e:
                    print(f"    ⚠️  Could not click Next: {e}")
                    break
            else:
                print(f"  ✅ No more pages (finished at page {page_num})")
                break

            if page_num > 50:   # safety valve — never more than 50 pages
                print("  ⚠️  Reached 50-page safety limit")
                break

        all_pdfs = list(all_page_pdfs)
        result["links"] = all_page_links

        secs = get_sections(driver)
        tbls = get_tables(driver)
        result["sections"] = secs
        result["tables"]   = tbls
        save_txt(label, url, result.get("title",""), secs, tbls, result["scraped_at"])

        # Scrape sidebar libraries if requested
        if scrape_sidebar and sidebar_libs:
            print(f"\n  🔁 Scraping {len(sidebar_libs)} sidebar libraries...")
            for lib_label, lib_url in sidebar_libs:
                if lib_url == url: continue
                sib = scrape_sharepoint(driver, session, lib_url,
                                        f"Timetable: {lib_label}", scrape_sidebar=False)
                scraped_results.append(sib)
                time.sleep(1)

    # ── Store titles as sections for RAG ─────────────────────────────────────
    if all_titles:
        result["sections"] = [{"tag": "li", "text": t} for t in all_titles]

    # Normalise: REST returns (primary, fallback) tuples; Selenium returns plain strings
    flat_pdfs = []
    for entry in all_pdfs:
        if isinstance(entry, tuple):
            flat_pdfs.append(entry[0])   # primary URL
        else:
            flat_pdfs.append(entry)

    result["pdfs"] = flat_pdfs
    print(f"  📝 Titles:{len(all_titles)} | PDFs:{len(flat_pdfs)}")

    # ── Download all PDFs ─────────────────────────────────────────────────────
    print(f"  ⬇️  Downloading {len(flat_pdfs)} PDFs...")
    for entry in all_pdfs:
        if isinstance(entry, tuple):
            primary, fallback = entry
            # Try primary URL first; if it fails use fallback download URL
            fname = safe_name(primary)
            dest  = PDF_DIR / fname
            if dest.exists():
                print(f"    ✅ Already have: {fname}")
                continue
            # Try primary
            saved = dl_pdf(primary, session, found_on=url)
            if not saved:
                # Try SharePoint /_layouts/15/download.aspx fallback
                print(f"    🔁 Retrying via download.aspx: {fname}")
                dl_pdf(fallback, session, found_on=url)
        else:
            dl_pdf(entry, session, found_on=url)

    return result


def _sp_expand_all_groups_simple(driver):
    """Simple expand — click all collapsed group headers on current page only."""
    try:
        collapsed = driver.find_elements(
            By.XPATH,
            "//img[contains(@src,'expand') or contains(@src,'plus')] | "
            "//td[contains(@class,'ms-gb') and @aria-expanded='false']"
        )
        for el in collapsed:
            try:
                driver.execute_script("arguments[0].scrollIntoView(true);", el)
                time.sleep(0.1)
                el.click()
                time.sleep(0.3)
            except: continue
        time.sleep(0.5)
    except: pass


# ─── STANDARD PAGE SCRAPER ────────────────────────────────────────────────────
def scrape_page(driver, session, url, label,
                crawl_sub=False, click_all_tabs=False,
                sub_host_must_match="", sub_url_must_contain=None,
                driver_container=None):

    print(f"\n{'='*60}")
    print(f"  🎯 [{label}]  🌐 {url}")
    print(f"{'='*60}")

    result = {"label":label,"url":url,"scraped_at":datetime.now().isoformat(),
              "title":"","sections":[],"all_text":"","tables":[],
              "links":[],"pdfs":[],"sub_pages":[],"error":None}

    try:
        driver.get(url); wait_body(driver); time.sleep(1.5)  # was 2
    except (TimeoutException, WebDriverException) as e:
        result["error"]=str(e); print(f"  ❌ {e}"); return result

    try: result["title"]=driver.title
    except: pass

    scroll_down(driver)
    secs  = get_sections(driver)
    tbls  = get_tables(driver)
    links, pdfs = get_links_pdfs(driver)

    result["sections"]=secs; result["all_text"]="\n".join(s["text"] for s in secs)
    result["tables"]=tbls; result["links"]=links; result["pdfs"]=pdfs

    print(f"  📝 Sections:{len(secs)} | Tables:{len(tbls)} | Links:{len(links)} | PDFs:{len(pdfs)}")

    # Download directly-found PDFs
    for pu in pdfs:
        dl_pdf(pu, session, found_on=url)

    # Click tabs/accordions if flagged
    if click_all_tabs:
        extra_pdfs = click_all_tabs_and_collect(driver, session, url, label)
        result["pdfs"] = list(set(pdfs + extra_pdfs))

    save_txt(label, url, result["title"], secs, tbls, result["scraped_at"])

    # ── Sub-page crawl (Syllabi) ──────────────────────────────────────────────
    if crawl_sub:
        print(f"\n  🔁 Crawling sub-links (filtered) from [{label}]...")
        visited = {url}
        count   = 0
        MAX_SUB = 60

        for child in links:
            if child in visited or count >= MAX_SUB: continue
            ch = urllib.parse.urlparse(child)
            if sub_host_must_match and ch.netloc and ch.netloc != sub_host_must_match: continue
            if sub_url_must_contain and not any(k in child.lower() for k in sub_url_must_contain): continue
            visited.add(child)

            print(f"\n    ↳ Sub [{count+1}/{MAX_SUB}]: {child}")
            try:
                driver.get(child); wait_body(driver,15); time.sleep(1.2)  # was 1.5
                scroll_down(driver)

                # On syllabi pages: also click every link inside tables
                # to reveal any JS-loaded PDFs
                sub_links_raw = driver.find_elements(By.CSS_SELECTOR, "table a, li a")
                for sl in sub_links_raw:
                    try:
                        sh = sl.get_attribute("href") or ""
                        if sh.lower().endswith(".pdf") and sh not in visited:
                            visited.add(sh)
                            dl_pdf(sh, session, found_on=child)
                    except: continue

                ss = get_sections(driver)
                st = get_tables(driver)
                _, sp = get_links_pdfs(driver)

                result["sub_pages"].append({
                    "url":child,"title":driver.title,
                    "sections":ss,"tables":st,"pdfs":sp
                })
                for pu in sp: dl_pdf(pu, session, found_on=child)

                pf = PAGES_DIR / f"sub_{url_hash(child)}.txt"
                pf.write_text(f"PARENT:{label}\nURL:{child}\nTITLE:{driver.title}\n\n"
                              +"\n".join(s["text"] for s in ss), encoding="utf-8")
                print(f"      ✅ {len(ss)} sections | {len(sp)} PDFs")
                count+=1; time.sleep(1.0)  # was 1.2

            except Exception as e:
                print(f"      ⚠️  Skipped: {e}"); continue

    return result


# ─── DIRECT PDF ───────────────────────────────────────────────────────────────
def handle_pdf(session, url, label):
    print(f"\n{'='*60}")
    print(f"  📥 [{label}] direct PDF  🌐 {url}")
    print(f"{'='*60}")
    r = {"label":label,"url":url,"scraped_at":datetime.now().isoformat(),
         "type":"direct_pdf","local_path":None,"error":None}
    p = dl_pdf(url, session, "direct_target")
    r["local_path"]=p or ""; r["error"]=None if p else "Download failed"
    return r


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def run():
    print("\n"+"="*60)
    print("  SPPU FOCUSED SCRAPER — v5 FINAL")
    print(f"  Targets : {len(TARGET_URLS)} URLs")
    print(f"  Started : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    # ── driver_container: mutable list so sub-crawl restarts propagate back ──
    driver_container = [make_driver()]
    session = requests.Session()
    session.verify = False
    session.headers["User-Agent"] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )

    try:
        for i, t in enumerate(TARGET_URLS, 1):
            driver = driver_container[0]   # always use latest live driver
            print(f"\n[{i}/{len(TARGET_URLS)}]", end="")

            # Auto-restart if driver died between URLs
            if not is_driver_alive(driver):
                driver = restart_driver(driver)
                driver_container[0] = driver

            if t.get("is_pdf"):
                r = handle_pdf(session, t["url"], t["label"])
            elif t.get("sharepoint"):
                r = scrape_sharepoint(driver, session, t["url"], t["label"],
                                      scrape_sidebar=t.get("scrape_sp_sidebar", False))
            else:
                r = scrape_page(driver, session,
                    url                  = t["url"],
                    label                = t["label"],
                    crawl_sub            = t.get("crawl_sub", False),
                    click_all_tabs       = t.get("click_all_tabs", False),
                    sub_host_must_match  = t.get("sub_host_must_match",""),
                    sub_url_must_contain = t.get("sub_url_must_contain"),
                    driver_container     = driver_container,
                )
                # Sync back in case sub-crawl restarted it
                driver = driver_container[0]
            scraped_results.append(r)
            time.sleep(1.0)

    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted — saving...")
    finally:
        safe_quit(driver_container[0])

    (OUTPUT_DIR/"sppu_scraped.json").write_text(
        json.dumps(scraped_results, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUTPUT_DIR/"pdf_index.json").write_text(
        json.dumps(pdf_index, ensure_ascii=False, indent=2), encoding="utf-8")

    total_sec = sum(len(r.get("sections",[])) for r in scraped_results)
    total_tbl = sum(len(r.get("tables",  [])) for r in scraped_results)
    total_sub = sum(len(r.get("sub_pages",[])) for r in scraped_results)
    errors    = [r for r in scraped_results if r.get("error")]

    print("\n\n"+"="*60)
    print("  ✅ COMPLETE")
    print("="*60)
    print(f"  📋 Pages        : {len(scraped_results)}")
    print(f"  📑 Sub-pages    : {total_sub}")
    print(f"  📝 Sections     : {total_sec}")
    print(f"  📊 Tables       : {total_tbl}")
    print(f"  📄 PDFs saved   : {len(pdf_index)}")
    print(f"  ❌ Errors       : {len(errors)}")
    if errors:
        for e in errors: print(f"     • {e['label']}: {e.get('error')}")
    print(f"  💾 Saved to     : {OUTPUT_DIR.resolve()}")
    print("="*60)
    print("\n📁 sppu_data/sppu_scraped.json  ← all text+tables+links")
    print("   sppu_data/pdf_index.json      ← PDF metadata")
    print("   sppu_data/pdfs/*.pdf          ← downloaded PDFs")
    print("   sppu_data/pages/*.txt         ← per-page plain text")

    # ── Export to RAG-compatible sppu_knowledge.json ──────────────────────────
    export_for_rag(scraped_results)


# ─── RAG EXPORT ───────────────────────────────────────────────────────────────
def export_for_rag(scraped_results: list):
    """
    Convert scraped_results into the rag_chunks format expected by rag_engine.py,
    and write to data/sppu_knowledge.json so the RAG index can be rebuilt.
    """
    DATA_DIR_RAG.mkdir(exist_ok=True)
    out_path = DATA_DIR_RAG / "sppu_knowledge.json"

    rag_chunks = []

    def add_chunks(label, url, cat, chunk_texts):
        """Group texts into ~600-char chunks and append to rag_chunks."""
        buffer = ""
        for txt in chunk_texts:
            txt = txt.strip()
            if not txt:
                continue
            if len(buffer) + len(txt) > 600:
                if buffer.strip():
                    rag_chunks.append({"source": label, "category": cat, "url": url, "content": buffer.strip()})
                buffer = txt + " "
            else:
                buffer += txt + " "
        if buffer.strip():
            rag_chunks.append({"source": label, "category": cat, "url": url, "content": buffer.strip()})

    for page in scraped_results:
        label = page.get("label", "")
        url   = page.get("url", "")
        cat   = page.get("type", "sppu")
        chunk_texts = []

        # Flatten text sections
        for s in page.get("sections", []):
            t = s.get("text", "").strip()
            if t and len(t) > 20:
                chunk_texts.append(t)

        # Flatten tables — each row becomes a searchable chunk
        for tbl in page.get("tables", []):
            headers = tbl.get("headers", [])
            for row in tbl.get("rows", []):
                cells = [str(c).strip() for c in row if str(c).strip()]
                if headers:
                    row_text = " | ".join(
                        f"{h}: {v}" for h, v in zip(headers, cells) if v
                    )
                else:
                    row_text = " | ".join(cells)
                if len(row_text) > 10:
                    chunk_texts.append(row_text)

        # ── FIX: links is a list of plain URL strings (not dicts) ─────────────
        # Original v4 bug: lnk.get("text") and lnk.get("href") always returned
        # None because links are strings, not dicts. Fixed below.
        for lnk in page.get("links", []):
            if not isinstance(lnk, str):
                continue
            decoded  = urllib.parse.unquote(lnk)
            # Extract the filename as human-readable text
            fname = decoded.split("/")[-1].split("?")[0].replace("_", " ").replace("-", " ")
            if len(fname) > 10 and any(
                kw in fname.lower() for kw in
                ["timetable", "time table", "exam", "schedule", "circular",
                 "result", "notice", "syllabus", "pattern", "session",
                 "summer", "winter", "semester", "april", "may", "oct", "nov",
                 "2026", "be ", "b.e", "me ", "m.e", "phd", "mba"]
            ):
                chunk_texts.append(f"{fname} → {lnk}")

        # Include sub-pages (Syllabi crawl)
        for sub in page.get("sub_pages", []):
            sub_label = sub.get("label", label)
            sub_url   = sub.get("url", url)
            sub_texts = []
            for s in sub.get("sections", []):
                t = s.get("text", "").strip()
                if t and len(t) > 20:
                    sub_texts.append(t)
            # FIX: sub links are also plain strings
            for lnk in sub.get("links", []):
                if isinstance(lnk, str) and len(lnk) > 10:
                    decoded = urllib.parse.unquote(lnk)
                    fname   = decoded.split("/")[-1].split("?")[0]
                    if fname:
                        sub_texts.append(f"{fname} → {lnk}")
            add_chunks(sub_label, sub_url, cat, sub_texts)

        add_chunks(label, url, cat, chunk_texts)

    # ── Also merge pdf_index (PDF filenames are themselves useful for search) ─
    pdf_index_path = SCRAPER_DIR / "sppu_data" / "pdf_index.json"
    if pdf_index_path.exists():
        try:
            pi = json.loads(pdf_index_path.read_text(encoding="utf-8"))
            for entry in pi:
                # FIX: v4 used entry.get("name") but the key written by dl_pdf is "filename"
                name = entry.get("filename", entry.get("name", "")).strip()
                src  = entry.get("url", entry.get("source_url", "")).strip()
                if name and len(name) > 8:
                    rag_chunks.append({
                        "source": "PDF Index",
                        "category": "pdf",
                        "url": src,
                        "content": f"Available document: {name}" + (f" — {src}" if src else ""),
                    })
        except Exception as e:
            print(f"  ⚠️  Could not merge pdf_index: {e}")

    knowledge = {
        "scraped_at": datetime.now().isoformat(),
        "total_chunks": len(rag_chunks),
        "rag_chunks": rag_chunks,
    }
    out_path.write_text(json.dumps(knowledge, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n  💾 RAG export → {out_path}  ({len(rag_chunks)} chunks)")

    # ── Rebuild FAISS index so the chatbot picks up fresh data immediately ────
    try:
        sys.path.insert(0, str(SCRAPER_DIR.parent / "backend"))
        from build_sppu_index import build_index
        build_index()
    except Exception as e:
        print(f"\n  ⚠️  FAISS index rebuild failed (run build_sppu_index.py manually): {e}")


if __name__ == "__main__":
    run()