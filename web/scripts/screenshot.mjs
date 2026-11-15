// Screenshots the landing page and every onboarding step at 1440 and 390 wide.
// Usage: node scripts/screenshot.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = path.resolve(process.cwd(), "../.impeccable/review");
await mkdir(outDir, { recursive: true });

const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
for (const size of sizes) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    timezoneId: "America/Chicago",
  });
  const page = await context.newPage();
  const shot = async (name, fullPage = true) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const file = path.join(outDir, name === "landing" ? `${size.name}.png` : `${name}-${size.name}.png`);
    await page.screenshot({ path: file, fullPage });
    console.log("wrote", file);
  };

  await page.goto(base + "/", { waitUntil: "networkidle" });
  await shot("landing", size.name === "desktop" ? false : true);

  await page.goto(base + "/onboarding", { waitUntil: "networkidle" });
  await shot("step1");
  await page.getByRole("button", { name: "Continue" }).click();
  await shot("step1-errors");

  await page.getByLabel("Their name").fill("Margaret Nguyen");
  await page.getByLabel("Their iPhone number").fill("(214) 555-0134");
  await page.getByLabel("Date of birth (optional)").fill("1944-03-12");
  await page.getByLabel("Feet").fill("5");
  await page.getByLabel("Inches").fill("3");
  await page.getByLabel("Pounds").fill("128");
  await page.getByRole("button", { name: "Continue" }).click();
  await shot("step2");

  await page.getByLabel("Family phone number (optional)").fill("214 555 0199");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Metformin");
  await page.getByLabel("Dosage").fill("1 tablet, 500 mg");
  await page.getByRole("button", { name: "+ Add another time" }).click();
  await page.locator("#med-0-time-1").fill("20:00");
  await page.getByRole("button", { name: "Save and finish" }).click();
  await shot("step3-meal-error");
  await page.getByRole("radio", { name: /Yes/ }).check();
  await shot("step3");

  await page.getByRole("button", { name: "Save and finish" }).click();
  await shot("step3-save");
  await context.close();
}
await browser.close();
