# 劳动小时

把一笔标价换成「在这座城市要工作多少小时」。年费按年算，月租按月算，标价不会再除以 12。

页面是静态的 Vite + React 站点，部署在 Cloudflare Pages，域名 `ltp.melkor.me`。城市价格不再由人工上传 JSON：访客在页面上选中城市时，Worker 才去 Numbeo 抓取这一座城市，解析后写进 KV 缓存，之后直接读缓存。

计算在浏览器里完成。访客改过的每月工时和语言只写在自己的 localStorage 里。

## 工作方式

```text
浏览器（Pages 静态页）
  GET /api/catalog           仓库内置城市目录，秒回
  GET /api/search?q=...      搜不到目录城市时，代理 Numbeo 的城市搜索
  GET /api/city/:numbeoId    KV 命中就返回；没命中才现场抓一次
                                  ↓
                             Worker（ltp.melkor.me/api/*）
                                  ├─ KV city:v1:<id>（TTL 30 天）
                                  └─ 冷启动：Numbeo dispatcher → 城市页
                                       （?displayCurrency=USD，共 2 个请求）
```

- 城市目录是 `worker/catalog.js` 里的静态数据（约 136 座热门城市），不触发抓取，也不联网。
- 冷城市固定只需要 2 个 Numbeo 请求；缓存 30 天，7 天后先返回旧数据、后台刷新（stale-while-revalidate）。
- 价格与「Average Monthly Net Salary (After Tax)」统一按美元口径解析；页面上的金额可以换成人民币、欧元、英镑、日元、港币等，汇率来自 Frankfurter v2（`GET /api/fx`，缓存 24 小时）。劳动小时仍用美元标价和美元月薪计算，换币只改显示。`monthly_work_hours` 不再来自数据，默认 173.3，访客可在页面上覆盖；税后月薪同样可以按城市覆盖（输入框跟随显示币种，存储和计算仍按美元）。城市页的「Mortgage Interest Rate (%), 20-Year Fixed」行会解析成 `mortgage_rate`，作为购置类条目利率的城市默认值（未设年限时连带用 20 年口径）。
- 页脚标注数据来源并回链 Numbeo；抓取时间取已加载城市里最新的一条。

## 本地运行

需要两个终端（第一个占 8787 端口，第二个 Vite 默认 5173，并把 `/api` 代理到 8787）：

```bash
cd worker
npm run dev        # = npx wrangler dev --ip 127.0.0.1 --port 8787
```

```bash
cd web
npm install
npm run dev
```

打开 Vite 输出的地址（默认 `http://localhost:5173/`）。`wrangler dev` 使用本地 KV（`.wrangler/`，已在 `.gitignore` 里），抓取 Numbeo 需要联网；冷城市约 2–5 秒，同一城市第二次是毫秒级。页面不会回落到模拟数据：Worker 不可用时，城市目录或城市数据会显示明确错误，可点重试。

## 测试

```bash
cd web
npm test
npm run build
npm run lint
```

```bash
cd worker
npm test
```

Worker 测试使用 Node 自带的 `node --test`，不需要额外依赖；`worker/test/fixtures/` 里有一份裁剪过的真实 Numbeo 页面和几份边界样例。Worker 测试和 `node --test` 需要 Node 20+。

### 浏览器端 E2E

`web/e2e/` 里是 Playwright 测试，覆盖选城市、搜索与加载失败重试、对比表、排行、工时/收入覆盖、组合创建与删除、按城市融资设置、分享链接、CSV/图片导出和移动端布局。E2E 通过路由拦截提供固定城市数据，不需要启动 Worker，也不会访问 Numbeo。

首次运行先安装浏览器：

```bash
cd web
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` 会先对 E2E 代码做 TypeScript 检查，再自动构建并启动 `vite preview`。调试时可以用 `npm run test:e2e:ui`。

### 本地验收（可选）

两个终端按上面的方式跑起来后，可以直接用 API 验一遍（冷城市会真的访问 Numbeo）：

