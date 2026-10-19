import json
import os
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

# Always resolve data/ relative to this file, not the working directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "data"))

notices_path = os.path.join(DATA_DIR, "notices.json")
index_path   = os.path.join(DATA_DIR, "index.faiss")

os.makedirs(DATA_DIR, exist_ok=True)

model = SentenceTransformer("all-MiniLM-L6-v2")

with open(notices_path, "r", encoding="utf-8") as f:
    documents = json.load(f)

print(f"Encoding {len(documents)} documents...")
embeddings = model.encode(documents, show_progress_bar=True)

dimension = len(embeddings[0])
index = faiss.IndexFlatL2(dimension)
index.add(np.array(embeddings))

faiss.write_index(index, index_path)
print(f"✅ Vector database created → {index_path}")
