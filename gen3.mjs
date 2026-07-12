// 朝ラジオ 夜間生成: 複数エピソードを単一ブラウザで生成→DL。feed/audioへ保存。
// 使い方: node gen3.mjs   （EPISODES を編集すれば任意本数）
import path from 'node:path';
import fs from 'node:fs';
const NM = '/Users/hainodaiki/.npm/_npx/0d29dd9f4e472da9/node_modules';
const { chromium } = await import(path.join(NM, 'patchright', 'index.mjs')).catch(() => import(path.join(NM, 'patchright', 'index.js')));
const PROFILE = process.env.NLM_PROFILE || '/private/tmp/claude-501/-Users-hainodaiki-Desktop-CLAUDE-claude-code-automation/51c22602-2b0e-4c4a-9b56-a763cdaeb7ed/scratchpad/nlm_night';
const AUDIO_DIR = '/Users/hainodaiki/asa-radio-feed/audio';
const DIALOG = '.mat-mdc-dialog-container';
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);

const EPISODES = [
  { slug: 'ep002-meta-advantage', title: 'Meta広告 Advantage+ 2026 — AI自動化で運用はどう変わる', sources: [
    'https://anagrams.jp/blog/update-summary-2026-03/',
    'https://note.com/vc_note/n/n90742af4f156',
    'https://note.com/chokudori/n/n8648f1318255',
    'https://marketingone.co.jp/meta-ads-algorithm-2026/',
    'https://signalz.jp/news/meta-advantage-plus-update',
  ]},
  { slug: 'ep003-claude-workflows', title: 'Claude Code 動的ワークフロー — 非エンジニアの仕事を並列で回す', sources: [
    'https://code.claude.com/docs/ja/workflows',
    'https://zenn.dev/akasara/articles/ccfb2f7a5174e0',
    'https://qiita.com/kai_kou/items/fe9b0e65e2252af773c9',
    'https://uravation.com/media/claude-code-dynamic-workflows-2026/',
    'https://techblog.dearsystem.jp/blog/2026-06-04-01/',
  ]},
  { slug: 'ep004-instagram-2026', title: 'Instagram 2026アルゴリズム — 保存よりDMシェア・リール中心時代', sources: [
    'https://www.comnico.jp/we-love-social/ig-algorithm',
    'https://to-inc.co.jp/socialbook/?p=4755',
    'https://s--line.co.jp/instagram-algorithm-2026-latest/',
    'https://tatap.jp/knowledge/instagram-reel-185/',
    'https://megdai.jp/markebatake/seo/6908/',
  ]},
];

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, channel: 'chrome', viewport:{width:1500,height:950}, acceptDownloads: true, args: ['--no-first-run','--no-default-browser-check'] });
const page = ctx.pages()[0] || await ctx.newPage();
const count = () => page.evaluate(() => document.querySelectorAll('.single-source-container').length);
const results = [];

async function addSource(url, isFirst) {
  const before = await count();
  const dialogOpen = await page.locator(DIALOG).first().isVisible({ timeout: 2000 }).catch(()=>false);
  if (!dialogOpen) { await page.locator('button.add-source-button').first().click({ timeout: 8000 }); await page.locator(DIALOG).first().waitFor({ state:'visible', timeout: 8000 }); }
  await page.locator(`${DIALOG} button.drop-zone-icon-button:has(mat-icon:text-is("link")), ${DIALOG} button.drop-zone-icon-button:has-text("ウェブサイト"), ${DIALOG} button.drop-zone-icon-button:has-text("Website")`).first().click({ timeout: 6000 });
  await page.waitForTimeout(1000);
  const inp = page.locator(`${DIALOG} input[type="text"]:not([readonly]), ${DIALOG} input[type="url"], ${DIALOG} textarea`).first();
  await inp.waitFor({ state:'visible', timeout: 6000 }); await inp.fill(url); await page.waitForTimeout(400);
  await page.locator(`${DIALOG} button.mdc-button--raised:has-text("挿入"), ${DIALOG} button:has-text("挿入"), ${DIALOG} button.mdc-button--raised:has-text("Insert"), ${DIALOG} button:has-text("Insert")`).first().click({ timeout: 6000 });
  await page.waitForTimeout(15000);
  return (await count()) > before;
}