```bash
curl -s http://127.0.0.1:8787/api/health
curl -s http://127.0.0.1:8787/api/catalog | head -c 200
curl -s "http://127.0.0.1:8787/api/search?q=lond"
time curl -s http://127.0.0.1:8787/api/city/3781 | head -c 400   # 第一次：冷抓取
time curl -s http://127.0.0.1:8787/api/city/3781 | head -c 400   # 第二次：命中 KV
```

页面手工验收：打开 Vite 地址，应该先看到空状态和「先在上面选一座城市」；选 Shanghai → 先出现「正在获取 Shanghai…」，「单项对比」Tab 里出现价格表和单项排行，条目名都是中文；切到「组合」Tab → 两张组合卡片直接列出条目与数量，下方是组合明细（各城单价 × 数量、合计）和按组合的排行，「以此为基础编辑」可把预设填进自定义组合；再选 Zurich → 两城对比；输入目录里没有的城市（例如 Cambridge）→ 出现「从 Numbeo 搜索」并可以选中；切到 English → 条目名变回 Numbeo 英文原文；页脚有 Numbeo 回链、抓取时间和免责声明。

想重新测「冷启动」，删掉 `worker/.wrangler/` 再重启 `wrangler dev`，本地 KV 就清空了。

## 部署

### 1. 建 KV 并部署 Worker

Worker 的缓存和限流计数都放在 KV 里。仓库里的 `worker/wrangler.toml` 已经绑定了一个已创建的 `CITY_CACHE` namespace；如果是在自己的账号里重新部署（或 fork 了仓库），先建一次命名空间，再把 id 换进配置：

```bash
cd worker
npx wrangler kv namespace create CITY_CACHE
```

把输出的 `id` 填进 `worker/wrangler.toml` 的 `[[kv_namespaces]]`：

```toml
[[kv_namespaces]]
binding = "CITY_CACHE"
id = "你自己的命名空间 id"
```

然后部署：

```bash
npx wrangler deploy
```

路由是 `ltp.melkor.me/api/*`，其余路径仍由 Pages 提供。`worker/` 目录里还有 `package.json`，`npm run deploy` / `npm run dev` 也可以。

### 2. 只部署页面

这一步不重新部署 Worker：

```bash
cd web
npm run build
npx wrangler pages deploy dist --project-name ltp --branch main
```

在该 Pages 项目上把自定义域名设为 `ltp.melkor.me`（只需一次）。静态资源在 `/assets/` 下带内容哈希，可以长期缓存。

### 3. 部署后先验一下出口

Cloudflare Worker 去访问 Numbeo 是否被拦截，只能在线上确认：

```bash
curl -s https://ltp.melkor.me/api/health
curl -s https://ltp.melkor.me/api/catalog | head -c 200
curl -s https://ltp.melkor.me/api/city/3781 | head -c 400
```

如果 `/api/city/<id>` 返回 `upstream_unavailable` 或 `upstream_error`，说明 Numbeo 拦了 Worker 的出口或改版了；可改用官方 API、换数据源，或回退到人工数据（见下）。

冷启动约 2–4 秒（两次上游请求 + 解析），之后命中 KV 是毫秒级。Worker 免费版每请求 CPU 只有 10 ms，解析约 100 KB 的 HTML 有超限可能；如果日志里出现 CPU 超时（1102），升级 Workers Paid（$5/月）或把解析换成流式 `HTMLRewriter`。第一次部署建议先用上面的 `curl` 观察一次冷启动。

### 4. 用 GitHub Actions 自动部署

`.github/workflows/deploy.yml` 在 push 到 `main`（或手动 `workflow_dispatch`）时依次执行：web 安装依赖 / 测试 / lint / 构建 → worker 测试 → 部署 Worker → 部署 Pages 生产环境。部署命令和手动部署保持一致。

前提是在 GitHub 仓库的 Settings → Secrets and variables → Actions 里添加：

