// Visual verification of the three fixes:
//   1. held block renders OVER water/clouds (render order)
//   3. atlas textures correct + no mip bleed + reduced distant shimmer (AA)
// (fix 2, water-exit, is dynamic physics — logic-verified, not screenshot-verified)
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));

await page.goto("http://localhost:5173/");
await page.fill("#cc-name", "Verify");
await page.click("text=Create a new world");
await page.waitForFunction(() => window.__cc?.world && window.__rig && window.__ui, undefined, { timeout: 30000 });
// force locked state to hide the pause overlay (headless can't pointer-lock)
await page.evaluate(() => window.__ui.getState().setLocked(true));
await page.waitForTimeout(400);

// ---- Shot A: held block over a water pool (render-order fix) ----
const aInfo = await page.evaluate(() => {
  const w = window.__cc.world, rig = window.__rig, edit = window.__cc.applyEdit;
  const H = w.heightAt(8, 8) + 1;
  rig.flying = true; rig.vel.set(0, 0, 0);
  rig.pos.set(8.5, H + 2, 8.5);
  rig.yaw = 0;            // look toward -Z
  rig.pitch = -0.55;      // tilt down at the pool
  // carve a water pool in front of the camera (toward -Z)
  const wy = H;
  for (let x = 4; x <= 13; x++) {
    for (let z = -4; z <= 4; z++) {
      edit(x, wy - 1, z, 3);        // stone floor
      edit(x, wy, z, 12);           // water surface
      edit(x, wy + 1, z, 0);        // air above
      edit(x, wy + 2, z, 0);
    }
  }
  return { H };
});
await page.waitForTimeout(2800); // let chunks remesh
await page.screenshot({ path: "scripts/fix-hand-water.png" });

// ---- Shot B: distant terrain (atlas correctness, shimmer, no bleed) ----
await page.evaluate(() => {
  const w = window.__cc.world, rig = window.__rig;
  const H = w.heightAt(8, 8);
  rig.flying = true; rig.vel.set(0, 0, 0);
  rig.pos.set(8.5, H + 22, 8.5);
  rig.yaw = 0.7;
  rig.pitch = -0.18; // near-horizontal to maximise grazing-angle texture aliasing
});
await page.waitForTimeout(3000);
await page.screenshot({ path: "scripts/fix-distant.png" });

// ---- Shot C: near ground (texture identity / UV correctness) ----
await page.evaluate(() => {
  const w = window.__cc.world, rig = window.__rig;
  const H = w.heightAt(20, 20);
  rig.flying = true; rig.vel.set(0, 0, 0);
  rig.pos.set(20.5, H + 2.2, 20.5);
  rig.yaw = 0.4;
  rig.pitch = -0.5;
});
await page.waitForTimeout(2500);
await page.screenshot({ path: "scripts/fix-near.png" });

console.log("info:", JSON.stringify(aInfo));
console.log("saved fix-hand-water.png, fix-distant.png, fix-near.png");
await browser.close();
