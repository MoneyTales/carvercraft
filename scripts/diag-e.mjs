import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader", "--mute-audio"] });
const page = await browser.newPage();
page.on("console", (m) => ["error", "warning", "log"].includes(m.type()) && console.log(`[${m.type()}]`, m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 400)));
await page.goto("http://localhost:5173/");
await page.fill("#cc-name", "DiagBot");
await page.click("text=Create a new world");
await page.waitForTimeout(12000);
const st = await page.evaluate(() => ({
  hasWorld: !!window.__cc?.world,
  conn: window.__room?.connectionState,
  overlay: document.querySelector(".overlay-panel p")?.textContent,
}));
console.log("STATE:", JSON.stringify(st));
await browser.close();
