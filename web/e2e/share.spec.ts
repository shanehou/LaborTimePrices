import { readFile, stat } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import {
  mockApi,
  openApp,
  openCombosTab,
  rankingSection,
  selectCity,
  waitForShareParam,
} from "./fixtures"

async function openShare(page: Parameters<typeof openApp>[0]) {
  await page.getByRole("button", { name: "分享" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  return page.getByRole("dialog")
}

test.describe("sharing and export", () => {
  test("restores cities, overrides, and visitor badges from a shared link", async ({
    page,
  }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")
    await page.getByLabel("Shanghai 的税后月薪").fill("6000")
    await page.getByLabel("Shanghai 的每月工时").fill("120")
    await page.getByLabel("Shanghai 的每月工时").press("Tab")

    await waitForShareParam(page, "c", "1")
    await waitForShareParam(page, "sa", "1:6000")
    await waitForShareParam(page, "h", "1:120")
    const hash = await page.evaluate(() => window.location.hash)

    const browser = page.context().browser()
    if (!browser) throw new Error("Missing browser")
    const recipientContext = await browser.newContext({ locale: "zh-CN" })
    const recipient = await recipientContext.newPage()
    await mockApi(recipient)
    await recipient.goto(`/${hash}`)

    await expect(recipient.getByLabel("Shanghai 的每月工时")).toHaveValue("120")
    await expect(recipient.getByLabel("Shanghai 的税后月薪")).toHaveValue("6000")
    const ranking = rankingSection(recipient)
    await expect(ranking.getByText("已按你的工时")).toBeVisible()
    await expect(ranking.getByText("已按你的收入")).toBeVisible()

    await recipientContext.close()
  })

  test("copies a share link from the dialog", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await openApp(page)
    await selectCity(page, "Shanghai")

    const dialog = await openShare(page)
    await dialog.getByRole("button", { name: "复制链接" }).click()
    await expect(dialog.getByRole("button", { name: "已复制" })).toBeVisible()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain("#s=1")
    expect(copied).toContain("c=1")
  })

  test("downloads the current table as CSV", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")
    const dialog = await openShare(page)

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "下载 CSV" }).click(),
    ])
    expect(download.suggestedFilename()).toBe("ltp-items-listed.csv")
    const path = await download.path()
    if (!path) throw new Error("Missing download path")
    const csv = await readFile(path, "utf8")
    expect(csv).toContain("支出")
    expect(csv).toContain("Shanghai")
    expect(csv).toContain("卡布奇诺（常规杯）")
  })

  test("downloads the current combo as CSV", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")
    await openCombosTab(page)
    await page.getByRole("button", { name: "新建组合" }).click()
    await page.getByLabel("组合名称").fill("我的组合")
    await page.getByRole("checkbox", { name: "卡布奇诺（常规杯）" }).check()
    await page.getByLabel(/卡布奇诺（常规杯）\s*的数量/).fill("2")

    const dialog = await openShare(page)
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "下载 CSV" }).click(),
    ])
    expect(download.suggestedFilename()).toBe("我的组合.csv")
    const path = await download.path()
    if (!path) throw new Error("Missing download path")
    const csv = await readFile(path, "utf8")
    expect(csv).toContain("合计")
    expect(csv).toContain("卡布奇诺（常规杯）")
    expect(csv).toContain("Shanghai")
  })

  test("downloads the share card as an image", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")
    const dialog = await openShare(page)

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 20_000 }),
      dialog.getByRole("button", { name: "下载图片" }).click(),
    ])
    expect(download.suggestedFilename()).toBe("ltp-items-listed.png")
    const path = await download.path()
    if (!path) throw new Error("Missing download path")
    const info = await stat(path)
    expect(info.size).toBeGreaterThan(1_000)
  })

  test("keeps an incoming custom combo as a draft when combos already exist", async ({
    page,
  }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")
    await openCombosTab(page)
    await page.getByRole("button", { name: "新建组合" }).click()
    await page.getByRole("checkbox", { name: "卡布奇诺（常规杯）" }).check()
    await page.getByLabel(/卡布奇诺（常规杯）\s*的数量/).fill("2")

    await waitForShareParam(page, "bt", "custom")
    await waitForShareParam(page, "b", "5:2")
    const hash = await page.evaluate(() => window.location.hash)

    const browser = page.context().browser()
    if (!browser) throw new Error("Missing browser")
    const recipientContext = await browser.newContext({ locale: "zh-CN" })
    await recipientContext.addInitScript(() => {
      localStorage.setItem(
        "ltp.combos",
        JSON.stringify({
          combos: [{ id: "seed", name: "已有组合", basket: {}, years: {}, rates: {}, repayments: {} }],
          activeId: "seed",
        }),
      )
    })
    const recipient = await recipientContext.newPage()
    await mockApi(recipient)
    await recipient.goto(`/${hash}`)

    await expect(recipient.getByText("来自分享")).toBeVisible()
    const save = recipient.getByRole("button", { name: "保存到我的组合" })
    await expect(save).toBeVisible()
    await expect(recipient.getByRole("checkbox", { name: "卡布奇诺（常规杯）" })).toBeChecked()
    await save.click()

    await expect(recipient.getByText("来自分享")).toHaveCount(0)
    await expect
      .poll(() =>
        recipient.evaluate(() => {
          const raw = localStorage.getItem("ltp.combos")
          return raw ? (JSON.parse(raw) as { combos: unknown[] }).combos.length : -1
        }),
      )
      .toBe(2)

    await recipientContext.close()
  })

  test("restores a shared custom combo", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")
    await openCombosTab(page)
    await page.getByRole("button", { name: "新建组合" }).click()
    await page.getByLabel("组合名称").fill("分享组合")
    await page.getByRole("checkbox", { name: "卡布奇诺（常规杯）" }).check()
    await page.getByLabel(/卡布奇诺（常规杯）\s*的数量/).fill("2")

    await waitForShareParam(page, "bt", "custom")
    await waitForShareParam(page, "cn", "分享组合")
    await waitForShareParam(page, "b", "5:2")
    const hash = await page.evaluate(() => window.location.hash)

    const browser = page.context().browser()
    if (!browser) throw new Error("Missing browser")
    const recipientContext = await browser.newContext({ locale: "zh-CN" })
    const recipient = await recipientContext.newPage()
    await mockApi(recipient)
    await recipient.goto(`/${hash}`)

    await expect(recipient.getByRole("tab", { name: /^组合/ })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    await expect(recipient.getByLabel("组合名称")).toHaveValue("分享组合")
    await expect(recipient.getByRole("checkbox", { name: "卡布奇诺（常规杯）" })).toBeChecked()
    await expect(recipient.getByLabel(/卡布奇诺（常规杯）\s*的数量/)).toHaveValue("2")

    await recipientContext.close()
  })
})
