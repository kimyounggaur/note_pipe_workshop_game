# JOINT 게이트 보고서

- 기준 설계: 『음표 파이프 공방』 설계서 v1.0, 2026-11-14, 첨부 7개 문서
- 구현·검사 기록일: 2026-11-18 (한국 시간)
- 상태: 구현 후보판. JT9 미완료이며 정식 v1.0 완료 게이트는 열지 않는다.
- 아래 단계 요약은 현재 구현과 자동 검사에서 확인한 범위를 정리한 것이다. 과거 시점의 브라우저·실기기 통과 기록을 소급해 만들지 않는다.

## 확인된 자동 검사

| 묶음 | 통과 | 근거 |
|---|---:|---|
| TH | 17/17 | `tests/engine.cjs` |
| IN | 3/3 | `tests/engine.cjs` |
| CN | 4/4 | `tests/engine.cjs` |
| JD의 이론 판정 | 6/6 | `tests/engine.cjs`, JD-01–JD-06 |
| GN | 14/14 | `tests/engine.cjs` |
| 이론 합계 | 44/44 | 유효 배치 8,400개, 서로 다른 배치 쌍 257,820개 |
| 부록 B.3 정답표 | 49/49 | 변경하지 않은 첨부 표와 엔진 출력 직접 비교 |
| AU | 9/9 | `tests/audio.cjs`, 합성 API 스파이 |
| SV | 4/4 | `tests/storage.cjs` |
| JD 전체 | 8/8 | 순수 판정·재시작·최고 기록 보존 |
| ST | 6/6 | 실제 브라우저 DOM의 잠금·초점 포함 |
| CT | 3/3 | 49건 SVG·보기·문구 및 8개 화면 크기 측정 |
| 자가검사 합계 | 68/68 | 브라우저 설정 → 자가검사 |
| 추가 전체 진행 | 8/8 | 49의뢰·S1–S4·7일·8카드, 실제 저장 쓰기 0회 |
| 화면 크기 검사 | 1,064장면, 문제 0건 | 8개 뷰포트 × 133장면, 최대 2줄, 정렬 오차 1px |

정답표 비교 항목은 의뢰 ID, 방울, 물줄기, 붙임줄·이음줄 범위, 가장 긴 소리, 울리는 길이, 누르는 구간과 횟수다. 부록 B.9 씨앗은 JSON 직렬화 결과가 원문 추출본과 같고 의뢰 ID 49개가 고유하다.

오디오 9/9는 실제 재생을 귀로 들었다는 뜻이 아니다. 실기기와 사람의 청취 결과는 아래 `NOT_RUN`으로 구분한다.

## 결정 기록 D1–D13

| 결정 | 선택 | 사유·현재 확실성 |
|---|---|---|
| D1 | 뗌·이음·붙임을 도구와 이음매로 선택 | 배관 조작과 소리의 연결을 그대로 학습하도록 설계 유지 |
| D2 | 배관과 밸브 2단, 통과는 셈·검수 정답만 반영 | 손의 정확도가 이론 학습 진행을 막지 않음 |
| D3 | 초등 3학년부터 성인 입문자, 해요체, 세로 우선, DOM+SVG, 카드·도장·자유 공방 | 설계 범위 유지. 실제 대상 학습자 적합성 검수는 NOT_RUN |
| D4 | 5선보, 도–라, 위 기둥·아래 곡선, 이음줄은 붙임줄 바깥 | 같은 가로축으로 악보와 시간 연결. 강사 검수는 NOT_RUN |
| D5 | 지속 관 합성음, 뗌은 ¼박(최대 길이의 절반), 같은 음 이음의 짧은 재발음 | 참조 합성과 시간 구조 유지. 폰 청취는 NOT_RUN |
| D6 | 0–6단·49건, 지정 음가와 박자, 5음·6박 이하 자연음 | 출제 제약 검사로 범위를 고정 |
| D7 | 이음줄 안의 음을 틈 없이 잇되 음마다 새 시작을 유지 | 붙임줄과 소리 시작 수의 차이를 보존 |
| D8 | 뗌·이음·붙임, 떼기·잇기·붙이기, 방울·토막·물줄기, 가제 유지 | 설계의 학습 용어를 일관되게 사용 |
| D9 | 강철·놋쇠·물 색의 인라인 SVG, 캐릭터는 놋쇠 방울 | 단일 HTML, 외부 요청 없는 배포와 축소 화면의 가독성에 맞춤 |
| D10 | 새 GitHub 저장소+Vercel 목표, Vercel 프로젝트 생성 자동 승인 검토 거절 | GitHub CLI 미인증·연결 도구의 저장소 생성 기능 부재로 GitHub 생성은 미해결. Vercel 외부 리소스 생성·비용 가능성에 대한 명시적 승인 필요. 우회 배포하지 않음 |
| D11 | 제목 『음표 파이프 공방』, 작업일 이름 7개 유지, 캐릭터는 ‘방울’ | 불필요한 이름 변경 없이 첨부 설계와 일치 |
| D12 | 곡선은 아래, 이음줄은 바깥, 마지막 붙인 음까지 덮음 | 참조 SVG 관례 유지. 강사 확인을 받았다고 기록하지 않음 |
| D13 | 원본 소리 의뢰 d3-02·d3-05·d5-06 유지, 무음 환경은 설계도로 대체 | 같은 음 이음·붙임의 청취 판별은 미확정. 폰 청취 후 d5-06의 방식 변경 여부를 결정할 수 있음 |

