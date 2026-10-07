# 플레이어 이동 설계 — 순수 JavaScript MVP

## 1. 목적

이 문서는 외부 엔진이나 물리 라이브러리 없이 JavaScript와 HTML5 Canvas만으로 최소 MVP 플레이어 이동을 구현하는 기준을 정의한다.

구현 대상은 좌우 이동, 중력, 사각형 충돌, 가변 점프, 코요테 타임, 점프 입력 버퍼다.

관련 문서: [MVP_SCOPE.md](./MVP_SCOPE.md)

---

## 2. 좌표와 시간 기준

- Canvas 좌표에서 오른쪽은 `+X`, 아래쪽은 `+Y`다.
- 위치 단위는 픽셀(`px`)이다.
- 속도 단위는 픽셀/초(`px/s`)다.
- 가속도와 중력은 픽셀/초²(`px/s²`)다.
- 물리 계산은 60Hz 고정 시간 단계인 `1 / 60`초로 실행한다.
- 렌더링 빈도와 물리 계산 빈도를 분리해 디스플레이 주사율에 따라 게임 속도가 달라지지 않게 한다.

---

## 3. 플레이어 데이터

```javascript
const player = {
  x: 100,
  y: 580,
  previousX: 100,
  previousY: 580,
  width: 28,
  height: 44,
  velocityX: 0,
  velocityY: 0,
  grounded: false,
  coyoteTimer: 0,
  jumpBufferTimer: 0,
  enabled: true,
};
```

렌더링 보간을 위해 이전 물리 프레임의 위치를 `previousX`, `previousY`에 보관한다.

---

## 4. 초기 튜닝 값

| 이름 | 초기값 | 단위 | 설명 |
|---|---:|---|---|
| `MAX_RUN_SPEED` | 260 | px/s | 최대 수평 속도 |
| `GROUND_ACCELERATION` | 2200 | px/s² | 지상 가속도 |
| `GROUND_DECELERATION` | 2600 | px/s² | 지상 감속도 |
| `AIR_ACCELERATION` | 1400 | px/s² | 공중 가속도 |
| `AIR_DECELERATION` | 700 | px/s² | 공중에서 입력이 없을 때 감속 |
| `JUMP_VELOCITY` | -520 | px/s | 점프 시작 수직 속도 |
| `RISE_GRAVITY` | 1450 | px/s² | 상승 중 중력 |
| `FALL_GRAVITY` | 2100 | px/s² | 하강 중 중력 |
| `JUMP_CUT_GRAVITY` | 3200 | px/s² | 점프 키를 일찍 놓았을 때 중력 |
| `MAX_FALL_SPEED` | 900 | px/s | 최대 낙하 속도 |
| `COYOTE_TIME` | 0.10 | 초 | 발판 이탈 후 점프 허용 시간 |
| `JUMP_BUFFER_TIME` | 0.12 | 초 | 착지 전 점프 입력 보존 시간 |

기본 타일 감각은 32px를 기준으로 하되 실제 타일 시스템은 구현하지 않는다.

---

## 5. 입력 상태

키보드 이벤트를 게임 행동 상태로 변환한다.

```javascript
const input = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  jumpReleased: false,
};
```

- `left`, `right`, `jump`: 키를 누르고 있는 동안 유지한다.
- `jumpPressed`: `keydown`에서 점프 키가 처음 눌린 한 물리 프레임만 `true`다.
- `jumpReleased`: `keyup` 이후 한 물리 프레임만 `true`다.
- 브라우저 키 반복으로 `jumpPressed`가 여러 번 발생하지 않게 `event.repeat`을 무시한다.
- 한 물리 업데이트가 끝난 뒤 `jumpPressed`와 `jumpReleased`를 `false`로 초기화한다.

수평 입력은 다음과 같이 계산한다.

```javascript
const inputAxis = Number(input.right) - Number(input.left);
```

---

## 6. 수평 이동

목표 속도는 입력 방향과 최대 속도의 곱이다.

```text
targetVelocityX = inputAxis × MAX_RUN_SPEED
```

현재 속도는 직접 대입하지 않고 목표 속도로 접근시킨다.

```javascript
function moveToward(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}
```

```javascript
const hasInput = inputAxis !== 0;
let rate;

if (hasInput) {
  rate = player.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION;
} else {
  rate = player.grounded ? GROUND_DECELERATION : AIR_DECELERATION;
}

player.velocityX = moveToward(
  player.velocityX,
  inputAxis * MAX_RUN_SPEED,
  rate * dt,
);
```

MVP에서는 별도의 걷기와 달리기 모드를 사용하지 않는다.

---

## 7. 점프 판정

### 코요테 타임

플레이어가 바닥에 있으면 `coyoteTimer`를 최대값으로 갱신한다. 바닥을 벗어나면 고정 시간 단계만큼 감소시킨다.

```javascript
if (player.grounded) {
  player.coyoteTimer = COYOTE_TIME;
} else {
  player.coyoteTimer = Math.max(player.coyoteTimer - dt, 0);
}
```

