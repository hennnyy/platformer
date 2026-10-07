# 2D 플랫포머 게임 아키텍처

## 1. 문서 목적

이 문서는 2D 플랫포머 게임을 처음부터 구현하기 위한 구조와 개발 기준을 정의한다. 목표는 캐릭터 조작, 충돌, 스테이지 진행, 적과 장애물, 저장 기능을 서로 느슨하게 결합하여 기능을 추가하거나 교체하기 쉬운 프로젝트를 만드는 것이다.

이 문서에서는 다음 형태의 게임을 기본으로 가정한다.

- 2D 횡스크롤 싱글플레이 게임
- 여러 개의 스테이지로 구성된 클리어 방식
- 키보드와 게임패드 지원
- 이동, 점프, 낙하, 피격, 사망, 체크포인트가 핵심 플레이 요소
- PC를 첫 번째 대상 플랫폼으로 설정
- 최소 MVP는 게임 엔진이나 외부 프레임워크 없이 브라우저 기본 API로 구현

멀티플레이, 절차적 맵 생성, 장비 파밍, 복잡한 퀘스트 시스템은 초기 범위에서 제외한다.

---

## 2. 핵심 설계 원칙

### 책임 분리

입력, 캐릭터의 의사 결정, 물리 이동, 애니메이션, UI, 저장을 서로 다른 모듈로 분리한다. 예를 들어 플레이어 입력 코드가 애니메이션을 직접 재생하거나 저장 파일을 직접 수정하지 않도록 한다.

### 데이터 중심 구성

이동 속도, 점프 높이, 적 체력, 스테이지 제한 시간 같은 수치는 코드가 아니라 설정 데이터로 관리한다. 밸런스 조정이 코드 수정으로 이어지지 않게 하는 것이 목적이다.

### 이벤트 기반 연결

서로 직접 참조할 필요가 없는 시스템은 이벤트로 통신한다. 플레이어가 사망했을 때 플레이어 코드가 UI, 오디오, 저장, 화면 전환을 각각 호출하지 않고 `PlayerDied` 이벤트를 발행한다.

### 명시적인 상태 전환

플레이어 행동과 전체 게임 흐름은 상태 머신으로 관리한다. 여러 개의 불리언 값으로 상태를 표현하는 방식은 피한다.

### 충돌 계산과 게임 규칙의 분리

충돌 감지와 실제 이동은 작은 수학 함수가 담당하고, 점프 허용 여부나 대미지 무적 시간 같은 규칙은 게임플레이 코드가 담당한다. MVP에서는 축에 정렬된 사각형 충돌만 지원한다.

---

## 3. 전체 구조

```text
┌──────────────────────────────────────────────┐
│ Presentation                                │
│ 화면, HUD, 메뉴, 애니메이션, 카메라, 사운드 │
├──────────────────────────────────────────────┤
│ Gameplay                                    │
│ 플레이어, 적, 발판, 전투, 체크포인트, 규칙  │
├──────────────────────────────────────────────┤
│ Core                                         │
│ 게임 상태, 이벤트, 시간, 서비스 인터페이스  │
├──────────────────────────────────────────────┤
│ Infrastructure                              │
│ 키보드 입력, 브라우저 저장소, Canvas 어댑터 │
├──────────────────────────────────────────────┤
│ Content / Data                               │
│ 스테이지, 캐릭터 설정, 적 설정, 현지화       │
└──────────────────────────────────────────────┘
```

의존 방향은 위 계층에서 아래 계층을 향한다. `Core`는 Canvas나 구체적인 HTML UI를 알지 않아야 한다. `Infrastructure`는 키보드, Canvas, 브라우저 저장소 같은 브라우저 API를 연결한다.

---

## 4. 권장 프로젝트 폴더 구조

