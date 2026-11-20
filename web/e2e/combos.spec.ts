import { expect, test } from "@playwright/test"
import {
  openApp,
  openCombosTab,
  selectCities,
  selectCity,
  waitForShareParam,
} from "./fixtures"

test.describe("combo flow", () => {
  test("shows the built-in monthly living combo and its totals", async ({ page }) => {
    await openApp(page)
    await selectCities(page, ["Shanghai", "Zurich"])
    await openCombosTab(page)

    const preset = page.getByRole("button", { name: /市中心外的月度生活/ })
    await expect(preset).toHaveAttribute("aria-pressed", "true")

    const detail = page.locator("table").first()
    await expect(detail).toContainText("市中心外一居室")
    await expect(detail).toContainText("54 小时")
    await expect(detail).toContainText("64 小时")
  })

  test("creates, persists, and deletes a custom combo", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")
    await openCombosTab(page)

    await page.getByRole("button", { name: "新建组合" }).click()
    await expect(page.getByRole("heading", { name: "自定义组合" })).toBeVisible()

    const name = page.getByLabel("组合名称")
    await name.fill("我的组合")

    const coffee = page.getByRole("checkbox", { name: "卡布奇诺（常规杯）" })
    await coffee.check()
    const quantity = page.getByLabel(/卡布奇诺（常规杯）\s*的数量/)
    await quantity.fill("2")

    const detail = page.locator("table").first()
    await expect(detail).toContainText("0.5 小时（30 分钟）")

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("ltp.combos")
          return raw ? JSON.stringify(JSON.parse(raw)) : ""
        }),
      )
      .toContain("我的组合")

    await waitForShareParam(page, "cn", "我的组合")
    await page.reload()

    await expect(page.getByLabel("组合名称")).toHaveValue("我的组合")
    await expect(page.getByRole("checkbox", { name: "卡布奇诺（常规杯）" })).toBeChecked()
    await expect(page.getByLabel(/卡布奇诺（常规杯）\s*的数量/)).toHaveValue("2")

    await page.getByRole("button", { name: "删除" }).click()
    await page.getByRole("button", { name: "确认删除" }).click()

    await expect(page.getByRole("button", { name: /市中心外的月度生活/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await expect(page.getByRole("heading", { name: "自定义组合" })).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("ltp.combos")
          return raw ? (JSON.parse(raw) as { combos: unknown[] }).combos.length : -1
        }),
      )
      .toBe(0)
  })

  test("warns when a custom combo has no checked items", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")
    await openCombosTab(page)

    await page.getByRole("button", { name: "新建组合" }).click()
    await expect(page.getByText("这个组合还没有条目。").first()).toBeVisible()
    await expect(page.getByText("至少勾选一项。")).toBeVisible()
  })

  test("stores a per-city financing override for a purchase", async ({ page }) => {
    await openApp(page)
    await selectCities(page, ["Shanghai", "Zurich"])
    await openCombosTab(page)

    await page.getByRole("button", { name: "新建组合" }).click()
    await page
      .getByRole("checkbox", { name: "大众高尔夫 1.5（或同类新紧凑型车）" })
      .check()
    await page.getByText("折合每月", { exact: true }).click()

    await page.getByRole("button", { name: "按城市" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("大众高尔夫 1.5（或同类新紧凑型车）：按城市设置")

    const shanghaiRow = dialog.locator("tbody tr").filter({ hasText: "Shanghai" })
    await shanghaiRow.getByLabel(/大众高尔夫 1\.5（或同类新紧凑型车）\s*的摊销年数/).fill("5")
    await shanghaiRow.getByLabel(/大众高尔夫 1\.5（或同类新紧凑型车）\s*的年利率/).fill("3")
    await shanghaiRow
      .getByRole("combobox", { name: /大众高尔夫 1\.5（或同类新紧凑型车）\s*的还款方式/ })
      .click()
    await page.getByRole("option", { name: "等额本金" }).click()
    await page.keyboard.press("Escape")

    await expect(page.getByText("已单独设置 1 城")).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("ltp.usageOverrides")))
      .toContain('"1":5')

    await waitForShareParam(page, "yc", "32:1:5")
    await page.reload()
    await expect(page.getByText("已单独设置 1 城")).toBeVisible()
  })
})
