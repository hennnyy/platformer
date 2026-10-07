"use strict";

// 선언하지 않은 변수 사용 등 실수를 조기에 찾기 위해 엄격 모드를 사용한다.

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

// Canvas 내부의 논리 해상도다. CSS가 화면에 맞게 확대·축소한다.
const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;

// 물리를 초당 60번 계산하기 위한 한 번의 고정 시간 간격(초)이다.
const FIXED_DT = 1 / 60;

// 탭 복귀 시 밀린 시간을 한꺼번에 처리하는 현상을 막는 최대 프레임 시간이다.
const MAX_FRAME_TIME = 0.25;

// 접지 중 경사면을 따라갈 수 있는 한 프레임의 최대 높이 차이다.
// 현재 최대 이동 속도와 경사도보다 여유 있게 두되, 멀리 있는 경사로로 순간 이동하지 않게 제한한다.
const SLOPE_SNAP_DISTANCE = 14;

// 플레이어 조작감을 결정하는 물리 상수 모음이다. Object.freeze로 실행 중 변경을 막는다.
const PHYSICS = Object.freeze({
  maxRunSpeed: 260, // 최대 수평 속도(px/s)
  groundAcceleration: 2200, // 지상에서 이동 키를 누를 때 가속도(px/s²)
  groundDeceleration: 2600, // 지상에서 이동 키를 놓았을 때 감속도(px/s²)
  airAcceleration: 1400, // 공중에서 방향을 바꿀 때 가속도(px/s²)
  airDeceleration: 700, // 공중에서 이동 키를 놓았을 때 감속도(px/s²)
  jumpVelocity: -520, // 점프 순간의 위쪽 속도. Canvas에서 위쪽은 음수다.
  riseGravity: 1420, // 점프 키를 누른 채 상승할 때 적용할 중력(px/s²)
  fallGravity: 2100, // 낙하 중 적용할 강한 중력(px/s²)
  jumpCutGravity: 3200, // 점프 키를 일찍 놓아 낮은 점프를 만들 때의 중력
  maxFallSpeed: 900, // 지나치게 빠른 낙하와 충돌 통과를 막는 제한 속도
  coyoteTime: 0.1, // 발판을 벗어난 직후에도 점프할 수 있는 시간(초)
  jumpBufferTime: 0.12, // 착지 직전의 점프 입력을 기억하는 시간(초)
});

// Canvas에 그리는 각 요소의 색상 팔레트다.
const COLORS = Object.freeze({
  skyTop: "#8fd5ff", // 하늘 그라데이션 위쪽
  skyBottom: "#def5ff", // 하늘 그라데이션 아래쪽
  farHill: "#9dcdbb", // 멀리 있는 산
  nearHill: "#5fa78e", // 가까이 있는 산
  platform: "#5b3a00", // 발판 윗면
  platformSide: "#5b3a00", // 발판 몸체
  grass: "#007b35", // 발판 위 잔디 선
  player: "#ffca5c", // 플레이어 기본 색
  playerShade: "#e7953c", // 플레이어 그림자와 다리
  playerEye: "#16232c", // 플레이어 눈
  goal: "#ff6f7f", // 도착 깃발
  goalPole: "#f4f7fb", // 도착 깃대
});

// 코드로 작성한 단일 스테이지 데이터다. 모든 좌표는 월드 기준 픽셀이다.
const LEVEL = Object.freeze({
  width: 3420, // 카메라가 이동할 수 있는 전체 월드 너비
  height: VIEW_HEIGHT, // 현재 스테이지의 기준 높이
  spawn: Object.freeze({ x: 90, y: 606 }), // 시작 및 낙사 후 부활 위치
  deathY: 820, // 플레이어 Y 좌표가 이 값을 넘으면 낙사 처리
  goal: Object.freeze({ x: 3290, y: 510, width: 48, height: 140 }), // 클리어 판정 영역

  // 충돌 가능한 지형 목록이다. 각 항목은 축에 정렬된 사각형(AABB)이다.
  platforms: Object.freeze([
    Object.freeze({ x: -80, y: 650, width: 600, height: 120 }),
    Object.freeze({ x: 330, y: 570, width: 86, height: 80 }),
    Object.freeze({ x: 620, y: 600, width: 190, height: 34 }),
    Object.freeze({ x: 880, y: 540, width: 170, height: 34 }),
    Object.freeze({ x: 1130, y: 650, width: 470, height: 120 }),
    Object.freeze({ x: 1425, y: 560, width: 90, height: 90 }),
    Object.freeze({ x: 1680, y: 590, width: 170, height: 34 }),
    Object.freeze({ x: 1930, y: 520, width: 180, height: 34 }),
    Object.freeze({ x: 2190, y: 650, width: 440, height: 120 }),
    Object.freeze({ x: 2480, y: 560, width: 82, height: 90 }),
    Object.freeze({ x: 2710, y: 590, width: 190, height: 34 }),
    Object.freeze({ x: 2980, y: 650, width: 500, height: 120 }),
    Object.freeze({ x: 3130, y: 555, width: 110, height: 30 }),
  ]),

  // 충돌 가능한 직선 경사면이다. 두 끝점을 잇는 선 아래쪽을 채워진 지형으로 취급한다.
  slopes: Object.freeze([
    // 오른쪽으로 갈수록 높아져 첫 지면과 낮은 발판을 연결한다.
    Object.freeze({ x1: 520, y1: 650, x2: 620, y2: 600 }),
    // 오른쪽으로 갈수록 낮아져 높은 발판과 다음 지면을 연결한다.
    Object.freeze({ x1: 1050, y1: 540, x2: 1130, y2: 650 }),
  ]),
});

// -----------------------------------------------------------------------------
// DOM references
// -----------------------------------------------------------------------------

// 실제 게임 화면을 표시하는 Canvas 요소다.
const canvas = document.querySelector("#game");

// 사각형, 글자, 배경 등을 그릴 Canvas 2D 렌더링 컨텍스트다.
const context = canvas.getContext("2d");