```text
prj-platformer/
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ GAME_DESIGN.md             # 규칙, 조작감, 콘텐츠 기획
│  └─ LEVEL_GUIDE.md             # 레벨 제작 규칙
├─ src/
│  ├─ core/
│  │  ├─ events/                 # 이벤트 타입과 이벤트 버스
│  │  ├─ state/                  # 전역 게임 상태 머신
│  │  ├─ services/               # 저장, 레벨, 오디오 등의 인터페이스
│  │  └─ utilities/              # 범용 유틸리티
│  ├─ gameplay/
│  │  ├─ actors/
│  │  │  ├─ player/
│  │  │  ├─ enemies/
│  │  │  └─ components/          # Health, Damage, Movement 등
│  │  ├─ world/
│  │  │  ├─ platforms/
│  │  │  ├─ hazards/
│  │  │  ├─ checkpoints/
│  │  │  └─ collectibles/
│  │  └─ rules/                  # 스폰, 사망, 클리어 규칙
│  ├─ presentation/
│  │  ├─ animation/
│  │  ├─ camera/
│  │  ├─ audio/
│  │  ├─ effects/
│  │  └─ ui/
│  └─ infrastructure/
│     ├─ input/
│     ├─ persistence/
│     └─ browser/
├─ content/
│  ├─ characters/
│  ├─ enemies/
│  ├─ levels/
│  ├─ items/
│  └─ localization/
├─ assets/
│  ├─ sprites/
│  ├─ animations/
│  ├─ audio/
│  ├─ fonts/
│  └─ shaders/
└─ tests/
   ├─ unit/
   ├─ integration/
   └─ play/
```

최소 MVP에서는 [`MVP_SCOPE.md`](./MVP_SCOPE.md)의 단순한 파일 구조를 우선한다. 기능이 늘어나 이 구조로 분리할 때도 각 폴더의 책임은 유지한다.

---

## 5. 런타임 구성

### 5.1 진입점과 서비스 수명

게임 시작 시 `GameBootstrap`이 전역 서비스를 한 번 생성한다.

```text
GameBootstrap
 ├─ GameStateMachine
 ├─ EventBus
 ├─ InputService
 ├─ LevelService
 ├─ SaveService
 ├─ AudioService
 └─ SettingsService
```

전역 서비스에는 게임 전체에서 하나만 존재해야 하는 기능만 둔다. 플레이어, 적, 체크포인트처럼 스테이지에 속하는 객체는 전역 서비스로 만들지 않는다.

서비스는 가능한 한 인터페이스를 통해 접근한다.

```text
IInputService
ILevelService
ISaveService
IAudioService
ISettingsService
```

### 5.2 전체 게임 상태

```text
Boot → MainMenu → Loading → Playing ↔ Paused
                         │
                         ├→ StageClear → Loading / MainMenu
                         └→ GameOver  → Loading / MainMenu
```

각 상태의 책임은 다음과 같다.

| 상태 | 책임 |
|---|---|
| `Boot` | 설정과 저장 데이터 로드, 서비스 초기화 |
| `MainMenu` | 새 게임, 이어하기, 설정, 종료 처리 |
| `Loading` | 다음 스테이지 로드와 진행 표시 |
| `Playing` | 게임플레이 입력 및 시뮬레이션 활성화 |
| `Paused` | 게임 시간 정지, 일시정지 UI 표시 |
| `StageClear` | 결과 계산, 다음 스테이지 해금 및 저장 |
| `GameOver` | 재시작 또는 메뉴 이동 처리 |

HTML 요소의 표시 여부나 레벨 데이터 자체를 게임 상태로 사용하지 않는다. 상태가 화면 전환 또는 레벨 로딩을 요청하고, UI와 레벨 데이터는 해당 상태가 사용할 콘텐츠만 제공한다.

---

## 6. 플레이어 설계

### 6.1 플레이어 구성 요소

```text
Player
 ├─ PlayerController       입력을 행동 의도로 변환
 ├─ CharacterMotor         속도와 물리 이동 처리
 ├─ GroundDetector         바닥, 벽, 천장 감지
 ├─ PlayerStateMachine     현재 행동 상태 관리
 ├─ Health                 체력과 무적 시간 관리
 ├─ AbilitySet             사용 가능한 능력 관리
 ├─ PlayerAnimation        상태를 시각 표현으로 변환
 └─ PlayerAudio            상태를 효과음으로 변환
```

`PlayerController`는 “오른쪽으로 이동하고 싶다”, “점프를 눌렀다” 같은 의도를 만든다. `CharacterMotor`가 실제 속도와 충돌을 계산하고, 애니메이션과 사운드는 최종 상태를 관찰한다.

### 6.2 플레이어 행동 상태

