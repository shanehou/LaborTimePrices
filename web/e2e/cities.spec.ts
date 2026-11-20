import { expect, test } from "@playwright/test"
import {
  ITEMS,
  chooseCity,
  compareCell,
  mockApi,
  openApp,
  rankingSection,
  selectCity,
} from "./fixtures"

test.describe("city loading and search", () => {
  test("retries the catalog after a failure", async ({ page }) => {
    await mockApi(page, { catalogFailures: 1 })
    await page.goto("/")

    await expect(page.getByText("城市目录加载失败。")).toBeVisible()
    await expect(page.getByText("服务器返回了错误。")).toBeVisible()
    await page.getByRole("button", { name: "重试" }).click()

    await expect(page.getByRole("combobox", { name: "城市" })).toBeVisible()
  })

  test("retries a city after a loading failure", async ({ page }) => {
    await openApp(page, { cityFailures: { "2": 1 } })
    await chooseCity(page, "Zurich")

    await expect(page.getByText("Zurich 加载失败。")).toBeVisible()
    await expect(page.getByText("服务器返回了错误。")).toBeVisible()
    await page.getByRole("button", { name: "重试" }).click()

    await expect(page.getByLabel("Zurich 的每月工时")).toBeVisible()
    await expect(page.locator('[data-city-chip="2"]')).toBeVisible()
  })

  test("finds a city outside the catalog through Numbeo search", async ({ page }) => {
    await openApp(page)
    await chooseCity(page, "Cambridge")

    await expect(page.getByLabel("Cambridge 的每月工时")).toBeVisible()
    await expect(page.locator('[data-city-chip="9"]')).toBeVisible()
    await expect(page.getByLabel("Cambridge 的税后月薪")).toHaveValue("5000")
  })

  test("recovers after a remote search failure", async ({ page }) => {
    await openApp(page, { searchFailures: 1 })
    await page.getByRole("combobox", { name: "城市" }).click()
    const popover = page.locator('[data-slot="popover-content"]')
    await popover.getByPlaceholder("搜索城市或国家").fill("Cambridge")

    await expect(popover.getByText("Numbeo 搜索失败。")).toBeVisible()
    await expect(popover.getByText("服务器返回了错误。")).toBeVisible()

    await page.keyboard.press("Escape")
    await page.getByRole("combobox", { name: "城市" }).click()
    await popover.getByPlaceholder("搜索城市或国家").fill("Cambridge")
    const option = popover.getByText("Cambridge", { exact: true })
    await expect(option).toBeVisible()
    await option.evaluate((element) => (element as HTMLElement).click())

    await expect(page.getByLabel("Cambridge 的每月工时")).toBeVisible()
  })

  test("explains why a city without a salary is excluded", async ({ page }) => {
    await openApp(page)
    await selectCity(page, "Lisbon")

    await expect(page.getByLabel("Lisbon 的税后月薪")).toHaveValue("")
    await expect(compareCell(page, "3", ITEMS.coffee)).toContainText("没有税后月薪")

    const ranking = rankingSection(page)
    await expect(ranking.getByText("未计入")).toBeVisible()
    await expect(ranking.getByText("Lisbon: 没有税后月薪")).toBeVisible()
    await expect(ranking.locator('li[data-city="3"]')).toHaveCount(0)
  })
})