// 디버그 값과 결과 UI를 갱신할 HTML 요소들이다.
const debugPanel = document.querySelector("#debug");
const clearScreen = document.querySelector("#clear-screen");
const clearTime = document.querySelector("#clear-time");
const restartButton = document.querySelector("#restart-button");
const runTime = document.querySelector("#run-time");
const statusPill = document.querySelector("#status-pill");

// 터치 기기에서 표시되는 왼쪽·오른쪽·점프·재시작 버튼의 컨테이너다.
const mobileControls = document.querySelector("#mobile-controls");

if (!context) {
  throw new Error("Canvas 2D API를 사용할 수 없습니다.");
}

// 배경 곡선과 확대된 Canvas가 부드럽게 보이도록 보간을 허용한다.
context.imageSmoothingEnabled = true;

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/** 숫자를 minimum과 maximum 사이로 제한한다. */
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

/** 현재 값을 한 번에 maxDelta만큼 목표 값에 가까워지게 한다. */
function moveToward(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

/** 두 값 사이를 amount(0~1) 비율로 보간한다. */
function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

/** 위치와 크기를 가진 두 AABB 사각형이 겹치는지 검사한다. */
function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** 경사로의 왼쪽·오른쪽 끝점을 정렬해 방향과 관계없이 계산할 수 있게 한다. */
function getOrderedSlope(slope) {
  if (slope.x1 <= slope.x2) {
    return {
      leftX: slope.x1,
      leftY: slope.y1,
      rightX: slope.x2,
      rightY: slope.y2,
    };
  }

  return {
    leftX: slope.x2,
    leftY: slope.y2,
    rightX: slope.x1,
    rightY: slope.y1,
  };
}

/** 지정한 X 좌표가 경사로 안에 있으면 표면 Y 좌표를, 아니면 null을 반환한다. */
function getSlopeYAtX(slope, x) {
  const ordered = getOrderedSlope(slope);
  const width = ordered.rightX - ordered.leftX;

  // 세로선은 바닥 경사로 계산에 사용할 수 없으며, 선분 밖의 X 좌표도 제외한다.
  if (width <= 0 || x < ordered.leftX || x > ordered.rightX) return null;

  const amount = (x - ordered.leftX) / width;
  return lerp(ordered.leftY, ordered.rightY, amount);
}

/** 잘못된 경사로 데이터가 조용히 충돌 오류를 만들지 않도록 시작 시 좌표를 검사한다. */
function validateSlopes(slopes) {
  for (const [index, slope] of slopes.entries()) {
    const coordinates = [slope.x1, slope.y1, slope.x2, slope.y2];
    const hasInvalidCoordinate = coordinates.some((value) => !Number.isFinite(value));
    const hasNoHorizontalLength = slope.x1 === slope.x2;
    const hasNoVerticalHeight = slope.y1 === slope.y2;

    if (hasInvalidCoordinate || hasNoHorizontalLength || hasNoVerticalHeight) {
      throw new Error(`LEVEL.slopes[${index}]의 좌표가 올바르지 않습니다.`);
    }
  }
}

// 게임 루프를 시작하기 전에 레벨의 모든 경사로 데이터가 계산 가능한지 확인한다.
validateSlopes(LEVEL.slopes);

/**
 * CanvasRenderingContext2D.roundRect() 없이 둥근 사각형을 채운다.
 * 오래된 모바일 브라우저에서도 동작하며, radius는 숫자 또는
 * [왼쪽 위, 오른쪽 위, 오른쪽 아래, 왼쪽 아래] 배열을 받을 수 있다.
 */
function fillRoundedRect(ctx, x, y, width, height, radius = 0) {
  const radiusValues = Array.isArray(radius)
    ? radius
    : [radius, radius, radius, radius];
  const maximumRadius = Math.min(Math.abs(width), Math.abs(height)) / 2;

  // 빠진 배열 값은 첫 번째 값을 사용하고, 사각형 크기보다 큰 반경은 제한한다.
  const topLeft = clamp(Number(radiusValues[0] ?? 0), 0, maximumRadius);
  const topRight = clamp(Number(radiusValues[1] ?? radiusValues[0] ?? 0), 0, maximumRadius);
  const bottomRight = clamp(Number(radiusValues[2] ?? radiusValues[0] ?? 0), 0, maximumRadius);
  const bottomLeft = clamp(Number(radiusValues[3] ?? radiusValues[1] ?? radiusValues[0] ?? 0), 0, maximumRadius);

  ctx.beginPath();
  ctx.moveTo(x + topLeft, y);
  ctx.lineTo(x + width - topRight, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + topRight);
  ctx.lineTo(x + width, y + height - bottomRight);
  ctx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);
  ctx.lineTo(x + bottomLeft, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);
  ctx.lineTo(x, y + topLeft);
  ctx.quadraticCurveTo(x, y, x + topLeft, y);
  ctx.closePath();
  ctx.fill();
}

