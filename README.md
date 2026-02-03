# AI 行业每日新闻速览

这是一个纯前端静态网页应用，用于每日聚合 AI 行业新闻，支持：
- 来源、标题、时间与 200 字摘要展示
- 重点媒体/博客优先
- 本地历史快照（localStorage）便于回顾

## 本地运行

```bash
python -m http.server 8000
```

浏览器访问：`http://127.0.0.1:8000`。

## 部署上线（静态站点）

以下任选一种方式即可上线：

### 方案 A：GitHub Pages

1. 将仓库推送到 GitHub。
2. 进入仓库 **Settings → Pages**。
3. Source 选择 **Deploy from a branch**。
4. Branch 选择 `main`/`master`（或当前分支），目录选择 `/root`。
5. 保存后等待构建完成，Pages 会给出公开访问链接。

### 方案 B：Netlify

1. 登录 Netlify，点击 **Add new site → Import an existing project**。
2. 选择 GitHub 仓库。
3. Build command 留空，Publish directory 选择仓库根目录。
4. 部署完成后获得公开访问链接。

### 方案 C：Vercel

1. 登录 Vercel，点击 **New Project** 并选择 GitHub 仓库。
2. Framework 选择 **Other**。
3. Build command 留空，Output directory 选择 `.`（根目录）。
4. 部署完成后获得访问链接。

## 说明

- 新闻数据来自公开 RSS/Atom 源，由浏览器通过代理拉取。
- 历史快照存储在浏览器本地 `localStorage` 中，不会上传到服务器。
