// Functional test of the water-exit fix: drop the player floating in a pool
// against a 1-block shore, hold forward, and assert they climb out onto land
// instead of bobbing against the wall.
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));
await page.goto("http://localhost:5173/");
await page.fill("#cc-name", "Verify");
await page.click("text=Create a new world");
await page.waitForFunction(() => window.__cc?.world && window.__rig && window.__ui, undefined, { timeout: 30000 });
await page.evaluate(() => window.__ui.getState().setLocked(true));

const start = await page.evaluate(() => {
  const rig = window.__rig, edit = window.__cc.applyEdit;
  const W = 30;
  // 3-deep water pool x=2..10
  for (let x = 2; x <= 10; x++)
    for (let z = -3; z <= 3; z++) {
      edit(x, 27, z, 3);
      edit(x, 28, z, 12); edit(x, 29, z, 12); edit(x, 30, z, 12);
      edit(x, 31, z, 0); edit(x, 32, z, 0);
    }
  // wide shore: solid up to y=30 (top at 31), 1 block above the water surface
  for (let x = 11; x <= 40; x++)
    for (let z = -6; z <= 6; z++) {
      for (let y = 27; y <= 30; y++) edit(x, y, z, 1);
      edit(x, 31, z, 0); edit(x, 32, z, 0);
    }
  rig.flying = false; rig.vel.set(0, 0, 0);
  rig.pos.set(9.5, 30.3, 0.5); // floating at the surface
  rig.yaw = -Math.PI / 2;       // face +X toward the shore
  rig.pitch = 0;
  return { x: rig.pos.x, y: rig.pos.y };
});

await page.waitForTimeout(1500);       // let the pool mesh + settle in water
await page.keyboard.down("w");          // swim forward into the shore
await page.waitForTimeout(3000);
await page.keyboard.up("w");
await page.waitForTimeout(500);

const end = await page.evaluate(() => ({ x: window.__rig.pos.x, y: window.__rig.pos.y, inWater: window.__rig.inWater }));
const climbedOut = end.x > 12 && end.y > 30.8 && !end.inWater;
console.log("start:", JSON.stringify(start));
console.log("end:  ", JSON.stringify(end));
console.log(climbedOut ? "PASS: player climbed out of the water onto the shore" : "FAIL: player did not climb out");
await page.screenshot({ path: "scripts/fix-waterexit.png" });
await browser.close();
process.exitCode = climbedOut ? 0 : 1;
