# 🎮 테트리스(Retro Tetris) 수정 및 기능 추가 보고서

요청하신 테트리스 게임 수정, 신규 기능 추가 및 업데이트 공지 팝업 작업이 모두 완료되었습니다.

---

## 📌 주요 수정 내역 요약

1. **모바일 조작 버튼 크기 확대 (`min-height: 45px`)**
   - 모바일 터치 접근성을 개선하기 위해 모바일 컨트롤 버튼의 최소 높이를 기존 34px/40px에서 `45px`로 확대하였습니다.
   - 뷰포트(`100dvh`) 화면 내에서 스크롤 없이 한 화면에 딱 맞게 정렬되도록 보드 프레임과 컨테이너 높이 계산을 최적화하였습니다.

2. **4줄 동시 제거(테트리스) 보너스 점수 대폭 상향**
   - 기존 4줄 제거 시 점수(800점)를 **1,500점**으로 대폭 상향하였습니다.
   - 4줄을 동시에 터뜨렸을 때 상태창(`STATUS`)에 `★ TETRIS! +1500 ★` 골드 하이라이트 문구가 출력되어 강렬한 손맛과 보너스 달성감을 제공합니다.

3. **블록 킵(KEEP / HOLD) 기능 추가**
   - 현재 내려오고 있는 블록을 보관(KEEP)할 수 있습니다.
   - **상호 교환(Swap) 지원**: 블록 A가 이미 킵된 상태에서 새 블록 B를 킵하면, A와 B가 서로 맞바뀌어 A가 상단 중앙에서 새로 내려옵니다.
   - **공정성 보장 규칙**: 블록이 바닥에 고정(Lock)되기 전까지 턴당 1회만 교환 가능하도록 제한하여 무한 홀드로 인한 꼼수를 방지했습니다.
   - **조작 지원**:
     - **PC 키보드**: `C` 키, `Shift` 키, `K` 키
     - **모바일**: 하단 조작 버튼 패널 상단 우측에 전용 `KEEP` 버튼 추가
   - **UI**: 상단 HUD에 실시간으로 보관된 블록을 표시하는 레트로 캔버스 패널(`KEEP`) 배치

4. **업데이트 공지 팝업(모달) 추가**
   - 게임에 접속했을 때 최신 업데이트 내역(KEEP 기능, 4줄 테트리스 보너스, 모바일 조작 편의성 개선)을 직관적으로 확인할 수 있는 레트로 스타일 공지 모달을 제공합니다.
   - 팝업이 떠 있는 동안에는 블록이 떨어지지 않고 일시정지(`READY!`) 상태를 유지하며, `START GAME` 버튼을 누르면 부드럽게 게임이 시작됩니다.
   - `오늘 하루 보지 않기` 체크박스 옵션(로컬스토리지 24시간 저장)을 지원합니다.

---

## 🔍 세부 코드 수정 내역

### 1. 스타일(CSS) 수정

#### 1-1. 모바일 버튼 크기 및 KEEP 버튼 그리드 배치
```css
/* 기본 컨트롤 버튼 min-height 45px 설정 */
.controls button {
    margin: 0;
    min-height: 45px;
    font-size: 13px;
}

/* KEEP 버튼 스타일 및 컨트롤 그리드 배치 */
.controls button[data-action="rotate"] {
    grid-column: 2;
    grid-row: 1;
}

.controls button[data-action="keep"] {
    grid-column: 3;
    grid-row: 1;
    font-size: 9px;
    color: #67d46e;
    border-color: #3e7b45;
    background: #17261a;
}
```

#### 1-2. 모바일 반응형(`@media (max-width: 650px)`) 뷰포트 최적화
```css
/* 상단 HUD 및 킵 캔버스 크기 조정 */
.keep-panel,
.next-panel {
    flex: 0 0 auto;
    padding: 3px 5px !important;
}

.keep-panel #keep,
.next-panel #next {
    width: 36px;
    height: 36px;
    margin: 2px auto 0;
    border-width: 1px;
}

/* 45px 버튼 추가에 맞춰 100dvh 화면 맞춤 */
.board-frame {
    height: min(480px, calc(100dvh - 235px));
    width: calc(min(480px, calc(100dvh - 235px)) / 2);
}

.controls button {
    min-height: 45px;
    padding: 2px;
    font-size: 13px;
}
```

#### 1-3. 업데이트 공지 팝업 스타일
```css
#notice-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.88);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
}

#notice-modal {
    background: #171717;
    border: 3px solid #f5d547;
    box-shadow: 0 0 0 3px #090909, 0 12px 40px rgba(245, 213, 71, 0.25);
    padding: 24px 20px;
    text-align: center;
    font-family: "Press Start 2P", -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif;
    width: 380px;
    max-width: 92vw;
    box-sizing: border-box;
}
```

---

### 2. HTML 마크업 수정

