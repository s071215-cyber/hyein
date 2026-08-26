#!/usr/bin/env node
// 네이버 블로그 반자동 발행 스크립트.
// - 로그인은 항상 사람이 브라우저 창에서 직접 함 (최초 1회, 이후 프로필 폴더에 세션 유지).
// - 원고 입력 -> 서식 붙여넣기까지는 자동, 실제 "발행" 클릭은 --publish 옵션을 줘야만 실행됨(기본은 dry-run).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { markdownToHtml } from './md-to-html.mjs';

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--'));
const DO_PUBLISH = args.includes('--publish');
const HEADLESS = args.includes('--headless');

const BLOG_ID = process.env.NAVER_BLOG_ID;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!BLOG_ID) fail('환경변수 NAVER_BLOG_ID 를 먼저 설정해주세요. 예) export NAVER_BLOG_ID=내블로그아이디');
if (!filePath) fail('사용법: node publish.mjs <원고파일.md> [--publish] [--headless]');

function splitTitleAndBody(text) {
  const lines = text.split('\n');
  if (lines[0].startsWith('TITLE:')) {
    const title = lines[0].slice('TITLE:'.length).trim();
    const rest = lines.slice(1).join('\n').replace(/^\s*-{3,}\s*\n/, '');
    return { title, bodyMarkdown: rest.trim() };
  }
  if (lines[0].startsWith('# ')) {
    return { title: lines[0].slice(2).trim(), bodyMarkdown: lines.slice(1).join('\n').trim() };
  }
  fail('원고 첫 줄은 "TITLE: 제목" 또는 "# 제목" 형식이어야 해요.');
}

const raw = readFileSync(filePath, 'utf-8');
const { title, bodyMarkdown } = splitTitleAndBody(raw);
const bodyHtml = markdownToHtml(bodyMarkdown);

const profileDir = path.join(os.homedir(), '.naver-publish-profile');
mkdirSync(profileDir, { recursive: true });

// 여러 후보 선택자를 순서대로 시도 - 네이버 에디터 DOM이 바뀌어도 어느 정도 버티게 함.
async function locateFirst(frame, selectors) {
  for (const selector of selectors) {
    const locator = frame.locator(selector).first();
    if (await locator.count().catch(() => 0)) return locator;
  }
  return frame.locator(selectors[0]).first();
}

const context = await chromium.launchPersistentContext(profileDir, {
  headless: HEADLESS,
  channel: 'chrome', // 시스템에 설치된 크롬을 그대로 사용. 없으면 이 줄을 지우고 `npx playwright install chromium` 실행.
  viewport: { width: 1400, height: 1000 },
});
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://blog.naver.com' });

const page = context.pages()[0] ?? (await context.newPage());
const rl = readline.createInterface({ input, output });

const writeUrl = `https://blog.naver.com/PostWriteForm.naver?blogId=${BLOG_ID}`;

console.log('블로그 글쓰기 화면으로 이동해요...');
await page.goto(writeUrl, { waitUntil: 'load' });

// 로그인이 안 되어 있으면 nid.naver.com 로그인 페이지로 리다이렉트됨.
if (page.url().includes('nid.naver.com')) {
  console.log('네이버 로그인이 안 되어 있어요. 브라우저 창에서 직접 로그인해주세요 (2단계 인증 포함).');
  await rl.question('로그인을 마쳤으면 이 터미널에서 Enter를 눌러주세요...');
  await page.goto(writeUrl, { waitUntil: 'load' });
} else {
  console.log('로그인 세션이 살아있어요. 로그인 단계는 건너뛸게요.');
}

const frame = page.frame({ name: 'mainFrame' }) ?? page.mainFrame();

// "이전에 작성 중이던 글이 있어요" 팝업이 뜨면 새 글로 시작
const cancelContinueBtn = frame.getByRole('button', { name: '취소' });
if (await cancelContinueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await cancelContinueBtn.click();
}

console.log('제목 입력 중...');
const titleField = await locateFirst(frame, [
  '.se-title-text .se-text-paragraph',
  '[data-a11y-title-input] .se-text-paragraph',
  '.se-documentTitle .se-text-paragraph',
]);
await titleField.click();
await page.keyboard.type(title, { delay: 20 });

console.log('본문 붙여넣기 중 (마크다운 -> 네이버 서식 변환)...');
const bodyField = await locateFirst(frame, [
  '.se-main-container [contenteditable="true"]',
  '.se-component-content [contenteditable="true"]',
]);
await bodyField.click();
await frame.evaluate(async (html) => {
  await navigator.clipboard.write([
    new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
  ]);
}, bodyHtml);
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+KeyV' : 'Control+KeyV');
await page.waitForTimeout(1500);

const screenshotPath = path.join(profileDir, 'last-draft-preview.png');
await page.screenshot({ path: screenshotPath, fullPage: true });
console.log(`미리보기 스크린샷 저장: ${screenshotPath}`);
console.log('브라우저 창에서 제목/표/인용구/굵게 등 서식이 마크다운 기호 없이 제대로 들어갔는지 직접 확인해주세요.');

if (!DO_PUBLISH) {
  console.log('DRY RUN 모드라 실제로 발행하지 않았어요. 확인 후 문제 없으면 --publish 옵션을 추가해서 다시 실행해주세요.');
  await rl.question('확인했으면 Enter를 눌러 종료할게요 (브라우저는 열어둘게요)...');
  rl.close();
  process.exit(0);
}

console.log('발행 버튼을 클릭해요...');
await frame.getByRole('button', { name: '발행' }).first().click();
await page.waitForTimeout(1000);
const finalPublishBtn = frame.getByRole('button', { name: /^발행$/ }).last();
if (await finalPublishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await finalPublishBtn.click();
}

console.log('발행 완료! 브라우저에서 실제로 잘 올라갔는지 확인해주세요.');
rl.close();
await page.waitForTimeout(3000);
await context.close();
