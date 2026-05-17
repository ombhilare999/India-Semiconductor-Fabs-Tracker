"""
Fetches Google News RSS for each fab and saves to data/news.json.
Runs daily via GitHub Actions.
"""

import json
import time
import feedparser
from datetime import datetime, timezone
from urllib.parse import quote

MAX_ITEMS = 5  # news items per fab

STATUS_KEYWORDS = {
    "milestone": ["inaugurated", "commissioned", "production started", "first chip",
                  "operational", "goes live", "begins production", "tape-out"],
    "delay":     ["delayed", "postponed", "stalled", "on hold", "scrapped", "cancelled"],
    "progress":  ["construction begins", "groundbreaking", "foundation", "approved",
                  "investment confirmed", "MoU signed"],
}


def fetch_news(query: str) -> list[dict]:
    url = (
        "https://news.google.com/rss/search"
        f"?q={quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
    )
    feed = feedparser.parse(url)
    items = []
    for entry in feed.entries[:MAX_ITEMS]:
        source = ""
        if hasattr(entry, "source"):
            source = entry.source.get("title", "")
        items.append({
            "title":     entry.get("title", ""),
            "link":      entry.get("link", ""),
            "source":    source,
            "published": entry.get("published", ""),
        })
    return items


def flag_status_hints(items: list[dict]) -> list[str]:
    """Return keywords found in headlines that might signal a status change."""
    hints = []
    combined = " ".join(i["title"].lower() for i in items)
    for category, words in STATUS_KEYWORDS.items():
        for word in words:
            if word in combined:
                hints.append(f"{category}: '{word}'")
    return hints


def main():
    with open("data/fabs.json") as f:
        data = json.load(f)

    news: dict = {}
    status_hints: dict = {}

    for fab in data["fabs"]:
        fab_id  = str(fab["id"])
        query   = fab.get("newsQuery", f"{fab['name']} semiconductor India")
        print(f"  [{fab_id}] {fab['name']} → query: {query!r}")

        items = fetch_news(query)
        news[fab_id] = items
        print(f"        {len(items)} article(s) fetched")

        hints = flag_status_hints(items)
        if hints:
            status_hints[fab_id] = hints
            print(f"        ⚠ Status hints: {hints}")

        time.sleep(1.5)  # avoid hammering Google

    news["_meta"] = {
        "fetchedAt":   datetime.now(timezone.utc).isoformat(),
        "statusHints": status_hints,  # review these manually before changing fabs.json
    }

    with open("data/news.json", "w") as f:
        json.dump(news, f, indent=2, ensure_ascii=False)

    print("\nDone. data/news.json written.")
    if status_hints:
        print("\n⚠  Possible status changes detected — review manually:")
        for fab_id, hints in status_hints.items():
            fab = next(x for x in data["fabs"] if str(x["id"]) == fab_id)
            print(f"   {fab['name']}: {hints}")


if __name__ == "__main__":
    main()
