# SPPU Scraper — Selenium v4 FINAL

## What changed from the old scraper?

| Old scraper | New scraper (this file) |
|---|---|
| Uses `requests` + `BeautifulSoup` only | Uses **Selenium** (Chrome) + `requests` |
| Misses JS-rendered content | Handles JS tabs, accordions, SharePoint |
| Basic PDF collection | Clicks every tab/year/accordion to reveal hidden PDFs |
| No SharePoint support | Full SharePoint sidebar auto-discovery |

## Requirements

### Python packages (already in requirements.txt)
```
selenium
webdriver-manager
```

### System requirement
- **Google Chrome** must be installed  
  Download: https://www.google.com/chrome/

`webdriver-manager` will auto-download the matching ChromeDriver — no manual setup needed.

## How to run manually

```bash
# From project root:
python scraper/sppu_scraper.py
```

This will:
1. Open Chrome, scrape all SPPU pages
2. Write `scraper/sppu_data/sppu_scraped.json` (raw data)
3. Write `data/sppu_knowledge.json` (RAG-ready chunks)
4. Build `data/sppu_index.faiss` (vector index)
5. Hot-reload the RAG engine if Flask is running

## How the chatbot gets real-time data

```
Admin Panel → "Refresh SPPU Data" button
    ↓
POST /sppu/refresh  (app.py)
    ↓
Runs sppu_scraper.py (Selenium, ~10-15 min)
    ↓
Writes sppu_knowledge.json + sppu_index.faiss
    ↓
Calls rag_engine.reload_sppu_index()
    ↓
Chatbot immediately answers with fresh data ✅
```

## Output files

| File | Purpose |
|---|---|
| `scraper/sppu_data/sppu_scraped.json` | Raw scraped pages + tables + links |
| `scraper/sppu_data/pdf_index.json` | Metadata of all downloaded PDFs |
| `scraper/sppu_data/pdfs/` | Downloaded PDF files |
| `data/sppu_knowledge.json` | RAG chunks (input to FAISS) |
| `data/sppu_index.faiss` | Vector index used by chatbot |