### 참조 구현과 검사 수치의 차이

- 부록 C의 분수·이론 함수와 부록 B.9 씨앗을 우선 재사용한다.
- 제품의 상태, 저장, 전체 7일 흐름, 여러 화면, 접근성·재생 복구 연결은 참조 스파이크에 없거나 제품화가 필요한 부분이라 별도 구획으로 구현한다.
- **TH-07 수치:** 원문 13,740개, 현재 8,400개 유효 배치 전체 순회의 거절 요청 18,408개. 각 요청에서 거절 결과, 원본 객체 반환, 원본 내용 불변을 확인한다. 이론 엔진 변경은 없다. 테스트 기대값은 실제 열거 집합의 재현 가능한 수치에 맞추고 차이를 이 기록에 공개한다.
- 전체 68개 ID를 실제 브라우저에서 통과했다. 오디오 검사는 모의 AudioContext API·예약값 검사이며 실제 PCM 파형, 청취와 같지 않다. 모바일 화면 검사는 실제 브라우저 iframe의 8개 크기에서 수행했고 실물 휴대폰 검증과 구분한다.
- 저장 형식은 version:1을 유지하고 active에 repeating/retryPos/phase 선택 필드를 추가해 재의뢰 도중의 복귀와 납품 화면 복귀를 보존했다.
- 밸브 공통 안내는 같은 음의 이음에서 다시 눌러야 한다는 조건과 충돌하지 않도록 ‘이음매에 맞춰 눌렀다 떼어 봐요’로 보완했다.

## 단계별 게이트

아래는 최종 상태를 같은 날 검증한 보고이며 이전 단계별 실행 시점의 측정 결과를 소급하지 않는다.

| 단계 | 상태 | 근거와 남은 항목 |
|---|---|---|
| JT0 / GJT0 | PASS | 고정 5행·상태·저장, 8개 크기 문제 0 |
| JT1 / GJT1 | PASS | 이론44/44·원문49행 일치·TH07 수치 차이 공개 |
| JT2 / GJT2 | PARTIAL | 8개 크기 SVG·곡선·가로축 통과, D12 강사 확인 NOT_RUN |
| JT3 / GJT3 | PARTIAL | AU9/9 모의 API 통과, 실제 폰 청취 NOT_RUN |
| JT4 / GJT4 | PARTIAL | JD8/8, 실제 브라우저 Space 4.7초 붙임 밸브 매끈. 실물 폰 NOT_RUN |
| JT5 / GJT5 | PASS | 0~2단 자동 전체 진행, 0단 실제 키보드6/6·새로고침복귀 |
| JT6 / GJT6 | PARTIAL | 7일49건 자동 진행 통과. D13 실제 청취 NOT_RUN |
| JT7 / GJT7 | PASS | 68/68·카드8장·발견4개·자유공방·설정·저장 |
| JT8 / GJT8 | PARTIAL | 최종 SVG·인플레이 안내·캡처 확인, 7화면×3크기 캡처세트와 보조기술 NOT_RUN |
| JT9 / GJT9 | NOT_RUN | 실기기·청취·학습자·강사 확인 필요 |

## 브라우저 점검 추가 기록

| 크기 | 장면 | 결과 |
|---|---:|---|
| 320×545 | 133 | 스크롤·잘림·최소 터치영역 위반 0, 최대 2줄, 악보·방울 오차 1px |
| 320×568 | 133 | 스크롤·잘림·최소 터치영역 위반 0, 최대 2줄, 악보·방울 오차 1px |
| 360×600 | 133 | 스크롤·잘림·최소 터치영역 위반 0, 최대 2줄, 악보·방울 오차 1px |
| 360×640 | 133 | 스크롤·잘림·최소 터치영역 위반 0, 최대 2줄, 악보·방울 오차 1px |
| 390×664 | 133 | 스크롤·잘림·최소 터치영역 위반 0, 최대 2줄, 악보·방울 오차 1px |
| 390×844 | 133 | 스크롤·잘림·최소 터치영역 위반 0, 최대 2줄, 악보·방울 오차 1px |
| 430×932 | 133 | 스크롤·잘림·최소 터치영역 위반 0, 최대 2줄, 악보·방울 오차 1px |
| 800×600 | 133 | 스크롤·잘림·최소 터치영역 위반 0, 최대 2줄, 악보·방울 오차 1px |