- `CLOUDFLARE_API_TOKEN`（Repository secret）：token 需要 `Workers Scripts:Edit`、`Workers KV Storage:Edit`、`Workers Routes:Edit`、`Cloudflare Pages:Edit`；只有改自定义域名/DNS 时才需要 `DNS:Edit`。
- Account ID 已直接写在 workflow 的 `CLOUDFLARE_ACCOUNT_ID` 环境变量里；如果用的不是这个账号，改成自己的（Account ID 不是密钥，可以公开）。

`CLOUDFLARE_API_TOKEN` 只注入到两个部署步骤，前面的 `npm ci`、测试、构建步骤拿不到这个 secret。想在本地用 token 部署时，不要把 token 写进仓库或 `wrangler.toml`，用环境变量或系统钥匙串注入即可。

## 缓存、限流与成本

| 项 | 值 |
| --- | --- |
| 城市缓存 | KV `city:v1:<id>`，TTL 30 天；7 天内算新鲜，7–30 天先返回旧值并后台刷新 |
| 汇率缓存 | KV `fx:v2`，TTL 24 小时；Frankfurter v2，美元兑 10 个显示币种 |
| 搜索缓存 | KV `search:v1:<query>`，TTL 1 天 |
| 单 IP 冷抓取 | 20 次/小时 |
| 全局冷抓取 | 200 次/天 |
| 单 IP 搜索 | 60 次/小时 |
| 响应缓存头 | 城市 300 秒；目录/搜索 1 天 |

冷城市 = 2 个上游请求；缓存命中不产生上游请求。KV 免费额度是 10 万读/天、1000 写/天，Worker 免费额度是 10 万请求/天；个人站点足够，限流计数也会写 KV，量大时注意。

## 数据来源与合规（重要）

数据来自 **Numbeo**，按需抓取、缓存后展示，页脚保留回链署名。这是一个个人、非商业站点。

但 Numbeo 的服务条款明确写着：

> Automated data collection methods (such as scraping or crawling) are strictly prohibited unless you have obtained prior written permission from Numbeo.
> — https://www.numbeo.com/common/terms_of_use.jsp

官方数据 API 最低 **$260/月**（https://www.numbeo.com/common/api.jsp，无免费档）。本项目走的是「按需、低频、缓存 30 天、不预热、带识别 User-Agent」的最小化抓取，属于对上述条款的偏离，风险是请求被限流或 IP 被拦，而不是可以忽略的小事。如果 Numbeo 明确要求停止，应停掉 `/api/city/*` 的抓取，改用官方 API、人工数据或公开数据源。

`robots.txt`（https://www.numbeo.com/robots.txt）只禁了 `/heavy_crawling.any` 和 `/DEPRECATED/`，技术上轻量请求通常能拿到页面，但这不改变条款层面的限制。

页脚也写了「不是 Numbeo 官方、数字仅供参考」。

## 城市目录与条目名

- 加/删城市：直接改 `worker/catalog.js`（`{ id, name, country }`，`id` 是 Numbeo 的 city id）。目录只影响选择器，不影响抓取逻辑。
- 内置组合/条目名在 `web/src/data/items.ts`，公制英文原文和 `web/src/i18n/zh.ts` 的中文名一一对应。Numbeo 有时只给公制，有时只给美制，偶尔同一条两种都有。两种都有时保留公制。只有一种时，英文显示原始单位和原始标价，中文显示公制名称，并把磅、英里、平方英尺的标价换算过去。别名在 `web/src/data/measure.ts`，Worker 只负责在同一份数据里两种都有时丢掉美制那条。Numbeo 改版时，条目清单、中文翻译、美制别名和解析测试要一起更新。
- 目录外城市：在城市选择器里搜不到时就查 Numbeo 搜索接口，选中后同样走 `/api/city/:id`；冷抓取仍受上面的限流约束。

## 公式

```text
时薪 = 税后月薪 / 每月工作小时
劳动小时 = 美元 / 时薪
```