/** 밀리초를 화면에 표시할 MM:SS.mmm 문자열로 바꾼다. */
function formatTime(milliseconds) {
  // 음수 시간이 UI에 표시되지 않도록 방어한다.
  const safeMilliseconds = Math.max(0, milliseconds);
  const minutes = Math.floor(safeMilliseconds / 60000);
  const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
  const millis = Math.floor(safeMilliseconds % 1000);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

/**
 * 브라우저 키 이벤트를 게임에서 읽기 쉬운 행동 상태로 변환한다.
 * 키 이벤트 안에서는 물리를 계산하지 않고 상태만 기록한다.
 */
class InputState {
  constructor() {
    // 키를 계속 누르고 있는 동안 true인 지속 입력이다.
    this.left = false;
    this.right = false;
    this.jump = false;

    // 한 번의 물리 업데이트에서만 true인 일회성 입력이다.
    this.jumpPressed = false;
    this.jumpReleased = false;
    this.restartPressed = false;
    this.debugPressed = false;

    // 동시에 여러 손가락을 누를 수 있도록 pointerId별 행동과 버튼을 기억한다.
    this.touchPointers = new Map();

    // 이벤트 리스너 안에서도 현재 InputState 객체를 가리키도록 this를 고정한다.
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.clearHeld = this.clearHeld.bind(this);

    // 창이 포커스를 잃으면 입력이 계속 눌린 상태로 남지 않도록 blur도 감시한다.
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearHeld);

    // Pointer Events를 사용하면 터치, 펜, 마우스를 하나의 코드로 처리할 수 있다.
    this.bindTouchControls(mobileControls);
  }

  /** 모바일 조작 버튼의 Pointer Events를 현재 입력 상태에 연결한다. */
  bindTouchControls(container) {
    // 모바일 조작부가 없는 페이지에서도 키보드 입력은 계속 동작하게 한다.
    if (!container) return;

    const buttons = container.querySelectorAll("[data-action]");

    for (const button of buttons) {
      button.addEventListener("pointerdown", (event) => {
        // 손가락 이동이 페이지 스크롤이나 확대 제스처로 전달되지 않게 한다.
        event.preventDefault();

        const action = button.dataset.action;
        const pointerId = event.pointerId;

        // 버튼 밖에서 손가락을 놓아도 pointerup을 받을 수 있게 포인터를 캡처한다.
        button.setPointerCapture(pointerId);
        this.touchPointers.set(pointerId, { action, button });
        button.classList.add("is-pressed");
        button.setAttribute("aria-pressed", "true");

        if (action === "restart") {
          this.restartPressed = true;
          return;
        }

        this.setTouchAction(action, true);
      });

      // pointercancel은 전화 알림이나 시스템 제스처가 터치를 중단한 경우에도 발생한다.
      for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
        button.addEventListener(eventName, (event) => {
          this.releaseTouchPointer(event.pointerId);
        });
      }

      // 길게 눌렀을 때 브라우저의 우클릭 메뉴가 열리는 것을 막는다.
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    }
  }

  /** 터치 버튼의 지속 입력을 키보드 입력과 같은 left/right/jump 값에 반영한다. */
  setTouchAction(action, pressed) {
    if (action === "left") this.left = pressed;
    if (action === "right") this.right = pressed;

    if (action === "jump") {
      // 점프를 처음 누르는 순간만 jumpPressed를 true로 만들어 중복 점프를 막는다.
      if (pressed && !this.jump) this.jumpPressed = true;
      if (!pressed && this.jump) this.jumpReleased = true;
      this.jump = pressed;
    }
  }

  /** 끝난 손가락 입력을 제거하고 같은 행동을 누르는 다른 손가락이 없으면 키를 놓는다. */
  releaseTouchPointer(pointerId) {
    const pointer = this.touchPointers.get(pointerId);
    if (!pointer) return;

    this.touchPointers.delete(pointerId);

    // 같은 버튼에 다른 손가락이 남아 있으면 지속 입력과 눌림 표시를 유지한다.
    const actionStillHeld = Array.from(this.touchPointers.values())
      .some(({ action }) => action === pointer.action);
    const buttonStillHeld = Array.from(this.touchPointers.values())
      .some(({ button }) => button === pointer.button);

    if (!actionStillHeld && pointer.action !== "restart") {
      this.setTouchAction(pointer.action, false);
    }

    if (!buttonStillHeld) {
      pointer.button.classList.remove("is-pressed");
      pointer.button.setAttribute("aria-pressed", "false");
    }
  }

  /** 실제 키 코드를 게임 행동 이름으로 변환한다. */
  static actionForCode(code) {
    // 여러 키를 같은 행동에 연결할 수 있는 간단한 키 매핑 표다.
    const actions = {
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right",
      Space: "jump",
      KeyR: "restart",
      Backquote: "debug",
    };

    return actions[code] ?? null;
  }

  /** 키를 누를 때 지속 입력과 최초 1회 입력을 기록한다. */
  onKeyDown(event) {
    const action = InputState.actionForCode(event.code);
    if (!action) return;

    // 방향키와 Space로 브라우저 페이지가 스크롤되는 것을 막는다.
    event.preventDefault();

    if (action === "left") this.left = true;
    if (action === "right") this.right = true;

    if (action === "jump") {
      if (!this.jump && !event.repeat) this.jumpPressed = true;
      this.jump = true;
    }

    if (action === "restart" && !event.repeat) this.restartPressed = true;
    if (action === "debug" && !event.repeat) this.debugPressed = true;
  }

  /** 키를 놓을 때 지속 입력을 해제한다. */
  onKeyUp(event) {
    const action = InputState.actionForCode(event.code);
    if (!action) return;

    event.preventDefault();

    if (action === "left") this.left = false;
    if (action === "right") this.right = false;

    if (action === "jump") {
      if (this.jump) this.jumpReleased = true;
      this.jump = false;
    }
  }

  /** 탭 전환 등으로 창이 비활성화되면 눌린 키 상태를 모두 해제한다. */
  clearHeld() {
    this.left = false;
    this.right = false;
    this.jump = false;
    this.jumpReleased = true;

    // 창이 비활성화되면 남아 있는 모든 터치 포인터와 버튼 표시도 함께 정리한다.
    for (const { button } of this.touchPointers.values()) {
      button.classList.remove("is-pressed");
      button.setAttribute("aria-pressed", "false");
    }
    this.touchPointers.clear();
  }

  /** 왼쪽은 -1, 정지는 0, 오른쪽은 1인 수평 입력값을 반환한다. */
  get axis() {
    return Number(this.right) - Number(this.left);
  }

  /** 한 물리 프레임에서 소비한 일회성 입력을 초기화한다. */
  finishPhysicsStep() {
    this.jumpPressed = false;
    this.jumpReleased = false;
    this.restartPressed = false;
    this.debugPressed = false;
  }
}

// -----------------------------------------------------------------------------
// Player
// -----------------------------------------------------------------------------

/** 플레이어의 물리 상태, 이동 규칙, 지형 충돌을 관리한다. */
class Player {
  constructor(spawn) {
    // 플레이어 충돌 사각형의 크기다.
    this.width = 28;
    this.height = 44;

    // 1은 오른쪽, -1은 왼쪽을 바라본다는 뜻이다.
    this.facing = 1;
    this.reset(spawn);
  }

