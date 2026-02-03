const FEED_SOURCES = [
  {
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
  },
  {
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
  },
  {
    name: "Anthropic",
    url: "https://www.anthropic.com/news/rss.xml",
  },
  {
    name: "MIT Technology Review - AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
  },
  {
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
  },
  {
    name: "Synced Review",
    url: "https://syncedreview.com/feed/",
  },
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
  },
  {
    name: "The Verge - AI",
    url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml",
  },
  {
    name: "NVIDIA Blog - AI",
    url: "https://blogs.nvidia.com/blog/category/ai/feed/",
  },
];

const CORS_PROXY_PREFIX = "https://r.jina.ai/http://";

const sourceList = document.getElementById("source-list");
const newsList = document.getElementById("news-list");
const statusText = document.getElementById("status");
const lastUpdatedText = document.getElementById("last-updated");
const refreshButton = document.getElementById("refresh-button");
const saveButton = document.getElementById("save-button");
const historySelect = document.getElementById("history-select");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const toggleHistory = document.getElementById("toggle-history");

const MAX_SUMMARY_LENGTH = 200;
const STORAGE_KEY = "ai-news-snapshots";
const MAX_SNAPSHOTS = 14;
const DATA_URL = "data/news.json";

const formatDate = (date) => {
  if (!date) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const stripHtml = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
};

const parseFeedItems = (xmlText, sourceName) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const items = Array.from(xml.querySelectorAll("item, entry"));

  return items.map((item) => {
    const title =
      item.querySelector("title")?.textContent?.trim() || "未命名标题";
    const link =
      item.querySelector("link")?.getAttribute("href") ||
      item.querySelector("link")?.textContent ||
      "";
    const pubDateRaw =
      item.querySelector("pubDate")?.textContent ||
      item.querySelector("updated")?.textContent ||
      item.querySelector("published")?.textContent ||
      "";
    const summaryRaw =
      item.querySelector("description")?.textContent ||
      item.querySelector("summary")?.textContent ||
      item.querySelector("content")?.textContent ||
      "暂无摘要";
    const date = pubDateRaw ? new Date(pubDateRaw) : null;

    return {
      title,
      link,
      source: sourceName,
      date,
      summary: truncateText(stripHtml(summaryRaw), MAX_SUMMARY_LENGTH),
    };
  });
};

const isRecent = (date) => {
  if (!date || Number.isNaN(date.getTime())) return true;
  const now = Date.now();
  const diff = now - date.getTime();
  return diff < 24 * 60 * 60 * 1000;
};

const formatDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const loadSnapshots = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

const saveSnapshots = (snapshots) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
};

const mergeSnapshots = (snapshots, incoming) => {
  const merged = { ...snapshots, ...incoming };
  const sortedKeys = Object.keys(merged).sort((a, b) => b.localeCompare(a));
  sortedKeys.slice(MAX_SNAPSHOTS).forEach((key) => {
    delete merged[key];
  });
  return merged;
};

const storeSnapshot = (dateKey, items) => {
  const snapshots = loadSnapshots();
  const merged = mergeSnapshots(snapshots, { [dateKey]: items });
  saveSnapshots(merged);
  renderHistory();
};

const renderSources = () => {
  sourceList.innerHTML = "";
  FEED_SOURCES.forEach((source) => {
    const item = document.createElement("li");
    item.textContent = source.name;
    sourceList.appendChild(item);
  });
};

const renderNews = (items) => {
  newsList.innerHTML = "";
  if (!items.length) {
    statusText.textContent = "暂无符合条件的新闻，请稍后再试。";
    return;
  }

  statusText.textContent = `已更新 ${items.length} 条新闻`;

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "news-card";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const meta = document.createElement("div");
    meta.className = "news-meta";
    meta.innerHTML = `<span>来源：${item.source}</span><span>时间：${formatDate(
      item.date
    )}</span>`;

    const summary = document.createElement("p");
    summary.textContent = item.summary;

    const link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "阅读全文 →";

    card.append(title, meta, summary, link);
    newsList.appendChild(card);
  });
};

