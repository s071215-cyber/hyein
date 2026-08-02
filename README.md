# 오늘의 클로드 인기글 TOP5 (인스타 캐러셀용)

매일 "클로드(Claude)" 관련해서 사람들이 가장 많이 찾아보는 글 5개를 웹 검색으로 찾아서,
인스타 캐러셀 형태의 사이트(index.html)로 자동 생성해주는 프로젝트예요.

## 1. 클로드코드에서 처음 실행하기

1. 이 폴더를 클로드코드로 열어요.
2. 앤트로픽 API 키를 준비해요 → https://console.anthropic.com 에서 발급 (API 사용량만큼 소액 과금돼요)
3. 터미널에 아래처럼 키를 등록해요.

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-여기에-내-키"
   ```

4. 아래 명령으로 오늘 것을 생성해요.

   ```bash
   npm run update
   ```

5. 다 되면 `index.html`이 새로 생겨요. 더블클릭해서 열면 바로 오늘의 TOP5가 보여요.

클로드코드한테 그냥 "npm run update 실행해서 index.html 갱신해줘" 라고 말만 해도 알아서 해줘요.

## 2. 매일 아침 새로 만들고 싶을 때

같은 폴더에서 `npm run update` 만 다시 실행하면 그날 기준으로 새로 갱신돼요.
지난 날짜 데이터는 `history/` 폴더에 자동으로 쌓여서 나중에 비교해볼 수도 있어요.

## 3. (선택) 완전 자동화하고 싶다면

이 폴더를 GitHub 저장소에 올리면, 매일 한국시간 오전 8시에 **자동으로**
오늘의 TOP5를 검색해서 index.html을 갱신하고, GitHub Pages로 자동 배포까지 해줘요.
(`.github/workflows/daily-update.yml` 파일이 이미 설정돼 있어요.)

설정 방법:
1. GitHub에 새 저장소를 만들고 이 폴더를 push 해요.
2. 저장소 Settings → Secrets and variables → Actions → New repository secret
   - 이름: `ANTHROPIC_API_KEY`
   - 값: 내 API 키
3. Settings → Pages → Source를 "GitHub Actions"로 설정해요.
4. 이제부터는 매일 자동으로 갱신되고, 링크 하나로 언제든 오늘의 TOP5를 볼 수 있어요.

## 파일 구성

- `index.template.html` : 디자인 뼈대 (건드릴 필요 없음)
- `update.mjs` : 실제 검색 + index.html 생성 스크립트
- `index.html` : 실행할 때마다 새로 만들어지는 결과물 (이걸 열어보면 됨)
- `history/` : 날짜별 검색 결과 백업
- `.github/workflows/daily-update.yml` : 매일 자동 실행 설정 (선택사항)

## 자주 묻는 질문

**Q. API 키 없이도 되나요?**
안 돼요. 실시간 웹 검색은 앤트로픽 API를 통해서만 가능해서, 키가 꼭 필요해요.
대신 사용한 만큼만 소액 과금돼서 하루 한 번 실행하는 정도면 비용은 거의 안 들어요.

**Q. 인스타에는 어떻게 올려요?**
index.html을 열어서 각 슬라이드를 캡처하거나, 화면 그대로 색감·구성만 캔바 등으로 옮겨서 쓰시면 돼요.
"인스타 캡션용 텍스트로 보기" 버튼 누르면 캡션 문구도 바로 복사돼요.
