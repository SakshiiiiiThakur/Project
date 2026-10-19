"""
build_sppu_index.py — rebuilds data/sppu_index.faiss from data/sppu_knowledge.json
Run: python backend/build_sppu_index.py
"""
import os, sys, json
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from datetime import datetime
from pathlib import Path

BASE_DIR  = Path(__file__).parent
DATA_DIR  = BASE_DIR.parent / "data"
JSON_PATH = DATA_DIR / "sppu_knowledge.json"
IDX_PATH  = DATA_DIR / "sppu_index.faiss"


def is_stale():
    if not IDX_PATH.exists():
        return True
    raw = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    idx = faiss.read_index(str(IDX_PATH))
    n   = len(raw.get("rag_chunks", []))
    if idx.ntotal != n:
        print(f"  ⚠️  Stale: index={idx.ntotal} vectors, knowledge={n} chunks")
        return True
    if JSON_PATH.stat().st_mtime > IDX_PATH.stat().st_mtime:
        print(f"  ⚠️  Stale: knowledge.json is newer than index")
        return True
    return False


def build_index():
    print("[build_sppu_index] Loading sppu_knowledge.json …")
    raw    = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    chunks = raw.get("rag_chunks", raw) if isinstance(raw, dict) else raw
    texts  = [c.get("content","").strip() for c in chunks if c.get("content","").strip()]
    print(f"  📚 Encoding {len(texts):,} chunks …")

    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    embs  = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)

    dim   = embs.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(np.array(embs, dtype="float32"))
    faiss.write_index(index, str(IDX_PATH))
    print(f"  ✅  FAISS index saved → {IDX_PATH}  ({len(texts):,} vectors, dim={dim})")

    # Hot-reload if running inside Flask
    try:
        if "rag_engine" in sys.modules:
            import rag_engine
            rag_engine._sppu_idx, rag_engine._sppu_docs = rag_engine._load(
                "sppu_index.faiss", "sppu_knowledge.json")
            print("  🔄  RAG engine hot-reloaded.")
    except Exception as e:
        print(f"  ℹ️  Hot-reload skipped: {e}")


if __name__ == "__main__":
    if is_stale():
        build_index()
    else:
        print("✅ Index is already up to date.")