  /** 플레이어의 위치와 이동 상태를 지정한 시작점으로 되돌린다. */
  reset(spawn) {
    // 현재 월드 위치다. x, y는 플레이어 사각형의 왼쪽 위 좌표다.
    this.x = spawn.x;
    this.y = spawn.y;

    // 현재와 이전 위치를 보간하여 부드럽게 그릴 때 사용한다.
    this.previousX = this.x;
    this.previousY = this.y;

    // 초당 이동할 픽셀 수를 나타내는 수평·수직 속도다.
    this.velocityX = 0;
    this.velocityY = 0;

    // 바닥에 닿아 있는지 나타내는 충돌 결과다.
    this.grounded = false;

    // 현재 접지한 표면 종류와 경사면 접촉점을 디버그 표시에 사용한다.
    this.groundType = "none";
    this.slopeContact = null;

    // 관대한 점프 조작을 위한 남은 허용 시간이다.
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;

    // false이면 클리어 연출 중처럼 이동 입력과 물리 이동을 중지한다.
    this.enabled = true;
  }

  /** 현재 물리 값에서 화면 표현용 이동 상태를 계산한다. */
  get state() {
    if (!this.enabled) return "disabled";
    if (!this.grounded && this.velocityY < 0) return "jump";
    if (!this.grounded && this.velocityY >= 0) return "fall";
    if (Math.abs(this.velocityX) > 1) return "run";
    return "idle";
  }

  /** 입력을 속도로 변환하고 중력과 충돌을 적용하는 고정 물리 업데이트다. */
  update(input, platforms, slopes, dt) {
    // 렌더링 보간에 사용하도록 이동 전 위치를 보관한다.
    this.previousX = this.x;
    this.previousY = this.y;

    if (!this.enabled) {
      this.velocityX = 0;
      this.velocityY = 0;
      return;
    }

    // 점프를 조금 일찍 눌러도 다음 착지에서 실행되도록 입력을 기억한다.
    if (input.jumpPressed) {
      this.jumpBufferTimer = PHYSICS.jumpBufferTime;
    } else {
      this.jumpBufferTimer = Math.max(this.jumpBufferTimer - dt, 0);
    }

    // 마지막 접지 시점부터 잠시 동안 점프를 허용한다.
    if (this.grounded) {
      this.coyoteTimer = PHYSICS.coyoteTime;
    } else {
      this.coyoteTimer = Math.max(this.coyoteTimer - dt, 0);
    }

    // 저장된 점프 입력과 점프 가능 시간이 모두 남아 있을 때 점프한다.
    if (this.jumpBufferTimer > 0 && (this.grounded || this.coyoteTimer > 0)) {
      this.velocityY = PHYSICS.jumpVelocity;
      this.grounded = false;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
    }

    // -1, 0, 1 중 하나인 수평 입력 방향이다.
    const inputAxis = input.axis;
    if (inputAxis !== 0) this.facing = inputAxis;

    // 지상/공중 여부와 입력 유무에 따라 가속 또는 감속 값을 선택한다.
    const acceleration = inputAxis === 0
      ? (this.grounded ? PHYSICS.groundDeceleration : PHYSICS.airDeceleration)
      : (this.grounded ? PHYSICS.groundAcceleration : PHYSICS.airAcceleration);

    this.velocityX = moveToward(
      this.velocityX,
      inputAxis * PHYSICS.maxRunSpeed,
      acceleration * dt,
    );

    // 상승 중 점프 키를 놓으면 더 강한 중력을 적용해 낮은 점프를 만든다.
    const gravity = this.velocityY < 0
      ? (input.jump ? PHYSICS.riseGravity : PHYSICS.jumpCutGravity)
      : PHYSICS.fallGravity;

    this.velocityY = Math.min(
      this.velocityY + gravity * dt,
      PHYSICS.maxFallSpeed,
    );

    this.moveAndCollide(platforms, slopes, dt);
  }

  /**
   * X축과 Y축을 따로 이동시킨 뒤 겹침을 되돌리는 AABB 충돌 처리다.
   * 축을 분리하면 벽 충돌과 바닥 충돌을 단순하게 구분할 수 있다.
   */
  moveAndCollide(platforms, slopes, dt) {
    // 이전 프레임의 접지 상태는 내리막 경사면을 자연스럽게 따라갈 때 사용한다.
    const wasGrounded = this.grounded;

    // 먼저 X축으로 이동한 뒤 벽과 겹친 부분을 보정한다.
    this.x += this.velocityX * dt;

    // 접지 상태로 이동 중이면 새 중심점의 경사 높이를 먼저 적용한다.
    // 오르막 끝의 사각형 발판 옆면에 플레이어가 걸리는 현상을 예방한다.
    if (wasGrounded && this.velocityY >= 0) {
      this.followNearbySlope(slopes);
    }

    for (const platform of platforms) {
      if (!overlaps(this, platform)) continue;

      // 경사로 끝점과 이어진 발판의 옆면은 바닥 전환 구간이므로 벽으로 처리하지 않는다.
      if (wasGrounded && this.isSlopePlatformTransition(platform, slopes)) continue;

      if (this.velocityX > 0) {
        this.x = platform.x - this.width;
      } else if (this.velocityX < 0) {
        this.x = platform.x + platform.width;
      }

      this.velocityX = 0;
    }

    // 다음으로 Y축을 이동한다. 이번 프레임에 바닥 충돌이 확인되면 다시 true가 된다.
    this.grounded = false;
    this.groundType = "none";
    this.slopeContact = null;

    // 경사면을 위에서 통과했는지 판정할 때 사용할 이동 전 발 위치와 낙하 속도다.
    const bottomBeforeVerticalMove = this.y + this.height;
    const verticalVelocity = this.velocityY;
    this.y += this.velocityY * dt;

    for (const platform of platforms) {
      if (!overlaps(this, platform)) continue;

      if (this.velocityY > 0) {
        this.y = platform.y - this.height;
        this.grounded = true;
        this.groundType = "platform";
      } else if (this.velocityY < 0) {
        this.y = platform.y + platform.height;
      }

      this.velocityY = 0;
    }

    // 사각형 바닥에 먼저 착지하지 않았다면 위에서 통과한 경사면에 착지시킨다.
    if (!this.grounded && verticalVelocity >= 0) {
      this.landOnSlope(slopes, bottomBeforeVerticalMove);
    }
  }

