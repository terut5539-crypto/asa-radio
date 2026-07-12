// notebook_urls.txt の各ノートについて: インデックス待機→音声生成トリガー→完成待ち→DL
import path from 'node:path';
import fs from 'node:fs';
const NM = '/Users/hainodaiki/.npm/_npx/0d29dd9f4e472da9/node_modules';
const { chromium } = await import(path.join(NM, 'patchright', 'index.mjs')).catch(() => import(path.join(NM, 'patchright', 'index.js')));
const PROFILE = '/Users/hainodaiki/Library/Application Support/notebooklm-mcp/chrome_profile'; // 固定・複製しない
const AUDIO_DIR = '/Users/hainodaiki/asa-radio-feed/audio';
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);
const urls = fs.readFileSync('/Users/hainodaiki/asa-radio-feed/notebook_urls.txt','utf8').trim().split('\n').filter(Boolean).map(l=>{const [slug,url]=l.split(' ');return {slug,url};});
log('targets:', urls.map(u=>u.slug).join(','));
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, channel: 'chrome', viewport:{width:1500,height:950}, acceptDownloads: true, args: ['--no-first-run','--no-default-browser-check'] });
const page = ctx.pages()[0] || await ctx.newPage();
const genstate = () => page.evaluate(()=>/生成しています|生成中|Generating/i.test((document.querySelector('studio-panel')||document.body).innerText||''));

async function trigger(u){
  for (let t=0; t<5; t++){
    await page.goto(u.url,{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForTimeout(t===0?40000:20000);   // 初回はインデックス処理をしっかり待つ
    if (/accounts\.google|\/login/.test(page.url())) { u.err='LOGGED_OUT'; return false; }
    await page.keyboard.press('Escape').catch(()=>{});
    try{
      const tile = page.locator('button:has(mat-icon:text-is("audio_magic_eraser"))').first();
      await tile.scrollIntoViewIfNeeded().catch(()=>{});
      await tile.click({ timeout: 10000 }).catch(async()=>{ await tile.click({ force:true, timeout:5000 }); });
      await page.waitForTimeout(6000);
      if (await genstate()){ log(u.slug,'triggered'); return true; }
    }catch(e){ log(u.slug,'trigger try',t,e.message.slice(0,40)); }
  }
  u.err='TRIGGER_FAILED'; return false;
}
async function download(u){
  for (let i=0;i<30;i++){   // 最大15分
    await page.goto(u.url,{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForTimeout(6000);
    if (!(await genstate())) break;
    await page.waitForTimeout(30000);
  }
  try{
    const menu = page.locator('studio-panel button:has(mat-icon:text-is("more_vert")), [class*="studio" i] button:has(mat-icon:text-is("more_vert"))').first();
    await menu.click({timeout:8000}); await page.waitForTimeout(1500);
    const dest = path.join(AUDIO_DIR, u.slug+'.m4a');
    const [dl] = await Promise.all([
      page.waitForEvent('download',{timeout:90000}),
      page.locator('[role="menuitem"]:has-text("ダウンロード"), .mat-mdc-menu-item:has-text("ダウンロード"), [role="menuitem"]:has-text("Download")').first().click({timeout:8000}),
    ]);
    await dl.saveAs(dest); u.file=dest; u.size=fs.statSync(dest).size; log(u.slug,'DOWNLOADED',u.size);
  }catch(e){ u.err=(u.err||'')+'|DL:'+e.message.slice(0,40); log(u.slug,'DL fail',e.message.slice(0,40)); }
}
try{
  for (const u of urls){ await trigger(u); }          // 3本トリガー（サーバー側で並列生成）
  for (const u of urls){ if(!u.err||!u.err.includes('TRIGGER')) await download(u); }  // 順にDL
}catch(e){ log('FATAL',e.message); } finally { await ctx.close(); }
fs.writeFileSync('/Users/hainodaiki/asa-radio-feed/trigger_dl_result.json', JSON.stringify(urls,null,2));
log('DONE', JSON.stringify(urls.map(u=>({s:u.slug,ok:!!u.file,err:u.err}))));