const renderHistory = () => {
  const snapshots = loadSnapshots();
  const keys = Object.keys(snapshots).sort((a, b) => b.localeCompare(a));
  historySelect.innerHTML = "";
  if (!keys.length) {
    historyEmpty.style.display = toggleHistory.checked ? "block" : "none";
    historyList.innerHTML = "";
    historySelect.disabled = true;
    return;
  }
  historyEmpty.style.display = "none";
  keys.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key;
    historySelect.appendChild(option);
  });
  const currentKey = historySelect.value || keys[0];
  historySelect.value = currentKey;
  historySelect.disabled = !toggleHistory.checked;
  const items = snapshots[currentKey] || [];
  historyList.innerHTML = "";
  historyList.style.display = toggleHistory.checked ? "grid" : "none";
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "news-card";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const meta = document.createElement("div");
    meta.className = "news-meta";
    meta.innerHTML = `<span>来源：${item.source}</span><span>时间：${item.time}</span>`;

    const summary = document.createElement("p");
    summary.textContent = item.summary;

    const link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "阅读全文 →";

    card.append(title, meta, summary, link);
    historyList.appendChild(card);
  });
};

const seedSnapshotsFromFile = async () => {
  if (localStorage.getItem(STORAGE_KEY)) return;
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) return;
    const data = await response.json();
    if (!data?.snapshots) return;
    const merged = mergeSnapshots({}, data.snapshots);
    saveSnapshots(merged);
    renderHistory();
  } catch (error) {
    // ignore seed failure
  }
};

const loadSeedNews = async () => {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data?.items)) return;
    const mapped = data.items.map((item) => ({
      ...item,
      date: item.date ? new Date(item.date) : null,
    }));
    renderNews(mapped);
  } catch (error) {
    // ignore seed failure
  }
};

const fetchFeed = async ({ name, url }) => {
  const response = await fetch(`${CORS_PROXY_PREFIX}${url}`);
  if (!response.ok) {
    throw new Error(`${name} 加载失败`);
  }
  const text = await response.text();
  return parseFeedItems(text, name);
};

const loadNews = async () => {
  refreshButton.disabled = true;
  saveButton.disabled = true;
  statusText.textContent = "正在拉取新闻，请稍候…";
  newsList.innerHTML = "";

  const results = await Promise.allSettled(FEED_SOURCES.map(fetchFeed));
  const items = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => item.title && item.link)
    .filter((item) => isRecent(item.date))
    .sort((a, b) => {
      const dateA = a.date ? a.date.getTime() : 0;
      const dateB = b.date ? b.date.getTime() : 0;
      return dateB - dateA;
    });

  const failedSources = results
    .map((result, index) => ({ result, source: FEED_SOURCES[index] }))
    .filter((entry) => entry.result.status === "rejected")
    .map((entry) => entry.source.name);

  if (failedSources.length) {
    statusText.textContent = `部分来源加载失败：${failedSources.join(
      "、"
    )}，已显示可用新闻。`;
  }

  renderNews(items);
  lastUpdatedText.textContent = `最后更新：${formatDate(new Date())}`;
  refreshButton.disabled = false;
  saveButton.disabled = false;

  const todayKey = formatDateKey();
  const snapshots = loadSnapshots();
  if (!snapshots[todayKey] && items.length) {
    const compactItems = items.map((item) => ({
      title: item.title,
      link: item.link,
      source: item.source,
      time: formatDate(item.date),
      summary: item.summary,
    }));
    storeSnapshot(todayKey, compactItems);
  }
};

renderSources();
renderHistory();
seedSnapshotsFromFile();
loadSeedNews();
loadNews();

refreshButton.addEventListener("click", () => {
  loadNews();
});

saveButton.addEventListener("click", () => {
  const todayKey = formatDateKey();
  const items = Array.from(newsList.querySelectorAll(".news-card")).map((card) => {
    const title = card.querySelector("h3")?.textContent ?? "未命名标题";
    const metaSpans = card.querySelectorAll(".news-meta span");
    const source = metaSpans[0]?.textContent?.replace("来源：", "") ?? "未知来源";
    const time = metaSpans[1]?.textContent?.replace("时间：", "") ?? "未知时间";
    const summary = card.querySelector("p")?.textContent ?? "暂无摘要";
    const link = card.querySelector("a")?.href ?? "";
    return {
      title,
      link,
      source,
      time,
      summary,
    };
  });

  if (items.length) {
    storeSnapshot(todayKey, items);
    lastUpdatedText.textContent = `已保存：${todayKey}`;
  }
});

historySelect.addEventListener("change", renderHistory);
toggleHistory.addEventListener("change", (event) => {
  const visible = event.target.checked;
  historyList.style.display = visible ? "grid" : "none";
  const hasSnapshots = Object.keys(loadSnapshots()).length > 0;
  historyEmpty.style.display = visible && !hasSnapshots ? "block" : "none";
  historySelect.disabled = !visible;
});