  /** 현재 접촉이 경사로와 사각형 발판의 연결부에서 생긴 옆면 충돌인지 확인한다. */
  isSlopePlatformTransition(platform, slopes) {
    const centerX = this.x + this.width / 2;
    const currentBottom = this.y + this.height;
    const epsilon = 0.01;

    for (const slope of slopes) {
      const ordered = getOrderedSlope(slope);

      // 경사로 끝점과 발판 윗면 모서리가 같은 좌표에 연결되어야 한다.
      const connectedToLeft = (
        Math.abs(platform.x + platform.width - ordered.leftX) <= epsilon &&
        Math.abs(platform.y - ordered.leftY) <= epsilon
      );
      const connectedToRight = (
        Math.abs(platform.x - ordered.rightX) <= epsilon &&
        Math.abs(platform.y - ordered.rightY) <= epsilon
      );
      if (!connectedToLeft && !connectedToRight) continue;

      // 플레이어 중심이 선분에 들어가기 직전에도 앞쪽 모서리가 발판과 겹칠 수 있어
      // 플레이어 반 너비만큼 검사 범위를 넓힌다.
      if (
        centerX < ordered.leftX - this.width / 2 ||
        centerX > ordered.rightX + this.width / 2
      ) continue;

      const sampleX = clamp(centerX, ordered.leftX, ordered.rightX);
      const surfaceY = getSlopeYAtX(slope, sampleX);
      if (surfaceY !== null && Math.abs(surfaceY - currentBottom) <= SLOPE_SNAP_DISTANCE) {
        return true;
      }
    }

    return false;
  }

  /** 접지 상태에서 가까운 경사면을 찾아 플레이어 발 높이를 표면에 맞춘다. */
  followNearbySlope(slopes) {
    const centerX = this.x + this.width / 2;
    const currentBottom = this.y + this.height;
    let closest = null;

    for (const slope of slopes) {
      const surfaceY = getSlopeYAtX(slope, centerX);
      if (surfaceY === null) continue;

      const distance = Math.abs(surfaceY - currentBottom);
      if (distance > SLOPE_SNAP_DISTANCE) continue;
      if (!closest || distance < closest.distance) {
        closest = { slope, surfaceY, distance };
      }
    }

    if (!closest) return;

    this.y = closest.surfaceY - this.height;
    this.velocityY = 0;
    this.grounded = true;
    this.groundType = "slope";
    this.slopeContact = { x: centerX, y: closest.surfaceY };
  }

  /** 낙하 중 플레이어의 발이 경사면을 통과하면 가장 위쪽 표면에 착지시킨다. */
  landOnSlope(slopes, bottomBeforeVerticalMove) {
    const centerX = this.x + this.width / 2;
    const currentBottom = this.y + this.height;
    let landing = null;

    for (const slope of slopes) {
      const surfaceY = getSlopeYAtX(slope, centerX);
      if (surfaceY === null) continue;

      // 이전 발 위치가 표면 위이고 현재 발 위치가 표면에 닿거나 통과한 경우만 착지한다.
      // 따라서 경사로 아래에서 점프할 때 표면 위로 순간 이동하지 않는다.
      if (bottomBeforeVerticalMove > surfaceY + 0.5 || currentBottom < surfaceY) continue;
      if (!landing || surfaceY < landing.surfaceY) {
        landing = { slope, surfaceY };
      }
    }

    if (!landing) return;

    this.y = landing.surfaceY - this.height;
    this.velocityY = 0;
    this.grounded = true;
    this.groundType = "slope";
    this.slopeContact = { x: centerX, y: landing.surfaceY };
  }
}

// -----------------------------------------------------------------------------
// Game
// -----------------------------------------------------------------------------

/**
 * 게임 전체의 진행 상태를 관리하는 중심 객체다.
 * 플레이어 업데이트, 카메라, 클리어 판정, 화면 그리기, UI 갱신을 조율한다.
 */
class Game {
  constructor(input) {
    // 키보드 이벤트를 게임 행동으로 변환해 주는 입력 객체다.
    this.input = input;

    // 현재 스테이지에서 사용하는 플레이어 객체다.
    this.player = new Player(LEVEL.spawn);

    // 월드의 어느 지점부터 화면에 표시할지 나타내는 가로 카메라 좌표다.
    this.cameraX = 0;

    // 렌더링 보간에 사용하는 직전 물리 프레임의 카메라 좌표다.
    this.previousCameraX = 0;

    // 게임 진행 상태다. 현재는 "playing"과 "cleared" 두 값을 사용한다.
    this.state = "playing";

    // 스테이지 시작 후 흐른 시간과 클리어 순간에 확정된 기록이다.
    this.elapsedMilliseconds = 0;
    this.clearMilliseconds = 0;

    // 현재 플레이에서 낙사 후 부활한 횟수다. 디버그 패널에 표시한다.
    this.respawnCount = 0;

    // 디버그 패널의 표시 여부다.
    this.debugVisible = false;

    // FPS 표시를 계산하기 위한 현재 FPS, 누적 시간, 누적 프레임 수다.
    this.fps = 0;
    this.fpsAccumulator = 0;
    this.fpsFrames = 0;

    // 생성 직후 게임 상태가 HTML UI에도 반영되도록 한다.
    this.syncUi();
  }

  /** 플레이어, 카메라, 시간, 진행 상태를 처음 상태로 되돌린다. */
  restart() {
    this.player.reset(LEVEL.spawn);
    this.cameraX = 0;
    this.previousCameraX = 0;
    this.state = "playing";
    this.elapsedMilliseconds = 0;
    this.clearMilliseconds = 0;
    this.respawnCount = 0;
    this.syncUi();

    // 결과 화면 버튼에 있던 포커스를 Canvas로 되돌려 키보드 조작을 받는다.
    canvas.focus({ preventScroll: true });
  }

