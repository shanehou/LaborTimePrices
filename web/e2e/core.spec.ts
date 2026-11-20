import { expect, test } from "@playwright/test"
import {
  ITEMS,
  compareCell,
  openApp,
  rankingSection,
  selectCities,
  selectCity,
  waitForShareParam,
} from "./fixtures"

test.describe("core comparison flow", () => {
  test("shows the empty state before a city is selected", async ({ page }) => {
    await openApp(page)

    await expect(page.getByText("先在上面选一座城市，物价会按需获取并缓存。")).toBeVisible()
    await expect(page.getByText("至少选择一座城市").first()).toBeVisible()
    await expect(page.getByText("先在上面选择城市，再来排行。")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "数据来自 Numbeo" }),
    ).toHaveAttribute("href", "https://www.numbeo.com/cost-of-living/")
  })

  test("selects a city and renders the comparison and ranking", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")

    await expect(page.locator('[data-city-chip="1"]')).toBeVisible()
    await expect(page.getByLabel("Shanghai 的每月工时")).toHaveValue("150")
    await expect(page.getByLabel("Shanghai 的税后月薪")).toHaveValue("3000")
    await expect(page.getByText("城市自带")).toBeVisible()
    await expect(page.getByText("Numbeo 数据")).toBeVisible()

    const table = page.locator("table").first()
    await expect(table.getByText("卡布奇诺（常规杯）")).toBeVisible()
    await expect(table.getByText("市中心外一居室")).toBeVisible()

    const ranking = rankingSection(page)
    const row = ranking.locator('li[data-city="1"]')
    await expect(row).toContainText("Shanghai")
    await expect(row).toContainText("0.25 小时（15 分钟）")
    await expect(row).toContainText("US$5.00")
  })

  test("keeps hours and salary overrides after reload", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")

    const ranking = rankingSection(page)
    await expect(ranking.getByText("已按你的收入")).toHaveCount(0)
    await expect(ranking.getByText("已按你的工时")).toHaveCount(0)

    const salary = page.getByLabel("Shanghai 的税后月薪")
    await salary.fill("6000")
    await salary.press("Tab")
    await expect(ranking.getByText("已按你的收入")).toBeVisible()
    await expect(ranking.getByText("已按你的工时")).toHaveCount(0)

    const hours = page.getByLabel("Shanghai 的每月工时")
    await hours.fill("120")
    await hours.press("Tab")
    await expect(ranking.getByText("已按你的工时")).toBeVisible()
    await expect(ranking.getByText("已按你的收入")).toBeVisible()

    await waitForShareParam(page, "sa", "1:6000")
    await waitForShareParam(page, "h", "1:120")
    await page.reload()

    await expect(page.getByLabel("Shanghai 的每月工时")).toHaveValue("120")
    await expect(page.getByLabel("Shanghai 的税后月薪")).toHaveValue("6000")
    const reloadedRanking = rankingSection(page)
    await expect(reloadedRanking.getByText("已按你的工时")).toBeVisible()
    await expect(reloadedRanking.getByText("已按你的收入")).toBeVisible()
  })

  test("accepts an annual income and keeps it as a monthly override", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")

    await page.getByRole("radio", { name: "按年" }).click()
    const annual = page.getByLabel("Shanghai 的税后年薪")
    await expect(annual).toHaveValue("36000")

    await annual.fill("72000")
    await annual.press("Tab")
    await waitForShareParam(page, "sa", "1:6000")
    await expect(rankingSection(page).getByText("已按你的收入")).toBeVisible()

    await page.getByRole("radio", { name: "按月" }).click()
    await expect(page.getByLabel("Shanghai 的税后月薪")).toHaveValue("6000")
  })

  test("compares cities, shows deltas, and changes the baseline", async ({ page }) => {
    await openApp(page)
    await selectCities(page, ["Shanghai", "Zurich"])

    await expect(page.locator('[data-city-chip="1"]')).toHaveAttribute("data-index", "0")
    await expect(page.locator('[data-city-chip="2"]')).toHaveAttribute("data-index", "1")
    await expect(page.locator('th[data-city="1"]').getByText("基准")).toBeVisible()
    await expect(page.locator('th[data-city="2"]').getByText("基准")).toHaveCount(0)

    const delta = compareCell(page, "2", ITEMS.coffee).locator("[data-delta]")
    await expect(delta).toHaveAttribute("data-delta", "-14.7")
    await expect(delta).toHaveAttribute("data-tone", "green")

    await page.getByRole("button", { name: "把 Zurich 设为基准" }).click()
    await expect(page.locator('[data-city-chip="2"]')).toHaveAttribute("data-index", "0")
    await expect(page.locator('th[data-city="2"]').getByText("基准")).toBeVisible()
    await expect(page.locator('th[data-city="1"]').getByText("基准")).toHaveCount(0)
    await expect(page.locator('th[data-city]').first()).toHaveAttribute("data-city", "2")
  })

  test("switches units and reveals absolute values", async ({ page }) => {
    await openApp(page)
    await selectCities(page, ["Shanghai", "Zurich"])

    const shanghaiCoffee = compareCell(page, "1", ITEMS.coffee)
    const zurichCoffee = compareCell(page, "2", ITEMS.coffee)
    await expect(shanghaiCoffee).toContainText("0.25 小时（15 分钟）")

    await page.getByText("USD 标价", { exact: true }).click()
    await expect(shanghaiCoffee).toContainText("US$5.00")
    await expect(zurichCoffee).not.toContainText("US$8.00")

    await page.getByText("显示数值", { exact: true }).click()
    await expect(zurichCoffee).toContainText("US$8.00")

    await page.getByText("劳动小时", { exact: true }).click()
    await expect(shanghaiCoffee).toContainText("0.25 小时（15 分钟）")
  })

  test("changes the ranking target item", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")

    await page.locator("#rank-target").click()
    await page.getByRole("option", { name: "市中心外一居室" }).click()

    const row = rankingSection(page).locator('li[data-city="1"]')
    await expect(row).toContainText("45 小时")
  })

  test("persists language and display currency", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")

    await page.getByText("English", { exact: true }).click()
    await expect(page.getByRole("combobox", { name: "Cities" })).toBeVisible()
    await expect(page.getByRole("heading", { name: /The same things/ })).toBeVisible()

    await page.getByRole("combobox", { name: "Currency" }).click()
    await page.getByRole("option", { name: "CNY" }).click()
    await expect(page.getByLabel("Monthly net salary for Shanghai")).toHaveValue("21600")
    await expect(page.getByText("Rates 2026-11-19")).toBeVisible()
    await expect(page.locator('ol li[data-city="1"]')).toContainText("CN¥36.00")

    await waitForShareParam(page, "lang", "en")
    await waitForShareParam(page, "cur", "CNY")
    await waitForShareParam(page, "c", "1")
    await page.reload()
    await expect(page.getByRole("combobox", { name: "Cities" })).toBeVisible()
    await expect(page.getByLabel("Monthly net salary for Shanghai")).toHaveValue("21600")
    await expect(page.getByRole("heading", { name: /The same things/ })).toBeVisible()
  })

  test("resets hours and salary back to the city values", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")

    const salary = page.getByLabel("Shanghai 的税后月薪")
    const hours = page.getByLabel("Shanghai 的每月工时")
    await salary.fill("6000")
    await hours.fill("120")
    await hours.press("Tab")

    const ranking = rankingSection(page)
    await expect(ranking.getByText("已按你的工时")).toBeVisible()
    await expect(ranking.getByText("已按你的收入")).toBeVisible()

    const field = page.locator("li").filter({ has: salary })
    await field.getByRole("button", { name: "恢复" }).first().click()
    await expect(hours).toHaveValue("150")
    await expect(ranking.getByText("已按你的工时")).toHaveCount(0)
    await expect(ranking.getByText("已按你的收入")).toBeVisible()

    await field.getByRole("button", { name: "恢复" }).nth(1).click()
    await expect(salary).toHaveValue("3000")
    await expect(ranking.getByText("已按你的收入")).toHaveCount(0)
  })

  test("reorders cities with the keyboard handle", async ({ page }) => {
    await openApp(page)
    await selectCities(page, ["Shanghai", "Zurich"])

    const shanghaiHandle = page.getByRole("button", { name: "拖动 Shanghai 调整顺序" })
    await shanghaiHandle.focus()
    await shanghaiHandle.press("ArrowRight")

    await expect(page.locator('[data-city-chip="1"]')).toHaveAttribute("data-index", "1")
    await expect(page.locator('[data-city-chip="2"]')).toHaveAttribute("data-index", "0")

    const zurichHandle = page.getByRole("button", { name: "拖动 Zurich 调整顺序" })
    await zurichHandle.focus()
    await zurichHandle.press("ArrowRight")
    await expect(page.locator('[data-city-chip="1"]')).toHaveAttribute("data-index", "0")
  })

  test("removes a selected city", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Shanghai")

    await page.getByRole("button", { name: "移除 Shanghai" }).click()
    await expect(page.locator('[data-city-chip="1"]')).toHaveCount(0)
    await expect(page.getByText("先在上面选一座城市，物价会按需获取并缓存。")).toBeVisible()
    await expect(page.getByText("先在上面选择城市，再来排行。")).toBeVisible()
  })

  test("uses the mobile card layout on a narrow viewport", async ({ page }) => {
    await openApp(page)
    await selectCities(page, ["Shanghai", "Zurich"])
    await page.setViewportSize({ width: 390, height: 844 })

    await expect(page.locator("[data-compare-cards]")).toBeVisible()
    await expect(page.locator('th[data-city="1"]')).toBeHidden()
    await expect(page.getByRole("heading", { name: "排行" })).toBeVisible()
  })
})