### 점프 버퍼

점프 키가 새로 눌리면 `jumpBufferTimer`를 최대값으로 설정한다.

```javascript
if (input.jumpPressed) {
  player.jumpBufferTimer = JUMP_BUFFER_TIME;
} else {
  player.jumpBufferTimer = Math.max(player.jumpBufferTimer - dt, 0);
}
```

다음 조건을 모두 만족하면 점프한다.

```text
jumpBufferTimer > 0
AND
(grounded OR coyoteTimer > 0)
```

```javascript
if (
  player.jumpBufferTimer > 0 &&
  (player.grounded || player.coyoteTimer > 0)
) {
  player.velocityY = JUMP_VELOCITY;
  player.grounded = false;
  player.jumpBufferTimer = 0;
  player.coyoteTimer = 0;
}
```

타이머를 소비하지 않으면 코요테 시간 안에 점프가 중복 실행될 수 있다.

---

## 8. 가변 점프와 중력

상태에 따라 서로 다른 중력을 사용한다.

```text
velocityY < 0 AND 점프 키 유지 → RISE_GRAVITY
velocityY < 0 AND 점프 키 해제 → JUMP_CUT_GRAVITY
velocityY >= 0                 → FALL_GRAVITY
```

```javascript
let gravity = FALL_GRAVITY;

if (player.velocityY < 0) {
  gravity = input.jump ? RISE_GRAVITY : JUMP_CUT_GRAVITY;
}

player.velocityY = Math.min(
  player.velocityY + gravity * dt,
  MAX_FALL_SPEED,
);
```

이 방식은 점프 키를 짧게 눌렀을 때 상승을 빠르게 끝내고, 길게 누르면 최대 높이에 도달하게 한다.

---

## 9. 사각형 충돌

모든 지형은 축에 정렬된 사각형(AABB)으로 제한한다.

```javascript
function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
```

충돌 해결은 X축과 Y축을 분리한다.

### X축

1. `x += velocityX * dt`로 이동한다.
2. 겹친 발판을 찾는다.
3. 오른쪽 이동 중이면 플레이어 오른쪽을 발판 왼쪽에 맞춘다.
4. 왼쪽 이동 중이면 플레이어 왼쪽을 발판 오른쪽에 맞춘다.
5. `velocityX = 0`으로 설정한다.

### Y축

1. `grounded = false`로 시작한다.
2. `y += velocityY * dt`로 이동한다.
3. 겹친 발판을 찾는다.
4. 아래로 이동 중이면 플레이어 바닥을 발판 위에 맞추고 `grounded = true`로 설정한다.
5. 위로 이동 중이면 플레이어 위를 발판 아래에 맞춘다.
6. `velocityY = 0`으로 설정한다.

```javascript
function moveAndCollide(player, platforms, dt) {
  player.x += player.velocityX * dt;
  resolveHorizontal(player, platforms);

  player.grounded = false;
  player.y += player.velocityY * dt;
  resolveVertical(player, platforms);
}
```

MVP에서는 경사면, 회전된 충돌체, 원형 충돌체, 움직이는 발판을 지원하지 않는다.

---

## 10. 한계와 안전장치

단순한 사후 충돌 해결은 한 물리 프레임에 얇은 발판 전체를 통과할 정도로 빠르면 터널링이 생길 수 있다.

MVP에서는 다음 조건으로 문제를 피한다.

- 물리 계산을 60Hz 고정 시간 단계로 실행한다.
- 최대 낙하 속도를 900px/s로 제한한다.
- 충돌 지형의 최소 두께를 24px로 제한한다.
- 한 프레임에 여러 물리 업데이트가 필요하면 누산기 방식으로 모두 처리한다.

더 빠른 투사체가 생기는 시점에 연속 충돌 검사를 별도로 도입한다.

---

## 11. 물리 처리 순서

고정 업데이트 한 번의 순서를 다음과 같이 유지한다.

```text
1. 입력 가능 여부 확인
2. 수평 입력값 계산
3. 점프 입력 버퍼 갱신
4. 이전 접지 상태로 코요테 타이머 갱신
5. 점프 실행 조건 평가
6. 수평 가속 또는 감속 적용
7. 상태별 중력 적용
8. X축 이동 및 충돌 해결
9. Y축 이동 및 충돌 해결
10. 낙사와 도착점 판정
11. 일회성 입력값 초기화
```

충돌 결과인 `grounded`는 Y축 충돌 해결 과정에서 갱신한다.

---

## 12. 렌더링과 보간

Canvas에는 현재 물리 상태를 직접 수정하지 않고 그리기만 한다.

```javascript
function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

const renderX = lerp(player.previousX, player.x, alpha);
const renderY = lerp(player.previousY, player.y, alpha);
```

`alpha`는 누산기에 남은 시간과 고정 시간 단계의 비율이다. MVP에서 보간이 문제를 만들면 우선 생략할 수 있지만, 물리 계산을 가변 시간 단계로 되돌리지는 않는다.

---

## 13. 카메라