税后月薪和每月工时都按城市解析：访客覆盖 > 城市数据（Numbeo）> 内置默认（工时 173.3，即每周 40 小时 × 52 / 12）。月薪覆盖在页面上按当前显示币种输入，存储、分享和计算都换算回美元。

单项对比只浏览 Numbeo 原标价：年费按年算，月租按月算，一杯咖啡按一杯。组合里可以选择加总方式。「原标价」不换算。「折合每月」「折合每年」把月费和年费换到同一个周期。单价、件数和面积默认是 1，购置默认按 10 年直线摊销（不含利息、不含残值，也不是月租），勾选后再改。折合每月时再除以 12。

购置类条目（汽车、按平米购房）的摊销年数、年利率、还款方式和购房面积还可以**按城市单独设置**（条目行上的「按城市」按钮弹窗编辑）。融资条件与当地政策相关，属于城市事实，因此按城市的覆盖是全局的：对所有组合和单项生效，存在本机并随分享链接携带。解析顺序：城市覆盖 > 条目全局值 > 城市数据（Numbeo 房贷利率，此时未设年限的话默认连带 20 年）> 内置默认（10 年、无利率、等额本息）。城市单元格在解析结果与全局不同时会标注实际使用的年限和利率。每个月的次数、件数属于个人生活方式，各城市保持一致，不提供按城市设置。

同一个 `item` 字符串表示同一项支出。没有正数月薪、工时或标价的城市不参与该项排行，格子里会写明原因。

对比表以第一列城市为基准，后面的城市在每项数值后附加相对基准的百分比。中文里高于基准为红色、低于基准为绿色；英文相反（跟随各自市场的涨跌配色）。切换「劳动小时 / 美元标价」时，百分比按当前口径重新计算。

对比表默认是**紧凑模式**：基准城市显示绝对数值，其他城市只显示彩色百分比（列宽很窄，多选城市也不容易触发横向滚动）；顶部「显示数值」可以切回绝对值 + 百分比。项目列和基准列横向冻结，城市列可以滚动，右上角有左右滚动按钮。窗口窄于 768px 时表格自动换成「每项一张卡片、城市竖排」的布局，不再横向滚动。

城市 chips 可以拖动调整顺序，第一个城市就是基准；也可以用 chip 上的 ↑ 按钮把某座城市直接设为基准。手机浏览器不支持原生拖动，用 ↑ 按钮即可。拖动把手聚焦后还能用左右方向键微调顺序。

内置组合只保留「市中心外的月度生活」（市中心外一居 + 水电 + 宽带 + 公交月票，每项数量 1）；两个只含房租的旧预设已删除，因为它们和「单项对比」里的同名条目完全重复。自定义组合可以保存多份在本机（最多 20 份），每份有自己的名字、勾选、数量和摊销年数；刷新后还在。分享链接只带当前这一份，不带整个组合库。分享图用当前这份的名字做标题。没勾选的条目不显示数量。原标价口径下它是勾选项的「标价 × 数量」之和，再除以时薪；折合每月或每年后，数量表示这一周期里的次数、份数、件数或平方米，明细里同时写出摊销年数。

「单项对比 / 组合」是同一块视图面板上的两个 Tab，共享城市和工时。面板上的「分享」会复制当前地址（hash 里有城市、工时、税后月薪覆盖、按城市的融资参数、Tab、当前这一份组合、口径和显示币种，没有价格，也没有本机的组合库），下载当前表的 CSV，以及一张当前排行或当前组合的摘要图。刷新页面会按 hash 还原选择；本机已经有组合库时，链接里的自定义组合先作为草稿，可以再保存进来。条目在 `NUMBEO_ITEMS` 里的顺序就是链接用的下标，只能在末尾追加。设计见 `docs/plans/2026-11-16-combo-tab-design.md`。

## 目录

```text
web/           静态页面（Vite + React + shadcn/ui），浏览器里算劳动小时
worker/        Cloudflare Worker：/api/*、Numbeo 抓取、KV 缓存、限流
worker/catalog.js  城市目录（静态）
worker/test/   解析与路由测试
```
