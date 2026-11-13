# 劳动小时

把一笔标价换成「在这座城市要工作多少小时」。年费按年算，月租按月算，标价不会再除以 12。

页面是静态的 Vite + React 站点，部署在 Cloudflare Pages，域名 `ltp.melkor.me`。物价是另一份 `prices.json`，放在 R2 里，由 Worker 在 `GET /prices.json` 读出来。改界面才重新构建页面；改物价只上传这一个文件。

计算在浏览器里完成。访客改过的每月工时和语言只写在自己的 localStorage 里。

## 本地运行

```bash
cd web
npm install
npm run dev
```

没有 `data/prices.json` 时，开发服务器对 `/prices.json` 返回 404，页面改用仓库里的四座城市模拟数据，并在页脚写出原因。

要在本地看一份真实格式的数据，把样例复制过去再改（样例本身不会被当作线上或开发数据）：

```bash
cp data/prices.example.json data/prices.json
```

`data/prices.json` 已在 `.gitignore` 里。页面构建不会把它打进产物；线上页面启动时再去请求 `/prices.json`。请求失败、超时或格式不对时，仍回落到模拟数据，并说明原因。

```bash
cd web
npm test
npm run build
```

## 只上传物价

这一步不构建、也不部署页面。先建一次存储桶：

```bash
npx wrangler r2 bucket create labor-time-prices
```

之后每次只更新物价：

```bash
npx wrangler r2 object put labor-time-prices/prices.json \
  --file data/prices.json \
  --content-type application/json
```

或：

```bash
./scripts/upload-prices.sh
```

`GET /prices.json` 由 `worker/` 从 R2 对象 `prices.json` 读出，`Cache-Control` 大约 5 分钟。Worker 不访问 Numbeo，仓库里也没有采集脚本。

```bash
npx wrangler deploy --config worker/wrangler.toml
```

路由是 `ltp.melkor.me/prices.json`。其余路径仍由 Pages 提供。

## 只部署页面

这一步不上传 R2 里的物价。

```bash
cd web
npm run build
npx wrangler pages deploy dist --project-name ltp
```

在该 Pages 项目上把自定义域名设为 `ltp.melkor.me`（只需一次）。静态资源在 `/assets/` 下带内容哈希，可以长期缓存。

## 公式

```text
时薪 = 该城税后月薪 / 每月工作小时
劳动小时 = 美元标价 / 时薪
```

默认每月工时是 173.3（每周 40 小时 × 52 / 12）。某座城市可以在 JSON 里写 `monthly_work_hours`。同一个 `item` 字符串表示同一项支出。没有正数月薪、工时或标价的城市不参与该项排行，格子里会写明原因。

内置篮子：市中心外一居月租、市中心一居月租、以及市中心外一居 + 水电 + 宽带 + 公交月票（每项数量 1）。自定义篮子是勾选项的「标价 × 数量」之和，再除以时薪。