```text
Grounded
 ├─ Idle
 ├─ Run
 └─ Crouch (선택)

Airborne
 ├─ Jump
 ├─ Fall
 ├─ WallSlide (선택)
 └─ Dash (선택)

Restricted
 ├─ Hurt
 ├─ Dead
 └─ Disabled
```

처음에는 `Idle`, `Run`, `Jump`, `Fall`, `Hurt`, `Dead`만 구현한다. 벽 점프나 대시는 기본 이동이 안정된 후 능력 모듈로 추가한다.

### 6.3 조작감 필수 요소

플랫포머의 체감 품질을 위해 다음 값을 설정 데이터로 제공한다.

| 설정 | 의미 |
|---|---|
| 최대 이동 속도 | 지상 수평 속도 제한 |
| 지상/공중 가속도 | 목표 속도에 도달하는 정도 |
| 지상/공중 감속도 | 입력을 놓았을 때 멈추는 정도 |
| 점프 초기 속도 | 기본 점프 높이 |
| 상승/하강 중력 | 점프 상승과 낙하의 감각 분리 |
| 최대 낙하 속도 | 과도한 낙하 방지 |
| 코요테 타임 | 발판을 벗어난 직후 점프 허용 시간 |
| 점프 버퍼 | 착지 직전 입력한 점프의 보존 시간 |
| 가변 점프 | 버튼을 일찍 놓으면 점프 높이를 낮춤 |
| 피격 무적 시간 | 연속 피격 방지 시간 |

입력은 프레임 단위로 수집하되 물리 이동은 고정 시간 간격에서 계산한다. 점프 입력 누락을 막기 위해 `jumpPressedAt` 같은 타임스탬프나 입력 버퍼를 사용한다.

### 6.4 한 프레임의 처리 순서

```text
입력 수집
  → 행동 의도 생성
  → 현재 상태의 전환 조건 평가
  → 가속도·중력·능력 적용
  → 물리 이동과 충돌 해결
  → 접지 상태 갱신
  → 상태 보정
  → 애니메이션·카메라·효과 갱신
  → 게임플레이 이벤트 발행
```

---

## 7. 공통 게임플레이 컴포넌트

상속 계층을 깊게 만들기보다 작은 기능을 조합한다.

| 컴포넌트 | 역할 |
|---|---|
| `Health` | 현재/최대 체력, 회복, 사망 판정 |
| `DamageDealer` | 접촉하거나 공격할 때 대미지 전달 |
| `Hurtbox` | 피격 가능 영역과 피격 필터 |
| `Hitbox` | 공격 판정 영역 |
| `KnockbackReceiver` | 넉백 적용 |
| `MovementMotor` | 속도와 이동 실행 |
| `PatrolBehaviour` | 지정 구간 순찰 |
| `Collectible` | 수집 처리와 이벤트 발행 |
| `TimedLifetime` | 일정 시간 후 제거 |

대미지 전달에는 단순 숫자 대신 문맥 객체를 사용한다.

```text
DamageContext
 ├─ amount
 ├─ type
 ├─ source
 ├─ hitPosition
 ├─ direction
 └─ knockback
```

이 구조를 사용하면 가시, 적, 투사체가 같은 피격 경로를 공유하고 나중에 속성 대미지나 방어 시스템을 추가하기 쉽다.

---

## 8. 적 설계

적은 다음 세 부분으로 나눈다.

- 감지: 플레이어, 벽, 낭떠러지, 공격 가능 거리 탐색
- 판단: 순찰, 추적, 공격, 경직, 사망 상태 결정
- 실행: 이동, 공격 판정, 애니메이션 수행

기본 적 상태는 다음과 같다.

```text
Spawn → Idle ↔ Patrol → Chase → Attack
                    ↑       ↓       │
                    └──── Return ←──┘
                            │
Any State → Hurt → Previous State
Any State → Dead
```

초기 버전에서는 `Patrol`, `Attack`, `Hurt`, `Dead`만으로 한 종류의 적을 완성한 후 감지와 추적을 확장한다.

---

## 9. 스테이지 구조

### 9.1 스테이지 루트

```text
LevelRoot
 ├─ Platform Rectangles
 ├─ SpawnPoints
 │  ├─ PlayerSpawn
 │  └─ EnemySpawns
 ├─ Platforms
 ├─ Hazards
 ├─ Collectibles
 ├─ Checkpoints
 ├─ Goal
 ├─ CameraBounds
 └─ LevelController
```

