/**
 * Panel resize smoke test — run with frontend up:
 *   npx playwright install chromium
 *   node scripts/test-panel-resize.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

async function panelHeight(page, id) {
  return page.locator(`[data-panel][id="${id}"]`).evaluate((el) => el.getBoundingClientRect().height);
}

async function panelWidth(page, id) {
  return page.locator(`[data-panel][id="${id}"]`).evaluate((el) => el.getBoundingClientRect().width);
}

async function dragSeparator(page, sepId, dx, dy) {
  const sep = page.locator(`[data-separator][id="${sepId}"]`);
  await sep.waitFor({ state: 'visible', timeout: 15000 });
  const box = await sep.boundingBox();
  if (!box) throw new Error(`No box for separator ${sepId}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/dev/panels`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-panel][id="logs-section"]', { timeout: 20000 });

  const logsBefore = await panelHeight(page, 'logs-section');
  const ctxBefore = await panelHeight(page, 'context-section');
  const centerBefore = await panelWidth(page, 'center');
  const chatBefore = await panelWidth(page, 'chat');

  // Separator UP — shrink logs, grow context
  await dragSeparator(page, 'sep-logs-context', 0, -120);
  const logsAfterUp = await panelHeight(page, 'logs-section');
  const ctxAfterUp = await panelHeight(page, 'context-section');

  // Separator LEFT — shrink center, grow chat
  await dragSeparator(page, 'sep-main-chat', -150, 0);
  const centerAfterLeft = await panelWidth(page, 'center');
  const chatAfterLeft = await panelWidth(page, 'chat');

  // Separator DOWN — grow logs (user-reported working direction)
  await dragSeparator(page, 'sep-logs-context', 0, 80);
  const logsAfterDown = await panelHeight(page, 'logs-section');

  // Separator RIGHT — grow center (user-reported working direction)
  await dragSeparator(page, 'sep-main-chat', 100, 0);
  const centerAfterRight = await panelWidth(page, 'center');

  await browser.close();

  const results = [
    { name: 'UP: logs shrank', ok: logsAfterUp < logsBefore - 30, before: logsBefore, after: logsAfterUp },
    { name: 'UP: context grew', ok: ctxAfterUp > ctxBefore + 20, before: ctxBefore, after: ctxAfterUp },
    { name: 'LEFT: center shrank', ok: centerAfterLeft < centerBefore - 40, before: centerBefore, after: centerAfterLeft },
    { name: 'LEFT: chat grew', ok: chatAfterLeft > chatBefore + 40, before: chatBefore, after: chatAfterLeft },
    { name: 'DOWN: logs grew', ok: logsAfterDown > logsAfterUp + 20, before: logsAfterUp, after: logsAfterDown },
    { name: 'RIGHT: center grew', ok: centerAfterRight > centerAfterLeft + 30, before: centerAfterLeft, after: centerAfterRight },
  ];

  let failed = false;
  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL';
    console.log(`${status}  ${r.name}  (${Math.round(r.before)} → ${Math.round(r.after)})`);
    if (!r.ok) failed = true;
  }

  if (failed) {
    console.error('\nResize test FAILED');
    process.exit(1);
  }
  console.log('\nResize test PASSED (all 4 directions)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
