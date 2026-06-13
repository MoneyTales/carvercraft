import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:5173/");
await page.fill("#cc-name", "Verify");
await page.click("text=Create a new world");
await page.waitForFunction(() => window.__cc?.world && window.__rig && window.__ui, undefined, { timeout: 30000 });
await page.evaluate(() => window.__ui.getState().setLocked(true));

await page.evaluate(() => {
  const w = window.__cc.world, rig = window.__rig, edit = window.__cc.applyEdit;
  const H = w.heightAt(8, 8);
  const wy = H + 1;
  // large water pool around the player
  for (let x = -10; x <= 26; x++)
    for (let z = -18; z <= 18; z++) {
      edit(x, wy - 1, z, 3);
      edit(x, wy, z, 12);
      edit(x, wy + 1, z, 0);
      edit(x, wy + 2, z, 0);
      edit(x, wy + 3, z, 0);
    }
  rig.flying = true; rig.vel.set(0, 0, 0);
  rig.pos.set(8.5, wy + 0.5, 8.5); // eye ~2 above the water surface, standing in the pool
  rig.yaw = 0;
  rig.pitch = -0.22;               // slight downward tilt so water fills the lower frame
});
await page.waitForTimeout(3000);
await page.screenshot({ path: "scripts/fix-hand-water2.png" });
console.log("saved fix-hand-water2.png");
await browser.close();