`LevelController`는 현재 스테이지의 규칙과 진행만 관리한다. 플레이어의 이동 로직이나 전역 저장 기능은 포함하지 않는다.

### 9.2 스테이지 데이터

```yaml
id: stage_01
display_name_key: level.stage_01.name
data: levels/stage_01.js
player_spawn: start
next_level_id: stage_02
time_limit: null
required_collectibles: 0
music_id: forest_day
```

스테이지 데이터 경로를 여러 코드 위치에 직접 넣지 않고 안정적인 `id`로 참조한다.

### 9.3 체크포인트와 리스폰

체크포인트 활성화 시 다음 정보만 런타임에 보존한다.

- 체크포인트 ID
- 리스폰 위치와 바라보는 방향
- 유지하기로 한 스테이지 진행 정보
- 플레이어 회복 규칙

플레이어 사망 흐름은 다음과 같다.

```text
PlayerDied 이벤트
  → 입력 잠금
  → 사망 연출
  → 페이드 아웃
  → 런타임 오브젝트 초기화
  → 활성 체크포인트에서 플레이어 재배치
  → 페이드 인
  → 입력 복구
```

스테이지 전체 재로드와 부분 리셋 중 하나를 프로젝트 초기에 선택한다. 첫 구현은 예측 가능성이 높은 전체 재로드를 권장한다.

---

## 10. 충돌 계층

충돌 레이어를 이름과 용도로 고정한다.

| 레이어 | 충돌 대상 | 용도 |
|---|---|---|
| `World` | Player, Enemy, Projectile | 지형과 벽 |
| `OneWayPlatform` | Player, Enemy | 아래에서 통과 가능한 발판 |
| `PlayerBody` | World, EnemyBody, Hazard | 플레이어 물리 몸체 |
| `EnemyBody` | World, PlayerBody | 적 물리 몸체 |
| `PlayerHitbox` | EnemyHurtbox | 플레이어 공격 |
| `PlayerHurtbox` | EnemyHitbox, Hazard | 플레이어 피격 |
| `EnemyHitbox` | PlayerHurtbox | 적 공격 |
| `EnemyHurtbox` | PlayerHitbox | 적 피격 |
| `Trigger` | PlayerBody | 체크포인트, 목표, 연출 트리거 |
| `Projectile` | World, Hurtbox | 투사체 |

물리 몸체와 공격/피격 판정을 분리해 접촉 이동과 대미지 판정이 서로 간섭하지 않게 한다.

---

## 11. 카메라

카메라는 플레이어의 단순 자식으로 두지 않고 독립된 추적기로 구성한다.

- 부드러운 추적과 데드존
- 진행 방향에 따른 수평 룩어헤드
- 낙하 시 세로 룩어헤드
- 스테이지 경계 제한
- 특정 구역에서 카메라 고정 또는 줌 변경
- 피격/착지/폭발 시 화면 흔들림

화면 흔들림은 위치를 직접 덮어쓰지 않고 여러 흔들림 요청을 합성해 추적 결과에 더한다.

---

## 12. UI와 화면 흐름

UI는 게임 상태를 직접 변경하지 않고 명령 또는 이벤트를 전달한다.

```text
UI 입력 → 요청 이벤트 → GameStateMachine → 상태 변경 → UI 갱신
```

초기 UI 범위는 다음과 같다.

- 메인 메뉴
- HUD: 체력, 수집물, 필요할 경우 제한 시간
- 일시정지 메뉴
- 스테이지 클리어 화면
- 게임 오버 또는 재시작 화면
- 설정: 음량, 해상도, 전체 화면, 입력 재지정

HUD는 매 프레임 데이터를 조회하지 않고 `HealthChanged`, `CollectibleCountChanged` 같은 이벤트를 받아 갱신한다.

---

## 13. 이벤트 정의

초기 이벤트 목록은 작게 유지한다.

| 이벤트 | 주요 발행자 | 주요 구독자 |
|---|---|---|
| `PlayerSpawned` | LevelController | Camera, HUD |
| `PlayerHealthChanged` | Health | HUD, Audio |
| `PlayerDamaged` | Health | CameraShake, Effects, Audio |
| `PlayerDied` | Health | LevelController, GameStateMachine |
| `CheckpointActivated` | Checkpoint | LevelController, HUD |
| `CollectibleCollected` | Collectible | LevelController, HUD, Audio |
| `GoalReached` | Goal | LevelController |
| `StageCleared` | LevelController | GameStateMachine, SaveService |
| `GamePaused` | GameStateMachine | UI, Audio |