- 총 1,064장면. 각 의뢰의 셈/배관/밸브/납품 해당 단계와 오답 원인 문구를 측정했다. 원문 스파이크의 1,344장면과는 검사 대상 단계 수가 다르다.
- 실제 브라우저: 0단 키보드만으로 6건 ● 통과, 3번째 의뢰에서 새로고침 후 이어하기 복귀, 1단 첫 의뢰 도구→이음매→검수→기계밸브→Space 길게 누르기(매끈)→납품 확인.
- E-01/E-02/E-03/E-04/E-05: 자동 레이아웃 검사. E-06: 브라우저 키보드 및 파이프 클릭 경로 부분 확인; 실제 터치 전체 완주 NOT_RUN. E-07: 소스의 외부 자원 0, 앱 오류 팝업·앱 콘솔 오류 없음.
- E-08 저화면 안내, E-09 재생중 resize, E-10 기기 동작 줄이기, E-11 전체 대비 재측정: 구현·원본 팔레트 보존, 별도 실제 브라우저 조작 검증은 NOT_RUN.

## 실기기·사람 검수

| 대상 | 확인할 일 | 상태 |
|---|---|---|
| iPhone Safari | 첫 소리 언락, 복귀, 화면 회전, 실제 터치·밸브 | NOT_RUN |
| Android Chrome | 실제 터치 지연, 작은 화면 이음매, 재생 중단 | NOT_RUN |
| 폰 2대 이상 청취 | 뗌·이음·붙임, 같은 음의 이음·붙임, 관·방울·박 음량 균형 | NOT_RUN |
| 실제 손 밸브 | d2-05와 d4-03 각각 10회, 등급·지연 기록 | NOT_RUN |
| 무선 이어폰 | 소리 지연과 누름 보정 필요성 | NOT_RUN |
| VoiceOver·TalkBack | 의뢰 읽기→배관→검수→납품 | NOT_RUN |
| 초등 3–4학년 2명 이상 | 0–4단 진행, 관 비유·곡선 이름 설명 | NOT_RUN |
| 성인 입문자 2명 이상 | 0–4단 진행과 학습 이해 | NOT_RUN |
| 음악 강사 | 문구, 의뢰 순서, 4단 발견 장면, D12 기보, 뗌의 틈 안내 | NOT_RUN |

검수 결과에 따라 합성음의 꺼짐 시간, 방울 음량, 밸브 판정 창, 누름 보정 기본값과 d5-06의 의뢰 방식을 조정한다. 실제 확인 전에는 조정이 검증되었다고 기록하지 않는다.

## 배포 기록

- GitHub: 새 저장소 생성 미완료. CLI 미인증이며 연결 도구에 생성 기능이 없다. 로컬 Git 커밋과 전체 소스 묶음을 제공한다.
- Vercel: 2026-11-18 `note-pipe-workshop` 프로젝트 생성 요청이 자동 승인 검토에서 거절되었다. 사유는 외부 지속 리소스 생성 및 비용 가능성에 대한 사용자의 명시적 승인이 없다는 것이다. 프로젝트·배포 생성은 완료되지 않았고 우회 실행하지 않았다.
- 실제 휴대폰 청취·강사 검수 전에는 정식 v1.0 최종 게이트 완료로 보지 않는다.

```yaml
GATE_REPORT:
  gate: GJT0
  status: PASS
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "고정 5행·상태·저장, 8개 크기 문제 0"
```

```yaml
GATE_REPORT:
  gate: GJT1
  status: PASS
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "이론44/44·원문49행 일치·TH07 수치 차이 공개"
```

```yaml
GATE_REPORT:
  gate: GJT2
  status: PARTIAL
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "8개 크기 SVG·곡선·가로축 통과, D12 강사 확인 NOT_RUN"
```

```yaml
GATE_REPORT:
  gate: GJT3
  status: PARTIAL
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "AU9/9 모의 API 통과, 실제 폰 청취 NOT_RUN"
```

```yaml
GATE_REPORT:
  gate: GJT4
  status: PARTIAL
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "JD8/8, 실제 브라우저 Space 4.7초 붙임 밸브 매끈. 실물 폰 NOT_RUN"
```

```yaml
GATE_REPORT:
  gate: GJT5
  status: PASS
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "0~2단 자동 전체 진행, 0단 실제 키보드6/6·새로고침복귀"
```

```yaml
GATE_REPORT:
  gate: GJT6
  status: PARTIAL
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "7일49건 자동 진행 통과. D13 실제 청취 NOT_RUN"
```

```yaml
GATE_REPORT:
  gate: GJT7
  status: PASS
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "68/68·카드8장·발견4개·자유공방·설정·저장"
```

```yaml
GATE_REPORT:
  gate: GJT8
  status: PARTIAL
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "최종 SVG·인플레이 안내·캡처 확인, 7화면×3크기 캡처세트와 보조기술 NOT_RUN"
```

```yaml
GATE_REPORT:
  gate: GJT9
  status: NOT_RUN
  tests: { TH: 17/17, IN: 3/3, CN: 4/4, JD: 8/8, GN: 14/14, AU_mocked: 9/9, ST: 6/6, SV: 4/4, CT: 3/3 }
  viewports: [320x545, 320x568, 360x600, 360x640, 390x664, 390x844, 430x932, 800x600]
  external_requests: 0
  file_bytes: 185036
  device_check: NOT_RUN
  listening_check: NOT_RUN
  instructor_check: NOT_RUN
  note: "실기기·청취·학습자·강사 확인 필요"
```