  /** 낙사했을 때 플레이 기록은 유지하고 플레이어와 카메라만 시작점으로 되돌린다. */
  respawn() {
    this.player.reset(LEVEL.spawn);
    this.cameraX = 0;
    this.previousCameraX = 0;
    this.respawnCount += 1;
  }

  /** 도착점에 닿으면 조작을 잠그고 기록을 확정한 뒤 결과 화면을 표시한다. */
  complete() {
    // 이미 클리어된 상태에서 중복 실행되는 것을 막는다.
    if (this.state !== "playing") return;

    this.state = "cleared";
    this.player.enabled = false;
    this.player.velocityX = 0;
    this.player.velocityY = 0;
    this.clearMilliseconds = this.elapsedMilliseconds;
    this.syncUi();

    // 키보드 사용자도 Enter로 다시 플레이 버튼을 누를 수 있게 한다.
    restartButton.focus({ preventScroll: true });
  }

  /** 한 번의 고정 물리 프레임에서 게임 상태를 갱신한다. */
  update(dt) {
    // 백틱 입력이 들어오면 디버그 패널을 켜거나 끈다.
    if (this.input.debugPressed) {
      this.debugVisible = !this.debugVisible;
      debugPanel.hidden = !this.debugVisible;
    }

    // 재시작은 다른 물리 및 판정보다 먼저 처리한다.
    if (this.input.restartPressed) {
      this.restart();
      this.input.finishPhysicsStep();
      return;
    }

    // 이동 전 카메라 위치를 보관해 렌더링 시 중간 위치를 계산한다.
    this.previousCameraX = this.cameraX;

    if (this.state === "playing") {
      // 고정 시간 간격을 밀리초로 바꿔 플레이 기록에 누적한다.
      this.elapsedMilliseconds += dt * 1000;

      // 현재 입력과 스테이지 발판을 이용해 플레이어 물리를 갱신한다.
      this.player.update(this.input, LEVEL.platforms, LEVEL.slopes, dt);

      // 플레이어가 화면 아래로 떨어졌는지, 도착점에 닿았는지 확인한다.
      if (this.player.y > LEVEL.deathY) {
        this.respawn();
      } else if (overlaps(this.player, LEVEL.goal)) {
        this.complete();
      }

      // 플레이어를 화면 너비의 42% 지점에 두어 진행 방향을 더 넓게 보여준다.
      const cameraTarget = this.player.x + this.player.width / 2 - VIEW_WIDTH * 0.42;

      // 카메라가 레벨 오른쪽 끝을 넘어갈 수 있는 최대 좌표다.
      const maxCameraX = Math.max(0, LEVEL.width - VIEW_WIDTH);

      // 카메라를 목표 위치로 부드럽게 이동시키고 레벨 범위 안으로 제한한다.
      this.cameraX = clamp(
        moveToward(this.cameraX, cameraTarget, 620 * dt),
        0,
        maxCameraX,
      );
    }

    // 이번 물리 프레임에서 사용한 jumpPressed 같은 일회성 입력을 비운다.
    this.input.finishPhysicsStep();
  }