이벤트는 이미 발생한 사실을 과거형으로 표현한다. 즉 `DamagePlayer`보다는 `PlayerDamaged`를 사용한다. 반드시 성공 여부를 알아야 하는 작업은 이벤트가 아니라 반환값이 있는 명령이나 서비스 호출을 사용한다.

---

## 14. 데이터와 저장

### 14.1 설정 데이터

코드와 분리할 데이터는 다음과 같다.

- 플레이어 이동 파라미터
- 플레이어 능력과 체력
- 적 능력치와 행동 범위
- 아이템과 수집물 정의
- 스테이지 메타데이터
- 오디오 ID와 실제 리소스 연결
- 현지화 문자열

설정 데이터에는 런타임 상태를 저장하지 않는다. 예를 들어 `PlayerConfig.maxHealth`는 설정이지만 `Player.currentHealth`는 런타임 상태다.

### 14.2 저장 데이터

```json
{
  "schemaVersion": 1,
  "lastPlayedLevelId": "stage_01",
  "unlockedLevelIds": ["stage_01"],
  "levelRecords": {
    "stage_01": {
      "cleared": false,
      "bestTimeMs": null,
      "collectibles": []
    }
  },
  "settings": {
    "masterVolume": 1.0,
    "musicVolume": 0.8,
    "sfxVolume": 1.0
  }
}
```

저장 규칙은 다음과 같다.

- 임시 파일에 먼저 쓴 후 기존 파일과 교체해 파일 손상을 줄인다.
- `schemaVersion`을 두어 업데이트 시 마이그레이션할 수 있게 한다.
- 설정 저장과 게임 진행 저장은 필요하면 별도 파일로 분리한다.
- 스테이지 클리어와 설정 변경처럼 명확한 시점에 저장한다.
- 프레임 루프에서 저장하지 않는다.

---

## 15. 애니메이션과 오디오

애니메이션은 게임플레이 상태를 표현하지만 게임 규칙을 결정하지 않는다. 공격 판정 시점처럼 애니메이션과 동기화가 필요한 경우에도, 애니메이션 이름을 게임플레이 코드에 직접 하드코딩하지 않고 명시적인 이벤트를 사용한다.

```text
PlayerState = Jump
  → AnimationPresenter가 jump 애니메이션 선택
  → AudioPresenter가 jump 효과음 요청
  → 게임 규칙은 애니메이션 재생 여부와 무관하게 유지
```

오디오는 문자열 파일 경로가 아니라 `AudioId`로 요청하고, 실제 리소스와 음량 그룹 연결은 오디오 설정 데이터에서 처리한다.

---

## 16. 오브젝트 생성과 제거

투사체, 피격 효과, 먼지 파티클처럼 자주 생성되는 오브젝트는 풀링을 고려한다. 단, 초기부터 모든 오브젝트를 풀링하지 않는다.

다음 기준을 만족할 때 풀을 도입한다.

- 짧은 시간에 반복적으로 생성됨
- 생성과 제거가 프레임 끊김을 유발함
- 동일한 초기 상태로 안전하게 재사용 가능함

풀에서 꺼낸 객체는 이벤트 구독, 타이머, 속도, 애니메이션 상태를 반드시 초기화한다.

---

## 17. 테스트 전략

### 단위 테스트

- 체력 감소, 무적 시간, 사망 판정
- 점프 버퍼와 코요테 타임의 시간 조건
- 상태 머신의 유효/무효 전환
- 스테이지 해금과 최고 기록 갱신
- 저장 데이터 마이그레이션

### 통합 테스트

- 입력부터 플레이어 이동까지의 흐름
- 체크포인트 활성화 후 사망과 리스폰
- 목표 도달 후 저장과 다음 상태 전환
- 피격 이벤트가 HUD, 효과, 오디오로 전달되는지 확인

### 플레이 테스트

- 낮은 프레임률과 높은 프레임률에서 점프 높이 일관성
- 발판 가장자리에서 코요테 타임 동작
- 착지 직전 점프 버퍼 동작
- 경사면, 벽, 천장, 움직이는 발판 충돌
- 입력 장치 전환과 일시정지

