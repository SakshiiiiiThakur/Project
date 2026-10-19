"""
rag_engine.py — searches PVPIT + SPPU FAISS indexes
KEY FIX: SPPU index searched separately and always included.
         PVPIT website chunks never outrank SPPU exam data.
"""
import os, json
import faiss, numpy as np
from sentence_transformers import SentenceTransformer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "data"))
model    = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

# Keywords that signal an exam/timetable query — boost SPPU results for these
SPPU_KEYWORDS = {
    "timetable","time table","time-table","endsem","insem","exam","exams",
    "schedule","session","summer","winter","pattern","b.e.","s.e.","t.e.",
    "f.e.","m.e.","be ","se ","te ","fe ","circular","result","syllabus",
    "sppu","unipune","2019","2024","2026","april","may","semester",
    "practical","oral","backlog","revaluation","pdf","download","timetable"
}

def _is_sppu_query(query: str) -> bool:
    q = query.lower()
    return any(kw in q for kw in SPPU_KEYWORDS)


def _load(index_file, docs_file):
    ip = os.path.join(DATA_DIR, index_file)
    dp = os.path.join(DATA_DIR, docs_file)
    if not (os.path.exists(ip) and os.path.exists(dp)):
        print(f"  [RAG] missing: {index_file} or {docs_file}")
        return None, []
    try:
        idx = faiss.read_index(ip)
        raw = json.load(open(dp, encoding="utf-8"))
        docs = raw.get("rag_chunks", raw) if isinstance(raw, dict) else raw
        if docs and isinstance(docs[0], str):
            docs = [{"source": "PVPIT Website", "category": "pvpit", "content": d} for d in docs]
        if os.path.getmtime(dp) > os.path.getmtime(ip):
            print(f"  [RAG] ⚠️  {docs_file} is newer than index — run build_sppu_index.py")
        print(f"  [RAG] loaded {len(docs):,} chunks from {docs_file}")
        return idx, docs
    except Exception as e:
        print(f"  [RAG] error loading {docs_file}: {e}")
        return None, []


_pvpit_idx, _pvpit_docs = _load("index.faiss",      "notices.json")
_sppu_idx,  _sppu_docs  = _load("sppu_index.faiss", "sppu_knowledge.json")


def reload_sppu_index():
    global _sppu_idx, _sppu_docs
    _sppu_idx, _sppu_docs = _load("sppu_index.faiss", "sppu_knowledge.json")


def _format(doc) -> str:
    content = doc.get("content", "") if isinstance(doc, dict) else str(doc)
    source  = doc.get("source",  "") if isinstance(doc, dict) else ""
    url     = doc.get("url",     "") if isinstance(doc, dict) else ""
    label   = source or "SPPU"
    entry   = f"[{label}]\n{content}"
    if url and url not in content:
        entry += f"\nURL: {url}"
    return entry


def search(query: str, top_k: int = 8) -> list[str]:
    vec = model.encode([query], normalize_embeddings=True).astype("float32")

    def _q(idx, docs, k):
        if idx is None or not docs:
            return []
        k = min(k, idx.ntotal)
        scores, idxs = idx.search(vec, k)
        return [(float(s), docs[i]) for s, i in zip(scores[0], idxs[0])
                if 0 <= i < len(docs)]

    sppu_query = _is_sppu_query(query)

    if sppu_query:
        # ── SPPU query: take top results from SPPU index first, ──────────────
        # then fill remaining slots from PVPIT if needed
        sppu_hits  = _q(_sppu_idx,  _sppu_docs,  top_k * 2)
        sppu_hits.sort(key=lambda x: x[0], reverse=True)
        pvpit_hits = _q(_pvpit_idx, _pvpit_docs, 2)  # max 2 PVPIT results
        pvpit_hits.sort(key=lambda x: x[0], reverse=True)

        # Take top_k from SPPU, then up to 2 from PVPIT
        ordered = sppu_hits[:top_k] + pvpit_hits[:2]
    else:
        # ── General query: mix both indexes by score ─────────────────────────
        all_hits = _q(_pvpit_idx, _pvpit_docs, top_k) + \
                   _q(_sppu_idx,  _sppu_docs,  top_k)
        all_hits.sort(key=lambda x: x[0], reverse=True)
        ordered = all_hits

    seen, out = set(), []
    for _, doc in ordered:
        content = doc.get("content", "") if isinstance(doc, dict) else str(doc)
        key = content[:120]
        if key not in seen and content.strip():
            seen.add(key)
            out.append(_format(doc))
        if len(out) >= top_k:
            break

    return out
