import requests
from bs4 import BeautifulSoup
import json
import os

URL = "https://pallavigodambe25.github.io/College-website/"

# Always resolve data/ relative to this file, not the working directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "data"))

def scrape_notices():
    os.makedirs(DATA_DIR, exist_ok=True)   # create data/ if it doesn't exist

    response = requests.get(URL)
    soup = BeautifulSoup(response.text, "html.parser")

    notices = []

    for h in soup.find_all(["h1", "h2", "h3"]):
        text = h.get_text(strip=True)
        if len(text) > 5:
            notices.append(text)

    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if len(text) > 40:
            notices.append(text)

    out_path = os.path.join(DATA_DIR, "notices.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(notices, f, indent=4)

    print(f"✅ Extracted {len(notices)} content blocks → {out_path}")

if __name__ == "__main__":
    scrape_notices()
