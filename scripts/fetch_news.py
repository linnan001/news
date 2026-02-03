#!/usr/bin/env python3
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

FEED_SOURCES = [
    {"name": "OpenAI Blog", "url": "https://openai.com/blog/rss.xml"},
    {"name": "Google DeepMind", "url": "https://deepmind.google/blog/rss.xml"},
    {"name": "Anthropic", "url": "https://www.anthropic.com/news/rss.xml"},
    {
        "name": "MIT Technology Review - AI",
        "url": "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    },
    {"name": "VentureBeat AI", "url": "https://venturebeat.com/category/ai/feed/"},
    {"name": "Synced Review", "url": "https://syncedreview.com/feed/"},
    {"name": "Hugging Face Blog", "url": "https://huggingface.co/blog/feed.xml"},
    {
        "name": "The Verge - AI",
        "url": "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml",
    },
    {"name": "NVIDIA Blog - AI", "url": "https://blogs.nvidia.com/blog/category/ai/feed/"},
]

MAX_SUMMARY_LENGTH = 200
DAYS_BACK = 7
OUTPUT_PATH = "data/news.json"
CORS_PROXY_PREFIX = "https://r.jina.ai/http://"


def strip_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]*>", " ", text or "")
    return re.sub(r"\s+", " ", cleaned).strip()


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit]}…"


def fetch_url(url: str) -> str:
    req = urllib.request.Request(
        f"{CORS_PROXY_PREFIX}{url}",
        headers={
            "User-Agent": "Mozilla/5.0 (AI News Aggregator)"
        },
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read().decode("utf-8", errors="ignore")


def parse_date(raw: str) -> datetime | None:
    if not raw:
        return None
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%fZ",
    ):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def find_text(element, tags):
    for tag in tags:
        node = element.find(tag)
        if node is not None and node.text:
            return node.text.strip()
    return ""


def parse_feed(xml_text: str, source: str) -> list[dict]:
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items

    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "content": "http://purl.org/rss/1.0/modules/content/",
    }

    for entry in root.findall(".//item") + root.findall(".//atom:entry", ns):
        title = find_text(entry, ["title", "atom:title"])
        link = ""
        link_node = entry.find("link") or entry.find("atom:link", ns)
        if link_node is not None:
            link = link_node.attrib.get("href") or (link_node.text or "").strip()
        pub_raw = find_text(
            entry,
            ["pubDate", "atom:updated", "atom:published", "updated", "published"],
        )
        summary_raw = find_text(
            entry,
            [
                "description",
                "summary",
                "atom:summary",
                "content",
                "content:encoded",
            ],
        )
        published_at = parse_date(pub_raw)
        items.append(
            {
                "title": title or "未命名标题",
                "link": link,
                "source": source,
                "date": published_at,
                "summary": truncate(strip_html(summary_raw or "暂无摘要"), MAX_SUMMARY_LENGTH),
            }
        )
    return items


def main() -> int:
    all_items = []
    for feed in FEED_SOURCES:
        try:
            xml_text = fetch_url(feed["url"])
            items = parse_feed(xml_text, feed["name"])
            all_items.extend(items)
        except Exception:
            continue
        time.sleep(0.3)

    normalized = []
    for item in all_items:
        if not item["link"] or item["date"] is None:
            continue
        if item["date"].tzinfo is None:
            item["date"] = item["date"].replace(tzinfo=timezone.utc)
        normalized.append(item)

    if normalized:
        anchor_time = max(item["date"] for item in normalized)
    else:
        anchor_time = datetime.now(timezone.utc)
    cutoff = anchor_time - timedelta(days=DAYS_BACK)

    filtered = [item for item in normalized if item["date"] >= cutoff]

    filtered.sort(key=lambda x: x["date"], reverse=True)

    snapshots: dict[str, list[dict]] = {}
    items_out: list[dict] = []
    for item in filtered:
        date_key = item["date"].astimezone(timezone.utc).date().isoformat()
        payload = {
            "title": item["title"],
            "link": item["link"],
            "source": item["source"],
            "date": item["date"].isoformat(),
            "summary": item["summary"],
        }
        items_out.append(payload)
        snapshots.setdefault(date_key, []).append(
            {
                "title": item["title"],
                "link": item["link"],
                "source": item["source"],
                "time": item["date"].strftime("%Y-%m-%d %H:%M"),
                "summary": item["summary"],
            }
        )

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "items": items_out,
        "snapshots": snapshots,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=2)

    return 0


if __name__ == "__main__":
    sys.exit(main())