게임플레이 테스트를 위해 충돌 영역, 속도 벡터, 접지 상태, 현재 상태를 화면에 표시하는 디버그 HUD를 제공한다.

---

## 18. 개발 단계

### 1단계: 이동 프로토타입

- 빈 테스트 스테이지
- 좌우 이동, 점프, 낙하
- 접지 감지
- 코요테 타임과 점프 버퍼
- 디버그 HUD

완료 조건: 다양한 프레임률에서 이동과 점프가 안정적으로 재현된다.

### 2단계: 최소 게임 루프

- 플레이어 체력과 사망
- 가시 또는 낙사 구역
- 체크포인트와 리스폰
- 스테이지 목표
- 메인 메뉴, HUD, 일시정지, 클리어 화면

완료 조건: 게임 실행부터 스테이지 클리어 또는 재시작까지 한 흐름으로 플레이할 수 있다.

### 3단계: 적과 상호작용

- 순찰형 적 한 종류
- 공격/피격 판정
- 수집물
- 카메라 효과와 기본 사운드

완료 조건: 적과 장애물이 포함된 짧은 스테이지가 완성된다.

### 4단계: 콘텐츠 제작 기반

- 설정 데이터 분리
- 재사용 가능한 발판, 함정, 적 생성 함수
- 레벨 검증 도구
- 저장과 스테이지 해금

완료 조건: 코드를 수정하지 않고 새 스테이지를 추가할 수 있다.

### 5단계: 확장과 최적화

- 추가 능력과 적
- 애니메이션, 효과, 사운드 개선
- 접근성 옵션과 입력 재지정
- 프로파일링 기반 최적화

---

## 19. 첫 번째 수직 슬라이스 범위

첫 번째 완성 목표는 5~10분 길이의 작은 스테이지 한 개로 제한한다.

- 플레이어: 달리기, 점프, 피격, 사망
- 적: 순찰형 한 종류
- 환경: 일반 지형, 단방향 발판, 가시, 낙사 구역
- 진행: 시작점, 체크포인트 한 개, 도착점
- UI: 체력, 일시정지, 클리어
- 저장: 스테이지 클리어 여부와 설정
- 연출: 기본 애니메이션, 효과음, 카메라 추적

이 범위가 완성되기 전에는 대시, 벽 점프, 보스, 인벤토리, 복잡한 스킬 트리처럼 구조를 크게 늘리는 기능을 추가하지 않는다.

---

## 20. 구현 시 금지할 결합

- 플레이어 코드가 HUD 요소를 직접 찾거나 수정하는 것
- 적 코드가 특정 플레이어 구현 클래스를 강제로 참조하는 것
- 애니메이션 완료 여부가 핵심 물리 규칙을 결정하는 것
- 화면 이름과 레벨 데이터 경로를 여러 코드 위치에 문자열로 작성하는 것
- 전역 싱글턴에 플레이어와 스테이지별 상태를 모두 저장하는 것
- 프레임 단위 입력 처리와 고정 시간 물리 처리를 구분하지 않는 것
- `isJumping`, `isFalling`, `isHurt`, `isDead`처럼 충돌 가능한 불리언 조합으로 상태를 관리하는 것

---

## 21. 다음 설계 문서

구현을 시작하기 전에 다음 문서를 차례로 추가한다.

1. [`GAME_DESIGN.md`](./GAME_DESIGN.md): 핵심 재미, 조작 방식, 승패 조건, 능력 목록 (완료)
2. [`PLAYER_MOVEMENT.md`](./PLAYER_MOVEMENT.md): 이동 수식, 상태 전환표, 초기 튜닝 값 (최소 MVP 기준 완료)
3. `LEVEL_GUIDE.md`: 타일 크기, 점프 거리, 카메라 경계, 체크포인트 간격
4. `CONTENT_PIPELINE.md`: 스프라이트, 애니메이션, 오디오의 이름과 임포트 규칙

최소 MVP 구현은 [`MVP_SCOPE.md`](./MVP_SCOPE.md)의 브라우저 구조와 [`PLAYER_MOVEMENT.md`](./PLAYER_MOVEMENT.md)의 JavaScript 물리 규칙을 따른다.
