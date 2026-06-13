// Two-peer end-to-end smoke test:
//   peer A creates a world, peer B discovers + joins it via the lobby,
//   then block edits are asserted to replicate in BOTH directions.
// Run: node scripts/verify-multiplayer.mjs [url]
import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:5173/";
const HOST = `Host${Math.random().toString(36).slice(2, 7)}`;
const ok = (label) => console.log(`  PASS  ${label}`);
const fail = (label, extra = "") => {
  console.error(`  FAIL  ${label} ${extra}`);
  process.exitCode = 1;
};

async function waitFor(page, fn, label, timeout = 45000) {
  try {
    await page.waitForFunction(fn, undefined, { timeout });
    ok(label);
    return true;
  } catch {
    fail(label, "(timeout)");
    return false;
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--mute-audio"],
});

// two isolated contexts = two real peers
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const a = await ctxA.newPage();
const b = await ctxB.newPage();
a.on("pageerror", (e) => console.error("  [A pageerror]", e.message));
b.on("pageerror", (e) => console.error("  [B pageerror]", e.message));

console.log("— peer A: create world —");
await a.goto(URL);
await a.fill("#cc-name", HOST);
await a.click("text=Create a new world");
await waitFor(a, () => window.__cc?.world, "A: world generated");
await waitFor(
  a,
  () => document.querySelector(".overlay-panel")?.textContent?.includes("Click to play"),
  "A: connected + ready (pause overlay)",
);

console.log("— peer B: discover & join via lobby —");
await b.goto(URL);
await b.fill("#cc-name", "JoinBot");
let found = true;
try {
  await b.waitForFunction(
    (host) => [...document.querySelectorAll(".world-row")].some((r) => r.textContent.includes(host)),
    HOST,
    { timeout: 60000 },
  );
  ok("B: lobby lists the new world");
} catch {
  fail("B: lobby lists the new world", "(timeout)");
  found = false;
}
if (!found) {
  await browser.close();
  process.exit(1);
}
await b.click(`.world-row:has-text("${HOST}")`);
await waitFor(b, () => window.__cc?.world, "B: world synced from host", 60000);

console.log("— P2P assertions —");
await waitFor(a, () => document.querySelectorAll(".hud-players .hud-chip").length >= 3, "A: sees 2 players");
await waitFor(b, () => document.querySelectorAll(".hud-players .hud-chip").length >= 3, "B: sees 2 players");
await waitFor(a, () => window.__cc?.remotes?.size >= 1, "A: receiving B's position stream");
await waitFor(b, () => window.__cc?.remotes?.size >= 1, "B: receiving A's position stream");

// edit propagation A -> B (stone @ 64,50,64)
await a.evaluate(() => window.__cc.applyEdit(64, 50, 64, 3));
await waitFor(b, () => window.__cc.world.get(64, 50, 64) === 3, "B: received A's block edit");

// edit propagation B -> A (brick @ 66,50,64)
await b.evaluate(() => window.__cc.applyEdit(66, 50, 64, 9));
await waitFor(a, () => window.__cc.world.get(66, 50, 64) === 9, "A: received B's block edit");

// break propagation A -> B
await a.evaluate(() => window.__cc.applyEdit(66, 50, 64, 0));
await waitFor(b, () => window.__cc.world.get(66, 50, 64) === 0, "B: received A's block break");

console.log("— screenshots —");
await a.screenshot({ path: "scripts/shot-host.png" });
await b.screenshot({ path: "scripts/shot-joiner.png" });
console.log("  saved scripts/shot-host.png, scripts/shot-joiner.png");

await browser.close();
console.log(process.exitCode ? "\nRESULT: FAILURES" : "\nRESULT: ALL PASS");