카메라는 별도 객체 대신 월드를 그릴 때 사용할 오프셋으로 표현한다.

```javascript
const targetCameraX = player.x + player.width / 2 - canvas.width / 2;
cameraX = moveToward(cameraX, targetCameraX, CAMERA_SPEED * dt);
cameraX = Math.max(0, Math.min(cameraX, level.width - canvas.width));
```

모든 월드 요소는 `screenX = worldX - cameraX` 위치에 그린다. UI는 카메라 오프셋을 적용하지 않는다.

화면 흔들림, 진행 방향 룩어헤드, 줌은 MVP에서 제외한다.

---

## 14. 리스폰과 클리어

플레이어의 `y`가 `level.deathY`보다 커지면 즉시 리스폰한다.

```javascript
function respawnPlayer() {
  player.x = level.spawn.x;
  player.y = level.spawn.y;
  player.previousX = player.x;
  player.previousY = player.y;
  player.velocityX = 0;
  player.velocityY = 0;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
}
```

도착점과 플레이어 사각형이 겹치면 다음을 처리한다.

- `player.enabled = false`
- 속도 초기화
- 클리어 UI 표시
- `R` 입력만 허용

---

## 15. 최소 상태

별도 상태 머신 클래스 없이 현재 값에서 상태를 계산한다.

| 우선순위 | 조건 | 상태 |
|---:|---|---|
| 1 | `enabled === false` | `disabled` |
| 2 | `grounded === false && velocityY < 0` | `jump` |
| 3 | `grounded === false && velocityY >= 0` | `fall` |
| 4 | `Math.abs(velocityX) > 1` | `run` |
| 5 | 그 외 | `idle` |

이 값은 색상이나 디버그 텍스트를 선택하는 용도로만 사용한다.

---

## 16. 디버그 표시

개발 모드에서 다음 값을 HTML의 `<pre id="debug">`에 표시한다.

- `x`, `y`
- `velocityX`, `velocityY`
- `grounded`
- 현재 상태
- `coyoteTimer`
- `jumpBufferTimer`
- FPS

백틱 키로 표시 여부를 전환한다.

---

## 17. 검증 시나리오

### 기본 이동

- 반대 방향 입력 시 자연스럽게 방향을 전환한다.
- 입력을 놓으면 설정된 시간 안에 멈춘다.
- 벽을 향해 계속 입력해도 벽 안으로 들어가지 않는다.

### 점프

- 정지 상태와 달리는 상태에서 점프 높이가 같다.
- 짧은 점프가 긴 점프보다 명확히 낮다.
- 발판 가장자리에서 0.10초 이내에 누른 점프가 실행된다.
- 착지 0.12초 이내 전에 누른 점프가 착지와 함께 실행된다.
- 점프 키를 계속 누르고 있어도 자동으로 다시 점프하지 않는다.

### 시간 독립성

- 60Hz와 120Hz 디스플레이에서 같은 시간 동안 이동한 거리를 비교한다.
- 브라우저 개발자 도구로 CPU를 제한해도 게임 속도 자체가 빨라지거나 느려지지 않는다.
- 탭을 전환했다가 돌아와도 플레이어가 한 번에 먼 거리를 이동하지 않는다.

### 리스폰

- 어떤 속도로 낙사해도 시작 위치에서 정지 상태로 복귀한다.
- 10회 연속 리스폰해도 입력과 카메라가 정상 동작한다.

---

## 18. 튜닝 순서

한 번에 하나의 변수군만 조정한다.

1. `JUMP_VELOCITY`와 `RISE_GRAVITY`로 최대 점프 높이 결정
2. `FALL_GRAVITY`로 낙하 감각과 전체 체공 시간 결정
3. `JUMP_CUT_GRAVITY`로 짧은 점프 높이 결정
4. `MAX_RUN_SPEED`로 기본 진행 속도 결정
5. 지상 가속과 감속으로 반응성 결정
6. 공중 가속과 감속으로 공중 제어 결정
7. 코요테 타임과 점프 버퍼로 관대함 조정

각 변경 후 동일한 테스트 구간에서 최대 점프 높이, 최대 점프 거리, 정지 거리를 기록한다.

---

## 19. 구현 완료 조건

- [x] Canvas와 고정 시간 게임 루프가 구현됨
- [x] 키 입력 상태와 일회성 입력이 구분됨
- [x] 좌우 이동과 감속이 구현됨
- [x] 상승/하강 중력이 분리됨
- [x] X축/Y축 사각형 충돌이 구현됨
- [x] 가변 점프가 구현됨
- [x] 코요테 타임이 구현됨
- [x] 점프 입력 버퍼가 구현됨
- [x] 최대 낙하 속도가 적용됨
- [x] 낙사 리스폰 시 위치와 속도가 초기화됨
- [x] 도착점에서 입력이 잠김
- [x] 디버그 값 확인 가능
- [ ] 서로 다른 디스플레이 주사율에서 검증 통과

이 체크리스트가 완료되면 다음 구현 단계는 기능 추가가 아니라 그레이박스 레벨에서의 이동 플레이 테스트다.