  /** 실제 렌더 프레임을 0.5초 동안 모아 화면 표시용 FPS를 계산한다. */
  updateFps(frameTime) {
    this.fpsAccumulator += frameTime;
    this.fpsFrames += 1;

    if (this.fpsAccumulator >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccumulator);
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
    }
  }

  /**
   * 현재 게임 화면을 Canvas에 그린다.
   * alpha는 두 고정 물리 프레임 사이의 위치를 부드럽게 보간하는 비율이다.
   */
  render(alpha) {
    // 직전 위치와 현재 위치 사이를 보간해 높은 주사율에서도 움직임을 부드럽게 한다.
    const cameraX = lerp(this.previousCameraX, this.cameraX, alpha);
    const playerX = lerp(this.player.previousX, this.player.x, alpha);
    const playerY = lerp(this.player.previousY, this.player.y, alpha);

    // 뒤에서 앞으로 그려야 가려짐 순서가 자연스럽다.
    this.drawBackground(cameraX);
    this.drawLevel(cameraX);
    this.drawGoal(cameraX);
    this.drawPlayer(playerX - cameraX, playerY);
    this.drawProgress();

    // 클리어 후에는 계속 증가하는 시간 대신 확정된 기록을 표시한다.
    runTime.textContent = formatTime(
      this.state === "cleared" ? this.clearMilliseconds : this.elapsedMilliseconds,
    );

    if (this.debugVisible) this.renderDebug();
  }

  /** 하늘, 태양, 구름, 원경 산을 카메라 이동량에 맞춰 그린다. */
  drawBackground(cameraX) {
    // 화면 전체를 채우는 하늘색 세로 그라데이션이다.
    const gradient = context.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    gradient.addColorStop(0, COLORS.skyTop);
    gradient.addColorStop(1, COLORS.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    context.fillStyle = "rgba(255,255,255,0.8)";
    context.beginPath();
    context.arc(1080, 115, 52, 0, Math.PI * 2);
    context.fill();

    // 먼 산일수록 카메라보다 느리게 이동시켜 거리감을 만든다.
    this.drawHillLayer(cameraX * 0.12, 520, 170, COLORS.farHill, 330);
    this.drawHillLayer(cameraX * 0.25, 600, 125, COLORS.nearHill, 260);

    context.fillStyle = "rgba(255,255,255,0.45)";
    // 구름은 타원 두 개를 겹쳐 그리고 화면 밖에서 반복되게 한다.
    for (let index = 0; index < 7; index += 1) {
      const cloudX = ((index * 310 - cameraX * 0.08) % 2200 + 2200) % 2200 - 180;
      const cloudY = 90 + (index % 3) * 58;
      context.beginPath();
      context.ellipse(cloudX, cloudY, 52, 18, 0, 0, Math.PI * 2);
      context.ellipse(cloudX + 38, cloudY + 2, 36, 14, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  /** 곡선을 일정 간격으로 반복해 한 겹의 산 실루엣을 그린다. */
  drawHillLayer(offset, baseline, height, color, spacing) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, VIEW_HEIGHT);
    context.lineTo(0, baseline);

    // 카메라 오프셋을 반영한 첫 곡선 위치다.
    const start = -spacing - (offset % spacing);
    for (let x = start; x < VIEW_WIDTH + spacing; x += spacing) {
      context.quadraticCurveTo(
        x + spacing * 0.5,
        baseline - height,
        x + spacing,
        baseline,
      );
    }

    context.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
    context.closePath();
    context.fill();
  }

  /** 충돌 지형과 스테이지 안의 안내 문구를 그린다. */
  drawLevel(cameraX) {
    for (const platform of LEVEL.platforms) {
      // 월드 X 좌표에서 카메라 좌표를 빼 Canvas 화면 좌표로 변환한다.
      const screenX = Math.round(platform.x - cameraX);

      // 발판 몸체를 먼저 어두운 색으로 채운다.
      context.fillStyle = COLORS.platformSide;
      fillRoundedRect(
        context,
        screenX,
        platform.y,
        platform.width,
        platform.height,
        [10, 10, 0, 0],
      );

      // 발판 위쪽에 짧은 그라데이션을 넣어 두께를 표현한다.
      const platformGradient = context.createLinearGradient(0, platform.y, 0, platform.y + 28);
      platformGradient.addColorStop(0, COLORS.platform);
      platformGradient.addColorStop(1, COLORS.platformSide);
      context.fillStyle = platformGradient;
      fillRoundedRect(
        context,
        screenX,
        platform.y,
        platform.width,
        Math.min(platform.height, 34),
        10,
      );

      // 실제 충돌면을 알아보기 쉽도록 가장 위에 밝은 잔디 선을 그린다.
      context.fillStyle = COLORS.grass;
      fillRoundedRect(
        context,
        screenX,
        platform.y,
        platform.width,
        7,
        [5, 5, 0, 0],
      );

      context.fillStyle = "rgba(255,255,255,0.08)";
      for (let x = 12; x < platform.width; x += 38) {
        context.fillRect(screenX + x, platform.y + 18, 18, 3);
      }
    }

    // 경사로 몸체를 선분 아래쪽까지 채워 기존 발판과 같은 흙 지형으로 표현한다.
    for (const slope of LEVEL.slopes) {
      const ordered = getOrderedSlope(slope);
      const leftX = ordered.leftX - cameraX;
      const rightX = ordered.rightX - cameraX;

      context.fillStyle = COLORS.platformSide;
      context.beginPath();
      context.moveTo(leftX, ordered.leftY);
      context.lineTo(rightX, ordered.rightY);
      context.lineTo(rightX, VIEW_HEIGHT);
      context.lineTo(leftX, VIEW_HEIGHT);
      context.closePath();
      context.fill();

      // 실제 충돌 표면과 같은 선에 잔디색을 그려 경사 방향을 분명하게 보여준다.
      context.strokeStyle = COLORS.grass;
      context.lineWidth = 7;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(leftX, ordered.leftY);
      context.lineTo(rightX, ordered.rightY);
      context.stroke();

      // 디버그 모드에서는 충돌에 사용하는 정확한 선분을 밝은 색으로 겹쳐 표시한다.
      if (this.debugVisible) {
        context.strokeStyle = "#00e5ff";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(leftX, ordered.leftY);
        context.lineTo(rightX, ordered.rightY);
        context.stroke();
      }
    }

    // 현재 플레이어가 경사면에 접지했다면 계산에 사용한 발 접촉점을 표시한다.
    if (this.debugVisible && this.player.slopeContact) {
      context.fillStyle = "#ff2d95";
      context.beginPath();
      context.arc(
        this.player.slopeContact.x - cameraX,
        this.player.slopeContact.y,
        6,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    this.drawWorldLabel(115, 620, "START", cameraX);
    this.drawWorldLabel(670, 567, "짧게 / 길게 점프", cameraX);
    this.drawWorldLabel(1720, 557, "떨어져도 바로 재시작", cameraX);
    this.drawWorldLabel(3025, 617, "GOAL →", cameraX);
  }

  /** 월드 좌표에 배치된 안내 문구를 현재 카메라 기준으로 그린다. */
  drawWorldLabel(x, y, text, cameraX) {
    const screenX = x - cameraX;

    // 화면에서 멀리 벗어난 글자는 그리지 않아 불필요한 렌더링을 줄인다.
    if (screenX < -220 || screenX > VIEW_WIDTH + 220) return;

    context.save();
    context.font = "700 14px system-ui, sans-serif";
    context.textAlign = "left";
    context.fillStyle = "rgba(12, 35, 44, 0.62)";
    context.fillText(text, screenX, y);
    context.restore();
  }

  /** LEVEL.goal 충돌 영역과 같은 위치에 깃대와 깃발을 그린다. */
  drawGoal(cameraX) {
    // 깃발도 월드 좌표에서 카메라 좌표를 빼 화면 위치를 구한다.
    const screenX = LEVEL.goal.x - cameraX;

    // 충돌 영역 안쪽 8px 지점에 실제 깃대를 배치한다.
    const poleX = screenX + 8;

    context.fillStyle = COLORS.goalPole;
    context.fillRect(poleX, LEVEL.goal.y, 7, LEVEL.goal.height);

    context.fillStyle = COLORS.goal;
    context.beginPath();
    context.moveTo(poleX + 7, LEVEL.goal.y + 8);
    context.lineTo(poleX + 62, LEVEL.goal.y + 27);
    context.lineTo(poleX + 7, LEVEL.goal.y + 48);
    context.closePath();
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.45)";
    context.beginPath();
    context.arc(poleX + 3.5, LEVEL.goal.y, 7, 0, Math.PI * 2);
    context.fill();
  }

  /** 플레이어를 현재 방향과 이동 상태에 맞는 단순 도형으로 그린다. */
  drawPlayer(screenX, screenY) {
    // 달리는 동안 몸체를 조금 위아래로 흔든다. 실제 충돌 위치에는 영향이 없다.
    const bob = this.player.state === "run"
      ? Math.sin(this.elapsedMilliseconds * 0.025) * 1.5
      : 0;
    // 반 픽셀 렌더링으로 흐려지지 않도록 최종 화면 좌표를 반올림한다.
    const x = Math.round(screenX);
    const y = Math.round(screenY + bob);

    // translate와 scale이 이후 렌더링에 영향을 주지 않도록 상태를 저장한다.
    context.save();

    // 플레이어 중심을 원점으로 이동하고 facing 값으로 좌우 방향을 뒤집는다.
    context.translate(x + this.player.width / 2, y + this.player.height / 2);
    context.scale(this.player.facing, 1);

    context.fillStyle = COLORS.playerShade;
    fillRoundedRect(context, -14, -18, 28, 38, 10);

    context.fillStyle = COLORS.player;
    fillRoundedRect(context, -14, -22, 28, 28, [10, 10, 0, 0]);
    

    context.fillStyle = COLORS.playerEye;
    context.fillRect(4, -13, 4, 5);

    context.fillStyle = "#ffffff";
    context.fillRect(5, -13, 1, 2);

    context.fillStyle = COLORS.playerShade;
    // 달릴 때 두 다리를 반대 방향으로 움직이는 간단한 절차적 애니메이션이다.
    const legOffset = this.player.state === "run"
      ? Math.sin(this.elapsedMilliseconds * 0.025) * 4
      : 0;
    context.fillRect(-10 + legOffset, 13, 8, 9);
    context.fillRect(2 - legOffset, 13, 8, 9);

    context.restore();
  }

  /** 시작점부터 도착점까지 진행한 비율을 화면 오른쪽 아래에 표시한다. */
  drawProgress() {
    // 진행률이 0보다 작거나 1보다 커지지 않게 제한한다.
    const progress = clamp(
      (this.player.x - LEVEL.spawn.x) / (LEVEL.goal.x - LEVEL.spawn.x),
      0,
      1,
    );
    // 진행 막대의 크기와 Canvas 안쪽 위치다.
    const width = 210;
    const x = VIEW_WIDTH - width - 24;
    const y = VIEW_HEIGHT - 25;

    context.fillStyle = "rgba(8, 24, 34, 0.25)";
    context.fillRect(x, y, width, 6);
    context.fillStyle = COLORS.goal;
    context.fillRect(x, y, width * progress, 6);
  }

  /** 플레이어 물리 상태와 FPS를 HTML 디버그 패널에 출력한다. */
  renderDebug() {
    debugPanel.textContent = [
      `state       ${this.player.state}`,
      `position    ${this.player.x.toFixed(2)}, ${this.player.y.toFixed(2)}`,
      `velocity    ${this.player.velocityX.toFixed(2)}, ${this.player.velocityY.toFixed(2)}`,
      `grounded    ${this.player.grounded}`,
      `ground type ${this.player.groundType}`,
      `coyote      ${this.player.coyoteTimer.toFixed(3)}`,
      `jump buffer ${this.player.jumpBufferTimer.toFixed(3)}`,
      `camera x    ${this.cameraX.toFixed(2)}`,
      `respawns    ${this.respawnCount}`,
      `fps         ${this.fps}`,
    ].join("\n");
  }

  /** 현재 게임 상태에 맞춰 클리어 화면, 상태 배지, 기록 문구를 동기화한다. */
  syncUi() {
    // 클리어 여부를 한 번 계산해 여러 UI 요소에서 함께 사용한다.
    const cleared = this.state === "cleared";
    clearScreen.hidden = !cleared;
    statusPill.textContent = cleared ? "CLEAR" : "PLAYING";
    statusPill.classList.toggle("is-clear", cleared);

    if (cleared) {
      clearTime.textContent = `기록 ${formatTime(this.clearMilliseconds)}`;
    }
  }
}

// -----------------------------------------------------------------------------
// Bootstrap and fixed timestep loop
// -----------------------------------------------------------------------------

// 브라우저 키 이벤트를 수집하는 입력 객체를 한 번만 생성한다.
const input = new InputState();

// 입력 객체를 전달해 실제 게임 인스턴스를 생성한다.
const game = new Game(input);

// 직전 렌더 프레임의 시각이다. 두 프레임 사이 실제 경과 시간을 계산한다.
let previousTime = performance.now();

// 아직 물리 업데이트에 소비하지 않은 시간을 초 단위로 누적한다.
let accumulator = 0;

/**
 * requestAnimationFrame이 호출하는 메인 루프다.
 * 렌더링은 모니터 주사율에 맞추고 물리는 FIXED_DT 간격으로 일정하게 실행한다.
 */
function frame(currentTime) {
  // 밀리초를 초로 바꾸고 긴 탭 전환으로 생긴 큰 시간 값은 제한한다.
  const frameTime = Math.min((currentTime - previousTime) / 1000, MAX_FRAME_TIME);
  previousTime = currentTime;
  accumulator += frameTime;

  game.updateFps(frameTime);

  // 쌓인 시간이 고정 간격보다 큰 동안 필요한 횟수만큼 물리를 갱신한다.
  while (accumulator >= FIXED_DT) {
    game.update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  // 남은 시간의 비율을 넘겨 직전과 현재 물리 위치 사이를 보간해 그린다.
  game.render(accumulator / FIXED_DT);

  // 다음 브라우저 화면 갱신 시 같은 함수를 다시 호출하도록 예약한다.
  requestAnimationFrame(frame);
}

// 결과 화면 버튼을 누르면 키보드 R과 같은 전체 재시작을 수행한다.
restartButton.addEventListener("click", () => game.restart());

// 게임 화면을 클릭하면 Canvas로 포커스를 되돌려 키보드 조작을 계속 받는다.
canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));

// 페이지가 열리면 Canvas에 포커스를 주고 첫 프레임을 시작한다.
canvas.focus({ preventScroll: true });
requestAnimationFrame(frame);
