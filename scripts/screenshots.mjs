// Capture showcase screenshots: menu, host in-game (pointer locked), joiner view.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader", "--mute-audio"] });
const a = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
const b = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();

const HOST = `Het${Math.random().toString(36).slice(2, 5)}`;
await a.goto("http://localhost:5173/");
await a.fill("#cc-name", HOST);
await a.screenshot({ path: "scripts/shot-menu.png" });

await a.click("text=Create a new world");
await a.waitForFunction(() => window.__cc?.world, undefined, { timeout: 30000 });

await b.goto("http://localhost:5173/");
await b.fill("#cc-name", "Friend");
await b.waitForFunction((h) => [...document.querySelectorAll(".world-row")].some((r) => r.textContent.includes(h)), HOST, { timeout: 60000 });
await b.click(`.world-row:has-text("${HOST}")`);
await b.waitForFunction(() => window.__cc?.world, undefined, { timeout: 90000 });

// build a small tower near spawn so the shot shows player-made structure
await a.evaluate(() => {
  const w = window.__cc;
  for (let y = 0; y < 4; y++) w.applyEdit(66, 30 + y, 64, 9);
  w.applyEdit(66, 34, 64, 6);
});
await a.waitForTimeout(2500);

// lock pointer on host for a clean HUD shot
await a.click(".overlay-panel .btn");
await a.waitForTimeout(1200);
await a.screenshot({ path: "scripts/shot-ingame.png" });
await b.click(".overlay-panel .btn");
await b.waitForTimeout(1200);
await b.screenshot({ path: "scripts/shot-friend.png" });

await browser.close();
console.log("saved: shot-menu.png, shot-ingame.png, shot-friend.png");