#### 2-1. KEEP 캔버스 패널 추가
```html
<div class="panel keep-panel">
    <div class="label">
        KEEP
    </div>
    <canvas id="keep" width="100" height="100">
    </canvas>
</div>
```

#### 2-2. 모바일 컨트롤 패널에 KEEP 버튼 추가
```html
<div class="controls">
    <button data-action="rotate">▲</button>
    <button data-action="keep">KEEP</button>
    <button data-action="left">◀</button>
    <button data-action="down">▼</button>
    <button data-action="right">▶</button>
    <button data-action="drop">▼▼</button>
</div>
```

#### 2-3. 업데이트 공지 모달 마크업
```html
<div id="notice-overlay" style="display:none">
    <div id="notice-modal">
        <div class="notice-title">★ UPDATE NOTICE ★</div>
        <div class="notice-badge">VER 2.0 UPDATE</div>
        <div class="notice-list">
            ...
        </div>
        <div class="notice-actions">
            <label class="notice-hide-today">
                <input type="checkbox" id="notice-hide-checkbox"> 오늘 하루 보지 않기
            </label>
            <button id="close-notice-btn">START GAME</button>
        </div>
    </div>
</div>
```

---

### 3. 자바스크립트(JS) 게임 로직 수정

#### 3-1. 킵 상태 변수 및 캔버스 초기화
```javascript
const keepCanvas = document.getElementById("keep");
const keepCtx = keepCanvas ? keepCanvas.getContext("2d") : null;

let keepPiece = null; // 킵된 블록의 shape 인덱스
let canKeep = true;   // 현재 블록 고정 전까지 1회 교환 허용 플래그
```

#### 3-2. 블록 생성 함수(`createPiece`)에 인덱스 지정 기능 추가
```javascript
function createPiece(forcedIndex) {
    const index = forcedIndex !== undefined
        ? forcedIndex
        : Math.floor(Math.random() * shapes.length);
    const shape = shapes[index];
    return {
        matrix: shape.map(row => [...row]),
        x: Math.floor(COLS / 2 - shape[0].length / 2),
        y: 0,
        color: index + 1,
        shapeIndex: index
    };
}
```

#### 3-3. KEEP 그리기 및 교환(Swap) 핵심 함수
```javascript
function keepCurrentPiece() {
    if (paused || gameOver || !canKeep || !currentPiece) return;

    const currentShapeIndex = currentPiece.shapeIndex;

    if (keepPiece === null) {
        // 첫 킵: 현재 블록 저장 후 다음 블록 스폰
        keepPiece = currentShapeIndex;
        spawnPiece();
    } else {
        // 교환(Swap): 이미 킵된 A와 현재 블록 B를 맞바꿈
        const swapIndex = keepPiece;
        keepPiece = currentShapeIndex;
        currentPiece = createPiece(swapIndex);

        if (collision(currentPiece)) {
            gameOver = true;
            document.getElementById("status").textContent = "GAME OVER";
            showInitialsModal();
        }
    }

    canKeep = false; // 블록 고정 전까지 연속 스왑 잠금
    dropTimer = 0;
    drawKeepPiece();
    drawBoard();
}
```

#### 3-4. 블록 고정 및 재시작 시 킵 잠금 해제
```javascript
function lockPiece() {
    mergePiece();
    clearLines();
    canKeep = true; // 새 블록 등장 시 킵 사용 가능
    spawnPiece();
}

function restart() {
    // ...
    keepPiece = null;
    canKeep = true;
    drawKeepPiece();
    // ...
}
```

#### 3-5. 4줄 클리어(테트리스) 보너스 점수 및 시각 피드백
```javascript
const scores = [
    0,
    100,
    300,
    500,
    1500 // 4줄 한번에 클리어(테트리스) 시 기존 800 -> 1500점으로 대폭 상향
];
score += scores[count] || 1500;

if (count === 4) {
    const statusEl = document.getElementById("status");
    if (statusEl && !gameOver) {
        statusEl.textContent = "★ TETRIS! +1500 ★";
        statusEl.style.color = "#ffe13b";
        setTimeout(() => {
            if (!gameOver && !paused && statusEl.textContent.includes("TETRIS")) {
                statusEl.textContent = "PLAYING";
                statusEl.style.color = "#67d46e";
            }
        }, 1200);
    }
}
```

#### 3-6. 공지 팝업 제어 및 로컬 스토리지 연동
```javascript
const NOTICE_STORAGE_KEY = "tetris_hide_notice_until";

function checkNoticePopup() {
    const hideUntil = localStorage.getItem(NOTICE_STORAGE_KEY);
    const now = Date.now();

    if (hideUntil && now < Number(hideUntil)) {
        return;
    }

    const overlay = document.getElementById("notice-overlay");
    if (overlay) {
        overlay.style.display = "flex";
        paused = true;
        const statusEl = document.getElementById("status");
        if (statusEl) statusEl.textContent = "READY!";
    }
}
```
