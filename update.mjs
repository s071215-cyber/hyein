// update.mjs
// 실행: node update.mjs
// 필요: 환경변수 ANTHROPIC_API_KEY (console.anthropic.com 에서 발급)
//
// 하는 일: 앤트로픽 API(웹 검색 기능 포함)로 "오늘 클로드 관련 인기글 TOP5"를 검색해서
// index.template.html 을 채운 index.html 을 새로 만들어요.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY 환경변수가 없어요.");
  console.error("   터미널에서 이렇게 설정한 뒤 다시 실행해주세요:");
  console.error('   export ANTHROPIC_API_KEY="sk-ant-..."');
  process.exit(1);
}

const PROMPT = `오늘 날짜 기준으로 사람들이 가장 많이 찾아보고 관심을 갖는 "Claude(클로드, Anthropic의 AI)" 관련 글/뉴스/토픽 5개를 실제 웹 검색을 통해 찾아줘.
- 최근 업데이트, 신규 기능, 화제가 된 사용 사례, 논쟁이 된 이슈, 비교 리뷰 등 실제로 지금 화제성이 있는 것 위주로 골라줘.
- 관심도가 가장 높은 순서대로 1~5위로 순위를 매겨줘 (buzz는 0~100 사이 숫자, 1위가 가장 높게).
- 각 항목의 summary는 한국어로 2문장 이내, "왜 지금 사람들이 관심 갖는지"가 드러나게 써줘. 소상공인/일반 사용자도 이해할 수 있는 쉬운 표현으로.
- tag는 "NEW FEATURE" / "HOT ISSUE" / "USE CASE" / "REVIEW" / "COMPARISON" 중 가장 어울리는 걸로 영문으로.
- source는 실제 출처 도메인이나 매체명.

다른 설명 없이 아래 JSON 형식으로만 답해. 마크다운 코드블록도 쓰지 마.
{"items":[{"title":"...", "summary":"...", "tag":"...", "buzz":95, "source":"..."}]}`;

async function main() {
  console.log("🔍 오늘의 클로드 인기글 검색 중...");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: PROMPT }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("❌ API 오류:", res.status, errText);
    process.exit(1);
  }

  const data = await res.json();
  const textBlocks = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text);
  let raw = textBlocks.join("\n").trim();
  raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("❌ 결과에서 JSON을 찾지 못했어요. 원본 응답:\n", raw);
    process.exit(1);
  }

  const parsed = JSON.parse(match[0]);
  const items = (parsed.items || []).slice(0, 5);
  if (items.length === 0) {
    console.error("❌ 검색 결과가 비어있어요.");
    process.exit(1);
  }

  // 데이터도 별도 보관 (히스토리 확인용)
  const today = new Date();
  const dateLabel = today.toISOString().slice(0, 10).replaceAll("-", ".");
  fs.mkdirSync(path.join(__dirname, "history"), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, "history", `${dateLabel}.json`),
    JSON.stringify(items, null, 2),
    "utf-8"
  );

  // 템플릿에 값 채워서 index.html 생성
  const template = fs.readFileSync(
    path.join(__dirname, "index.template.html"),
    "utf-8"
  );
  const html = template
    .replaceAll("__GENERATED_AT__", dateLabel)
    .replaceAll("__ITEMS_JSON__", JSON.stringify(items));

  fs.writeFileSync(path.join(__dirname, "index.html"), html, "utf-8");

  console.log("✅ index.html 갱신 완료! (" + dateLabel + " 기준)");
  items.forEach((it, i) => console.log(`  ${i + 1}. ${it.title}`));
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
