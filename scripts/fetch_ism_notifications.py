"""
Scrapes ISM (India Semiconductor Mission) notifications and press releases.
On first run: indexes all existing entries without downloading PDFs.
On subsequent runs: detects new entries, downloads and extracts their PDF text.
Saves results to data/ism_notifications.json.
"""

import io
import json
import hashlib
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

PAGES = [
    {"type": "press-release",  "url": "https://ism.gov.in/notifications/press-release"},
    {"type": "notification",   "url": "https://ism.gov.in/notifications/"},
]

DATA_FILE    = "data/ism_notifications.json"
MAX_PDF_CHARS = 2500
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ISM-Tracker/1.0; +https://indiasemifabs.omkarbhilare.com)"}


# ── Persistence ────────────────────────────────────────────

def load() -> dict:
    try:
        with open(DATA_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        return {"lastChecked": None, "notifications": []}

def save(data: dict):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ── Scraping ───────────────────────────────────────────────

def make_id(pdf_url: str | None, title: str) -> str:
    key = (pdf_url or title).encode("utf-8")
    return hashlib.md5(key).hexdigest()[:12]

def scrape_page(url: str) -> list[dict]:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    entries = []
    table = soup.find("table")
    if not table:
        print(f"  WARNING: No table found at {url}")
        return entries

    for row in table.find_all("tr")[1:]:   # skip header row
        cols = row.find_all("td")
        if len(cols) < 2:
            continue

        title = cols[1].get_text(strip=True) if len(cols) > 1 else ""
        date  = cols[2].get_text(strip=True) if len(cols) > 2 else ""

        pdf_url = None
        link = row.find("a", href=True)
        if link:
            href = link["href"]
            if href.startswith("http"):
                pdf_url = href
            elif href.startswith("/"):
                pdf_url = "https://ism.gov.in" + href

        if title:
            entries.append({"title": title, "date": date, "pdfUrl": pdf_url})

    return entries


# ── PDF extraction ─────────────────────────────────────────

def extract_pdf_text(pdf_url: str) -> str:
    if not HAS_PYPDF or not pdf_url:
        return ""
    try:
        resp = requests.get(pdf_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        reader = pypdf.PdfReader(io.BytesIO(resp.content))
        text = "".join(page.extract_text() or "" for page in reader.pages)
        text = text.strip()
        if not text:
            return "[Scanned PDF — text not extractable]"
        return text[:MAX_PDF_CHARS]
    except Exception as e:
        return f"[PDF extraction failed: {e}]"


# ── Main ───────────────────────────────────────────────────

def main() -> int:
    data        = load()
    existing    = {n["id"] for n in data["notifications"]}
    is_first_run = len(existing) == 0

    if is_first_run:
        print("First run detected — indexing all existing entries without downloading PDFs.")

    new_count = 0

    for page in PAGES:
        print(f"\nScraping {page['url']} ...")
        try:
            entries = scrape_page(page["url"])
        except Exception as e:
            print(f"  ERROR: {e}")
            continue

        print(f"  {len(entries)} entries found")

        for entry in entries:
            entry_id = make_id(entry["pdfUrl"], entry["title"])
            if entry_id in existing:
                continue

            is_new = not is_first_run
            print(f"  {'NEW' if is_new else 'INDEX'}: {entry['title'][:70]}")

            summary = ""
            if is_new and entry["pdfUrl"]:
                print(f"    Downloading PDF …")
                summary = extract_pdf_text(entry["pdfUrl"])
                time.sleep(1.5)

            record = {
                "id":          entry_id,
                "type":        page["type"],
                "title":       entry["title"],
                "date":        entry["date"],
                "pdfUrl":      entry["pdfUrl"],
                "summary":     summary,
                "firstSeenAt": datetime.now(timezone.utc).isoformat(),
                "isNew":       is_new,
            }

            data["notifications"].insert(0, record)
            existing.add(entry_id)

            if is_new:
                new_count += 1

    data["lastChecked"] = datetime.now(timezone.utc).isoformat()
    save(data)

    print(f"\nDone — {new_count} new notification(s) found.")
    return new_count


if __name__ == "__main__":
    raise SystemExit(0 if main() == 0 else 1)