try {
  // ---- フェーズ1: 各エピソードのノート作成・ソース投入・生成トリガー ----
  for (const ep of EPISODES) {
    try {
      log('CREATE', ep.slug);
      await page.goto('https://notebooklm.google.com/', { waitUntil:'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      if (/accounts\.google|\/login/.test(page.url())) throw new Error('LOGGED_OUT');
      await page.locator('button:has-text("Create new"), button:has-text("新規作成"), button:has-text("Create"), [aria-label*="Create" i], .create-new-button, button.create-new-label-button, project-button-create button').first().click({ timeout: 8000 });
      await page.waitForURL(/\/notebook\/[0-9a-f-]{36}/i, { timeout: 20000 });
      await page.waitForTimeout(3500);
      ep.notebookUrl = page.url().split('?')[0];
      fs.appendFileSync('/Users/hainodaiki/asa-radio-feed/notebook_urls.txt', ep.slug + ' ' + ep.notebookUrl + '\n');
      let ok = 0;
      for (let i = 0; i < ep.sources.length; i++) { try { if (await addSource(ep.sources[i], i===0)) ok++; } catch(e){ log('  source fail', e.message.slice(0,40)); await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(1000); } }
      log('  sources added', ok, '/', ep.sources.length);
      // 生成トリガー: ノートを開き直してStudioを安定させ、タイルをクリック（最大3回リトライ・生成開始を確認）
      let triggered = false;
      for (let t = 0; t < 3 && !triggered; t++) {
        await page.goto(ep.notebookUrl, { waitUntil:'domcontentloaded', timeout: 40000 });
        await page.waitForTimeout(10000);
        try {
          const tile = page.locator('button:has(mat-icon:text-is("audio_magic_eraser"))').first();
          await tile.scrollIntoViewIfNeeded().catch(()=>{});
          await tile.click({ timeout: 10000 });
          await page.waitForTimeout(6000);
          triggered = await page.evaluate(()=>/生成しています|生成中|Generating/i.test((document.querySelector('studio-panel')||document.body).innerText||''));
        } catch(e){ log('  trigger retry', t, e.message.slice(0,40)); }
      }
      ep.triggered = triggered; log(triggered ? '  audio triggered' : '  TRIGGER FAILED');
    } catch (e) { ep.error = e.message; log('  EP ERROR', e.message.slice(0,60)); if (e.message==='LOGGED_OUT') throw e; }
  }
  // ---- フェーズ2: 各ノートの完成をポーリングしてDL ----
  for (const ep of EPISODES) {
    if (!ep.triggered) continue;
    let done = false;
    for (let i = 0; i < 30; i++) {   // 最大15分/本
      await page.goto(ep.notebookUrl, { waitUntil:'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(6000);
      const gen = await page.evaluate(() => /生成しています|生成中|Generating/i.test((document.querySelector('studio-panel')||document.body).innerText||''));
      if (!gen) { done = true; break; }
      await page.waitForTimeout(30000);
    }
    if (!done) { ep.dlError = 'timeout'; log('DL timeout', ep.slug); continue; }
    try {
      const menu = page.locator('studio-panel button:has(mat-icon:text-is("more_vert")), [class*="studio" i] button:has(mat-icon:text-is("more_vert"))').first();
      await menu.click({ timeout: 8000 }); await page.waitForTimeout(1500);
      const dest = path.join(AUDIO_DIR, ep.slug + '.m4a');
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        page.locator('[role="menuitem"]:has-text("ダウンロード"), .mat-mdc-menu-item:has-text("ダウンロード"), [role="menuitem"]:has-text("Download")').first().click({ timeout: 8000 }),
      ]);
      await dl.saveAs(dest);
      ep.file = dest; ep.size = fs.statSync(dest).size;
      log('DOWNLOADED', ep.slug, ep.size, 'bytes');
    } catch(e){ ep.dlError = e.message; log('DL fail', ep.slug, e.message.slice(0,50)); }
    results.push({ slug: ep.slug, title: ep.title, file: ep.file, size: ep.size, error: ep.error||ep.dlError });
  }
} catch(e){ log('FATAL', e.message); results.push({ fatal: e.message }); } finally { await ctx.close(); }
fs.writeFileSync('/Users/hainodaiki/asa-radio-feed/gen3_result.json', JSON.stringify(results, null, 2));
log('DONE', JSON.stringify(results.map(r=>({s:r.slug, ok: !!r.file, err:r.error}))));
