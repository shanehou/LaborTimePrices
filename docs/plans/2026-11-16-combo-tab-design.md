# 组合 Tab 设计（2026-11-16）

## 背景与问题

- 「组合」（原「篮子」）目前只是排行下拉里的一个 target，结果只有一个总劳动小时 / 总美元数字；用户看不到它由哪些条目组成、各多少数量、各城单价。
- 3 个预设的内容只有选中时的一行灰色小字 hint，自定义组合连这行都没有。
- 组合编辑区在页面最底部，用户勾选后还要回到上面的「按这项排」下拉切换 target，操作流程是断的。
- 3 个预设里 2 个只含 1 项（市中心外一居、市中心一居），与「单笔支出」里的同名条目结果完全相同，属于重复，也让人疑惑"这算哪门子组合"。

## 已确认的决策

1. 顶部加整页 Tab：「单项对比」/「组合」。用同页 `useState` 切换，**不引入路由依赖、不做独立 URL**（将来要可分享链接再升级 hash 路由）。全局区（语言、城市选择、每月工时）留在 Tab 之上共享，切换不丢状态。
2. 「单项对比」Tab = 现有 `CompareTable`（逐项并列表 + 劳动小时/美元切换）+ 单项排行（下拉只留「单笔支出」分组）。
3. 「组合」Tab = 组合选择器 → 组合内容明细 → 自定义组合编辑器 → 按组合的城市排行。
4. 预设只保留「市中心外的月度生活」+「自定义组合」，删掉两个单项目预设（Tab 1 已负责单项对比）。
5. 预设卡片**直接列出条目与数量**，替掉 hint 小字；支持「以此为基础编辑」，把预设内容填进自定义组合。
6. 组合明细表：行 = 条目（中文名 + 数量），列 = 已选城市，单元格 = 该城单价 × 数量；合计行 = 总美元与折合劳动小时（复用 `evaluateBasket`，与排行口径一致）。
7. 计算层完全复用：`linesForTarget` / `evaluateBasket` / `rankCities` / `findPrice` 都不改；只新增 `tab` 状态和纯函数 `comboDetail`。不动 Worker、数据结构、抓取逻辑。
8. `comboDetail` 抽成纯函数并加单测。项目 vitest 是 node 环境、没有组件测试库，因此不引入 `@testing-library` / jsdom，UI 部分沿用 README 手工验收。
9. 不做（YAGNI）：路由/独立页面、组合保存与分享、多组对比、把代码内部 `BASKETS` / `evaluateBasket` 等命名全量重命名（只改用户可见文案与 UI 结构，避免大范围 churn）。

## 状态与数据流

- `App` 新增 `tab: "items" | "combos"`。
- 原 `target` 拆成 `itemTarget`（单项 Tab）与 `comboTarget`（组合 Tab），避免来回切 Tab 时把组合 target 带进单项排行。
- `custom`（自定义组合勾选）、`overrides`（工时）、`selected` 城市保持全局；两个 Tab 只是渲染分支。
- `lines` 分别由 `linesForTarget(itemTarget|comboTarget, custom)` 得到；明细表与排行共用同一份 lines。

## 文件影响

- 新增：`web/src/components/ComboPanel.tsx`、`web/src/lib/combo.ts`、`web/src/lib/combo.test.ts`、本文档。
- 修改：`App.tsx`、`Ranking.tsx`、`data/items.ts`、`i18n/en.ts`、`i18n/zh.ts`、`lib/rankTarget.test.ts`、`README.md`。
- 复用不改：`CompareTable.tsx`、`BasketEditor.tsx`、`labor.ts`、`rankTarget.ts`、`worker/*`。
