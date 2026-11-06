const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const out = path.resolve('artifacts/rirekisho/history');
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, locale: 'ja-JP'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto('http://127.0.0.1:4322/#rirekisho');
  await page.locator('.r-sheet').first().waitFor();
  const row = (prefix, index, long = false) => ({year: String(1970 + index), month: String(index % 12 + 1), text: `${prefix}${String(index + 1).padStart(2,'0')} ` + (long ? '学校名や会社名、所属部署と担当業務についての詳しい説明です。'.repeat(6) : '入学・卒業または入社・退職についての記録')});
  const make = (education, employment, long = false) => ({fields: {name: '多数経歴の検証', date: '2026-11-06'}, education: Array.from({length: education}, (_, i) => row('EDU', i, long)), employment: Array.from({length: employment}, (_, i) => row('JOB', i, long)), qualifications: [], sections: [], font: 'noto-sans-jp', theme: 'navy', background: 'paper'});
  const failures = [];
  let serial = 0;
  async function load(draft) {
    draft.fields.name = `多数経歴の検証 ${++serial}`;
    await page.locator('#r-open').setInputFiles({name: 'history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(draft))});
    await page.waitForFunction(name => document.querySelector('[name="name"]').value === name && !document.querySelector('#r-print').disabled, draft.fields.name);
  }
  async function inspect(name, draft) {
    const result = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('.r-sheet')];
      const data = [...document.querySelectorAll('.r-history tbody tr')].filter(tr => !tr.classList.contains('r-history-group') && tr.lastElementChild.textContent !== '以上');
      return {
        pageCount: sheets.length,
        content: data.map(tr => tr.lastElementChild.textContent).join(''),
        issues: sheets.flatMap((sheet, index) => {
          const issues = []; const limit = sheet.clientHeight - parseFloat(getComputedStyle(sheet).paddingBottom);
          const blocks = [...sheet.children].filter(el => el.tagName !== 'FOOTER');
          if (blocks.some(el => el.offsetTop + el.offsetHeight > limit + 1)) issues.push(`Page ${index + 1}: content overflow`);
          const table = sheet.querySelector('.r-history');
          if (!table?.tHead || !table.tBodies[0]?.rows.length) issues.push(`Page ${index + 1}: empty page/table`);
          const last = table?.tBodies[0]?.lastElementChild;
          if (last?.classList.contains('r-history-group')) issues.push(`Page ${index + 1}: orphan group heading`);
          if (table?.tBodies[0]?.rows.length === 1 && last?.lastElementChild.textContent === '以上') issues.push(`Page ${index + 1}: orphan closing marker`);
          if (index > 0 && sheet.querySelector('.r-sheet-heading')) issues.push(`Page ${index + 1}: unexpected page title`);
          return issues;
        }),
      };
    });
    assert.equal(result.content, [...draft.education, ...draft.employment].map(row => row.text.slice(0,180)).join(''), `${name}: no missing or duplicated content`);
    if (result.issues.length) failures.push({name, issues: result.issues});
    return result;
  }
  for (const [name, education, employment, long] of [['many-short',50,50,false], ['many-long',50,50,true], ['education-only',50,0,true], ['employment-only',0,50,true]]) {
    const draft = make(education, employment, long);
    await load(draft);
    const result = await inspect(name, draft);
    await page.pdf({path: path.join(out, `${name}.pdf`), format: 'A4', preferCSSPageSize: true, printBackground: true});
    const pdfPages = (fs.readFileSync(path.join(out, `${name}.pdf`)).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    assert.equal(pdfPages, result.pageCount, `${name}: PDF page count matches preview`);
    console.log(name, JSON.stringify({education, employment, pages: result.pageCount, issues: result.issues}));
    await page.emulateMedia({media: 'print'});
    await page.locator('.r-sheet').nth(1).screenshot({path: path.join(out, `${name}-page2.png`)});
    await page.emulateMedia({media: null});
  }
  for (let count = 1; count <= 35; count++) {
    const draft = make(count, 2);
    await load(draft); await inspect(`boundary-${count}`, draft);
  }
  await page.setViewportSize({width: 390, height: 844});
  await inspect('mobile', make(35, 2));
  assert.deepEqual(errors, []);
  console.log('boundary issues', JSON.stringify(failures));
  await browser.close();
  assert.deepEqual(failures, []);
})().catch(error => {console.error(error); process.exit(1);});
