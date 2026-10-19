"""
rebuild_index.py  —  Run this ONE TIME after updating sppu_knowledge.json
Place this file in your pvpit_updated/ folder and run:
    python rebuild_index.py
"""
import os, sys, json
import faiss
import numpy as np
from pathlib import Path

BASE_DIR  = Path(__file__).parent
DATA_DIR  = BASE_DIR / "data"
JSON_PATH = DATA_DIR / "sppu_knowledge.json"
IDX_PATH  = DATA_DIR / "sppu_index.faiss"

def check_stale():
    if not IDX_PATH.exists():
        return True, "index does not exist"
    raw   = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    n_doc = len(raw.get("rag_chunks", []))
    idx   = faiss.read_index(str(IDX_PATH))
    if idx.ntotal != n_doc:
        return True, f"index has {idx.ntotal} vectors but knowledge has {n_doc} chunks"
    if JSON_PATH.stat().st_mtime > IDX_PATH.stat().st_mtime:
        return True, "knowledge JSON is newer than index"
    return False, "index is up to date"

def build():
    print("\n" + "="*55)
    print("  SPPU FAISS Index Rebuilder")
    print("="*55)

    stale, reason = check_stale()
    if not stale:
        print(f"  ✅  Index is already up to date ({reason})")
        print("     No rebuild needed.")
        return

    print(f"  ⚠️   Rebuild needed: {reason}")
    print()

    raw    = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    chunks = raw.get("rag_chunks", [])
    texts  = [c["content"].strip() for c in chunks if c.get("content","").strip()]
    print(f"  📚  Encoding {len(texts):,} chunks...")

    # Try sentence-transformers first (same model as rag_engine.py uses)
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        embs  = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)
        embs  = np.array(embs, dtype="float32")
    except Exception as e:
        print(f"  ❌  SentenceTransformer failed: {e}")
        sys.exit(1)

    dim   = embs.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embs)
    faiss.write_index(index, str(IDX_PATH))

    print(f"\n  ✅  Saved: {IDX_PATH}")
    print(f"      {len(texts):,} vectors  |  dim={dim}")

    # Quick smoke test
    print("\n  🔍  Smoke test: 'B.E. 2019 ENDSEM timetable'")
    q    = "B.E. 2019 PATTERN ENDSEM EXAM TIMETABLE SUMMER SESSION 2026"
    qvec = model.encode([q], normalize_embeddings=True).astype("float32")
    scores, idxs = index.search(qvec, 3)
    found = False
    for s, i in zip(scores[0], idxs[0]):
        if 0 <= i < len(chunks):
            content = chunks[i]["content"]
            print(f"    [{s:.3f}]  {content[:90]}")
            if "B.E." in content and "ENDSEM" in content:
                found = True
    if found:
        print("  ✅  B.E. ENDSEM timetable found in top results — chatbot will work!")
    else:
        print("  ⚠️  B.E. ENDSEM not in top 3 — may need more scraping")

    print("\n  ✅  Done. Restart Flask (python backend/app.py) to apply.\n")

if __name__ == "__main__":
    build()
