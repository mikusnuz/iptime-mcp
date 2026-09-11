[English](README.md) | **한국어**

# iptime-mcp

ipTIME 관리자 페이지를 매번 열지 않고도 공유기를 조회하고 관리할 수 있게 해주는 안전 중심의 Model Context Protocol(MCP) 서버입니다.

공유기 상태 조회, 모델·펌웨어별 지원 기능 확인, 네트워크·Wi-Fi·NAT·방화벽·VPN·DDNS·USB/NAS·시스템·자동화 기능 변경을 지원합니다. 모든 공유기 변경은 검토 가능한 계획을 거치지만 확인 토큰을 다시 입력할 필요는 없습니다.

> EFM Networks 또는 ipTIME과 관련 없는 비공식 커뮤니티 프로젝트입니다. 공유기 내부 API는 안정적인 공개 계약이 아니며 펌웨어에 따라 달라질 수 있습니다.

## 주요 특징

- 수백 개의 최상위 도구 대신 목적이 분명한 MCP 도구 13개 제공
- 공유기 작업 334개 등록: 조회 171개, 변경 163개
- iUX3에서 공유기의 `api/has`를 이용해 알려진 작업의 실제 지원 여부 확인
- iUX3, Mobile iUX, classic CGI 인터페이스 감지
- 조회 작업은 바로 실행 가능
- 모든 공유기 변경은 확인 토큰 없이 만료되는 검토 가능한 계획 사용
- 설정 백업, 설정 복원 계획, 펌웨어 업그레이드 계획 지원
- 단일 공유기와 다중 공유기 프로필 지원
- 자격증명과 세션 값 자동 제거
- 공인망 평문 HTTP 기본 차단

관리자 설정, 펌웨어, 백업·복원, WAN/LAN/DHCP/DNS, 라우팅·스위칭, 무선 네트워크·EasyMesh, NAT·포트포워딩, 방화벽, QoS, VPN, DDNS, USB/NAS, 루틴, 접속 기록, 시스템 로그, 호스트 검색, Wake-on-LAN 영역을 다룹니다.

## 호환성

| 인터페이스 | 지원 방식 |
|---|---|
| iUX3 | `/cgi/service.cgi` JSON RPC를 사용하고 알려진 각 메서드를 `api/has`로 확인 |
| Mobile iUX | 명시적으로 안전하게 매핑한 조회 작업만 제공 |
| Classic CGI | 명시적으로 안전하게 매핑한 조회 작업만 제공 |

고정 작업 카탈로그는 펌웨어 15.36.6에 포함된 iUX3 애플리케이션에서 관찰한 메서드를 기반으로 합니다. 카탈로그에 있다는 이유만으로 모든 공유기가 해당 작업을 지원하는 것은 아닙니다. 작업을 선택하기 전에 대상 공유기에 `iptime_capabilities`를 실행하세요.

구형 인터페이스는 시스템 정보, DHCP 임대·설정, 포트포워딩, Wake-on-LAN에 대한 알려진 조회 매핑만 지원합니다. 결과가 가공되지 않은 텍스트로 반환될 수 있으며, 확인되지 않은 구형 인터페이스 쓰기 작업은 거부됩니다.

## 변경 안전장치

공유기 설정 변경은 인터넷 연결을 끊거나 관리자 화면에 다시 접근할 수 없게 만들 수 있습니다. 따라서 조회와 변경이 분리되어 있습니다.

1. `iptime_plan_change` 또는 파일 전용 계획 도구가 공유기를 건드리지 않고 변경 계획을 만듭니다.
2. 계획에서 작업, 파라미터, 가능한 경우 현재 상태, 위험도와 만료 시각을 검토합니다.
3. `iptime_apply_change`는 `plan_id`만으로 그 계획을 적용하며, 사용자가 `APPLY <UUID>` 같은 토큰을 복사할 필요가 없습니다.

동일한 변경을 구체적으로 요청한 사용자 지시는 그 변경에 대한 승인으로 간주합니다. 펌웨어, 설정 복원, 초기화, 자격증명, 저장장치 포맷처럼 치명적 위험의 계획을 사용자가 아직 명시적으로 승인하지 않은 경우에만 평범한 자연어로 한 번 더 확인합니다. MCP 클라이언트 자체의 파괴적 도구 승인 창은 계속 표시될 수 있습니다.

계획은 10분 뒤 만료되고 한 번만 적용할 수 있으며 무결성 해시로 보호됩니다. 같은 공유기에 대한 변경은 순서대로 처리됩니다. 쓰기 응답이 유실되면 가능한 경우 상태를 다시 조회하고, 쓰기 작업 자체를 자동 재시도하지 않습니다. 계획은 메모리에만 보관되므로 MCP 프로세스를 재시작하면 사라집니다.

## 요구 사항

- Node.js 22 이상
- 공유기 관리자 엔드포인트에 접근할 수 있는 네트워크
- ipTIME 관리자 아이디와 비밀번호
- stdio MCP 서버를 지원하는 클라이언트

가능하면 공유기 LAN 주소, VPN 주소 또는 신뢰할 수 있는 HTTPS 주소를 사용하세요.

## 소스에서 설치

```sh
git clone https://github.com/mikusnuz/iptime-mcp.git
cd iptime-mcp
npm ci
npm run build
```

실행 파일은 `dist/server.js`입니다.

환경 파일이나 작업 디렉터리를 지정할 수 있는 클라이언트에서는 먼저 로컬 `.env`를 만드세요.

```sh
cp .env.example .env
```

공유기 URL, 아이디, 비밀번호를 입력합니다. `.env`는 Git에서 제외되며 로컬에만 보관해야 합니다.

## MCP 클라이언트 설정

공유기 자격증명이 프로젝트에 커밋되지 않도록 가능하면 사용자 범위 설정을 사용하세요. 모든 예제의 `/absolute/path/to/iptime-mcp`를 실제 절대 경로로 바꿔야 합니다. Windows의 JSON에서는 `C:/Users/name/iptime-mcp/dist/server.js`처럼 슬래시 경로를 사용할 수 있습니다. 데스크톱 클라이언트가 `node`를 찾지 못하면 macOS/Linux의 `which node` 또는 Windows의 `where node`가 출력한 절대 경로를 사용하세요.

| 클라이언트 | 사용자 범위 설정 |
|---|---|
| Codex / ChatGPT 데스크톱 | **설정 → MCP 서버** 또는 `~/.codex/config.toml` |
| Claude Desktop | **Settings → Developer → Edit Config** |
| Claude Code | `claude mcp add --scope user` |
| Cursor | `~/.cursor/mcp.json` |
| VS Code 에이전트 채팅 | **MCP: Open User Configuration** |
| GitHub Copilot CLI | `~/.copilot/mcp-config.json` |
| Gemini CLI | `~/.gemini/settings.json` |

### Codex / ChatGPT 데스크톱

**설정 → MCP 서버**에서 stdio 서버를 추가하거나 `~/.codex/config.toml`에 다음 내용을 추가하세요. 경로와 자격증명을 바꾼 뒤 저장하고 MCP 서버를 재시작합니다.

```toml
[mcp_servers.iptime]
command = "node"
args = ["/absolute/path/to/iptime-mcp/dist/server.js"]
cwd = "/absolute/path/to/iptime-mcp"
default_tools_approval_mode = "writes"

[mcp_servers.iptime.env]
IPTIME_ROUTER_ID = "home"
IPTIME_ROUTER_URL = "http://192.168.0.1"
IPTIME_ROUTER_USERNAME = "admin"
IPTIME_ROUTER_PASSWORD = "your-router-password"
```

동일한 Codex 호스트에서는 Codex, IDE 확장 프로그램, ChatGPT 데스크톱 앱이 MCP 설정을 공유합니다. 최신 클라이언트 설정은 [공식 MCP 설정 문서](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)를 참고하세요.

로컬 `.env`를 사용하려면 `cwd`는 유지하고 `[mcp_servers.iptime.env]` 테이블은 생략하세요.

### Claude Desktop

**Settings → Developer → Edit Config**를 열고 `claude_desktop_config.json`의 기존 설정을 유지한 채 다음 `iptime` 항목을 병합하세요. 저장 후 Claude Desktop을 완전히 종료했다가 다시 실행합니다.

```json
{
  "mcpServers": {
    "iptime": {
      "command": "node",
      "args": ["/absolute/path/to/iptime-mcp/dist/server.js"],
      "env": {
        "IPTIME_ROUTER_ID": "home",
        "IPTIME_ROUTER_URL": "http://192.168.0.1",
        "IPTIME_ROUTER_USERNAME": "admin",
        "IPTIME_ROUTER_PASSWORD": "your-router-password"
      }
    }
  }
}
```

재시작한 뒤 채팅 입력창의 **Connectors**에서 연결을 확인합니다. 자세한 내용은 [Claude Desktop 로컬 MCP 공식 문서](https://modelcontextprotocol.io/quickstart/user)를 참고하세요.

### Claude Code

Claude Code CLI에서 모든 프로젝트에 사용할 서버로 등록합니다.

```sh
claude mcp add \
  --scope user \
  --env IPTIME_ROUTER_ID=home \
  --env IPTIME_ROUTER_URL=http://192.168.0.1 \
  --env IPTIME_ROUTER_USERNAME=admin \
  --env IPTIME_ROUTER_PASSWORD=your-router-password \
  --transport stdio iptime \
  -- node /absolute/path/to/iptime-mcp/dist/server.js

claude mcp get iptime
```

마지막 `--env`가 서버 이름까지 값으로 읽지 않도록 `--transport` 옵션을 환경 변수 뒤에 둔 형식입니다. 사용자 범위 설정은 `~/.claude.json`에 저장됩니다. 자세한 내용은 [Claude Code MCP 공식 문서](https://code.claude.com/docs/en/mcp)를 참고하세요.

### Cursor

`~/.cursor/mcp.json`을 만들거나 기존 파일에 병합하세요. 다음 예제는 위에서 만든 Git 제외 대상 `.env`를 읽습니다.

```json
{
  "mcpServers": {
    "iptime": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/iptime-mcp/dist/server.js"],
      "cwd": "/absolute/path/to/iptime-mcp",
      "envFile": "/absolute/path/to/iptime-mcp/.env"
    }
  }
}
```

Cursor를 재시작한 뒤 **Settings → Tools & MCP**에서 확인합니다. 프로젝트 범위의 `.cursor/mcp.json`도 지원하지만 커밋될 수 있는 파일에 공유기 자격증명을 넣으면 안 됩니다. 자세한 내용은 [Cursor MCP 공식 문서](https://cursor.com/docs/mcp)를 참고하세요.

### VS Code 에이전트 채팅 / GitHub Copilot Chat

Command Palette에서 **MCP: Open User Configuration**을 실행하고 다음 설정을 병합하세요. VS Code의 최상위 키는 `mcpServers`가 아니라 `servers`입니다.

```json
{
  "servers": {
    "iptime": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/iptime-mcp/dist/server.js"],
      "cwd": "/absolute/path/to/iptime-mcp",
      "envFile": "/absolute/path/to/iptime-mcp/.env"
    }
  }
}
```

**MCP: List Servers**에서 서버를 시작하거나 상태를 확인하고, 처음 실행할 때 신뢰 확인을 승인합니다. 워크스페이스 설정은 `.vscode/mcp.json`에 둘 수 있지만 공유기 자격증명에는 사용자 설정이 더 안전합니다. 자세한 내용은 [VS Code MCP 설정 공식 문서](https://code.visualstudio.com/docs/agent-customization/mcp-servers)와 [설정 레퍼런스](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)를 참고하세요.

### GitHub Copilot CLI

GitHub Copilot CLI는 VS Code의 `.vscode/mcp.json`을 읽지 않습니다. 대신 `~/.copilot/mcp-config.json`을 만들거나 기존 파일에 병합하세요.

```json
{
  "mcpServers": {
    "iptime": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/iptime-mcp/dist/server.js"],
      "cwd": "/absolute/path/to/iptime-mcp",
      "tools": ["*"]
    }
  }
}
```

지정한 `cwd`에서 `iptime-mcp`가 로컬 `.env`를 읽습니다. `copilot mcp list`로 연결을 확인하세요. 프로젝트 범위의 `.mcp.json`과 `.github/mcp.json`도 지원하지만 공유기 자격증명을 절대로 커밋하면 안 됩니다. 자세한 내용은 [Copilot CLI MCP 공식 문서](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers)를 참고하세요.

### Gemini CLI

`~/.gemini/settings.json`을 만들거나 기존 파일에 병합하세요.

```json
{
  "mcpServers": {
    "iptime": {
      "command": "node",
      "args": ["/absolute/path/to/iptime-mcp/dist/server.js"],
      "cwd": "/absolute/path/to/iptime-mcp",
      "trust": false
    }
  }
}
```

지정한 `cwd`에서 서버가 `.env`를 읽습니다. Gemini가 도구 호출 전 확인을 계속 요청하도록 `trust`를 `false`로 유지하고 `gemini mcp list`를 실행하세요. 현재 폴더가 신뢰되지 않았다면 `gemini trust`를 먼저 실행합니다. CLI 등록 명령의 기본 범위는 프로젝트이므로 직접 등록할 때는 `--scope user`를 사용하세요. 자세한 내용은 [Gemini CLI MCP 공식 문서](https://geminicli.com/docs/tools/mcp-server/)를 참고하세요.

### 그 밖의 stdio MCP 클라이언트

실행 명령은 `node`, 유일한 인자는 `/absolute/path/to/iptime-mcp/dist/server.js`로 지정하고 `.env`의 `IPTIME_*` 변수를 전달하세요. 모든 클라이언트가 같은 JSON 최상위 키를 쓰는 것은 아닙니다. 예를 들어 VS Code는 `servers`를 사용하고 Claude Desktop, Cursor, Copilot CLI, Gemini CLI는 `mcpServers`를 사용합니다.

## 환경 변수

### 공유기 한 대

| 변수 | 필수 여부 | 기본값 | 설명 |
|---|---|---|---|
| `IPTIME_ROUTER_URL` | 필수 | — | `http` 또는 `https` 공유기 기본 URL |
| `IPTIME_ROUTER_ID` | 선택 | `default` | `router_id`로 노출되는 프로필 이름 |
| `IPTIME_ROUTER_USERNAME` | 로그인 시 필수 | — | 공유기 관리자 아이디 |
| `IPTIME_ROUTER_PASSWORD` | 로그인 시 필수 | — | 공유기 관리자 비밀번호 |
| `IPTIME_ALLOW_INSECURE_REMOTE_HTTP` | 선택 | `false` | 호스트가 공인 주소로 해석될 때 평문 HTTP 허용 |
| `IPTIME_TLS_FINGERPRINT` | 선택 | — | 일반 TLS 검증에 추가로 확인할 SHA-256 인증서 지문. 콜론 포함 여부 무관 |
| `IPTIME_TIMEOUT_MS` | 선택 | `12000` | 요청 제한시간. 1,000~60,000ms 범위로 제한 |

아이디나 비밀번호를 `IPTIME_ROUTER_URL` 안에 넣으면 실행이 거부됩니다.

실행 작업 디렉터리의 `.env` 파일도 자동으로 읽습니다. 로컬에서만 `.env.example`을 `.env`로 복사해 사용하세요. `.env`와 관련 비밀 파일은 Git에서 제외됩니다.

### 공유기 여러 대

`IPTIME_ROUTERS`에 JSON 배열을 지정합니다. JSON 자체에 자격증명을 넣지 않도록 `username_env`와 `password_env`로 환경 변수 이름을 참조하세요.

```sh
IPTIME_ROUTERS='[{"id":"home","url":"http://192.168.0.1","username_env":"HOME_ROUTER_USERNAME","password_env":"HOME_ROUTER_PASSWORD"},{"id":"office","url":"https://router.office.example","username_env":"OFFICE_ROUTER_USERNAME","password_env":"OFFICE_ROUTER_PASSWORD","timeout_ms":20000}]'
HOME_ROUTER_USERNAME=admin
HOME_ROUTER_PASSWORD=your-home-password
OFFICE_ROUTER_USERNAME=admin
OFFICE_ROUTER_PASSWORD=your-office-password
```

공유기가 한 대면 도구 호출에서 `router_id`를 생략할 수 있습니다. 여러 대면 대상 공유기의 `router_id`를 전달해야 합니다.

## MCP 도구

| 도구 | 용도 |
|---|---|
| `iptime_status` | 인터페이스 감지, 자격증명이 있으면 로그인, 제품·시스템 상태 조회 |
| `iptime_login` | MCP 환경의 자격증명으로 로그인하고 필요한 경우 CAPTCHA 답 제출 |
| `iptime_logout` | 현재 공유기 관리자 세션 종료 |
| `iptime_capabilities` | 대상 모델·펌웨어가 카탈로그 작업을 지원하는지 확인 |
| `iptime_list_operations` | 로컬 작업 카탈로그를 영역 또는 읽기/쓰기로 필터링 |
| `iptime_read` | 읽기 전용 카탈로그 작업 하나 실행 |
| `iptime_backup_config` | 기존 파일을 덮어쓰지 않고 새 `.config` 백업 저장 |
| `iptime_plan_change` | 설정을 적용하지 않고 일반 변경 계획 생성 |
| `iptime_plan_firmware_upgrade` | 로컬 `.bin` 파일을 해시하고 고위험 업그레이드 계획 생성 |
| `iptime_plan_config_restore` | 로컬 `.config` 파일을 해시하고 고위험 복원 계획 생성 |
| `iptime_apply_change` | 확인 토큰 없이 ID로 대기 계획 하나 적용 |
| `iptime_cancel_change` | 대기 중인 계획 취소 |
| `iptime_list_plans` | 메모리에 있는 계획과 상태 목록 조회 |

## MCP 리소스

| URI | 내용 |
|---|---|
| `iptime://configuration` | 자격증명을 제거한 공유기 프로필 |
| `iptime://operations` | 전체 작업 카탈로그, 영역, 읽기/쓰기, 위험도, 파라미터 힌트 |

## 권장 사용 순서

1. `iptime_status`로 공유기를 감지하고 세션을 만듭니다.
2. `iptime_capabilities`를 실행합니다. 필요하면 `wireless`, `network`, `vpn`, `usb` 같은 영역으로 필터링합니다.
3. `iptime_list_operations`에서 정확한 작업 이름과 파라미터 힌트를 찾습니다.
4. 조회는 `iptime_read`로 실행합니다.
5. 변경은 먼저 계획을 만들고 위험도, 파라미터, 이전 상태와 만료 시각을 사용자에게 보여줍니다.
6. 계획이 사용자의 구체적인 요청과 일치하면 토큰이나 계획 ID를 다시 말하게 하지 않고 적용합니다. 사용자가 아직 명시적으로 승인하지 않은 치명적 위험 작업만 자연어로 한 번 더 확인합니다.
7. 결과가 불확실하다고 나오면 다른 작업을 하기 전에 반환된 검증 상태부터 확인합니다.

자주 사용할 수 있는 조회 작업:

- `product.info`, `system.info`
- `network.info`, `network.interface.lan.stations`
- `dhcpd.lease.show`, `dhcpd.reservedaddr.show`
- `wireless.client.show`, `wireless.channel.list`
- `portforward.get`, `upnp.relay`
- `firewall.get`
- `wg.client.show`, `wg.peer.show`, `vpncli.status.list`
- `ddns.config`, `ddns.status.get`
- `usb.show`, `usb.mount.list`, `nas.user.show`
- `syslog.show`, `wol.show`

일부 메서드는 빈 객체가 아니라 문자열, 배열 또는 특정 객체를 요구합니다. 카탈로그의 `paramsHint`와 `defaultParams`가 확인된 형식을 설명합니다. 예를 들어 무선 채널 목록은 `"2g"` 또는 `"5g"` 같은 밴드 값이 필요하고, DDNS 상태 조회는 등록된 호스트 이름이 필요합니다.

## 백업·복원·펌웨어

`iptime_backup_config`는 다음 규칙을 적용합니다.

- 출력 경로가 `.config`로 끝나야 함
- 필요한 상위 디렉터리 자동 생성
- 기존 파일 덮어쓰기 거부
- 소유자만 읽고 쓸 수 있는 권한(`0600`) 적용
- 빈 백업과 32MiB 초과 파일 거부

설정 백업에는 내부 네트워크 설정이나 비밀값이 들어갈 수 있습니다. `*.config`는 Git에서 제외되며 절대로 커밋하면 안 됩니다.

펌웨어·복원 계획은 계획 시 파일 크기와 SHA-256 해시를 기록하고 업로드 직전에 다시 확인합니다. 펌웨어는 `.bin`, 설정 백업은 `.config` 확장자가 필요합니다. 펌웨어 파일이 공유기 모델과 맞는지는 자동으로 판별하지 않으므로 정확한 모델용 파일인지 직접 확인하고 고위험 계획을 신중하게 검토하세요.

## 네트워크 보안

- 공인 주소의 평문 HTTP는 `IPTIME_ALLOW_INSECURE_REMOTE_HTTP=true`가 아니면 거부됩니다.
- 이 예외를 켜면 관리자 비밀번호와 세션 쿠키가 노출될 수 있습니다. HTTPS를 쓸 수 없고 신뢰할 수 있는 사설 터널을 통과할 때만 사용하세요.
- 리디렉션과 다른 origin으로 향하는 엔드포인트 구성을 차단합니다.
- 응답은 8MiB로 제한되고 모든 요청에 제한시간이 있습니다.
- ipTIME 세션 쿠키만 보관합니다.
- 비밀번호, 토큰, 세션, private key, PSK와 유사한 필드는 MCP 결과에서 재귀적으로 제거합니다.
- TLS 인증서 지문은 정상적인 인증서 검증 이후 추가 고정 검사로 동작하며, 신뢰되지 않은 자체 서명 인증서를 유효하게 만들지는 않습니다.

MCP 클라이언트 설정 파일에는 공유기 비밀번호가 들어갈 수 있으므로 비밀 파일로 취급하세요.

## CAPTCHA와 세션

공유기가 CAPTCHA를 요구하면 `iptime_login`이 가능한 챌린지 정보와 함께 `CAPTCHA_REQUIRED` 오류를 반환합니다. 필요한 경우 관리자 페이지에서 CAPTCHA를 확인한 뒤 `captcha_code`와 함께 `iptime_login`을 다시 호출하세요.

읽기 작업 도중 세션이 만료되면 한 번 자동으로 다시 로그인합니다. 인증이나 네트워크 문제로 결과가 모호해진 쓰기 작업은 자동 재시도하지 않습니다.

## 개발

```sh
npm ci
npm run lint
npm test
npm run build
```

개발 모드:

```sh
npm run dev
```

테스트는 loopback 모의 공유기를 사용하므로 실제 장비가 필요하지 않습니다. 운영 중인 공유기를 대상으로 쓰기 테스트를 실행하지 마세요.

## AI 에이전트용 파일

- [`llms.txt`](llms.txt): 프로젝트와 도구를 간결하게 정리한 머신 가독 요약
- [`AGENTS.md`](AGENTS.md): 코딩 에이전트가 이 저장소를 수정할 때 지켜야 할 구조·검증·안전 규칙
- [`templates/AGENTS.md`](templates/AGENTS.md): 이 MCP를 사용할 프로젝트에 복사할 수 있는 에이전트 지침
- [`templates/CLAUDE.md`](templates/CLAUDE.md): Claude Code 프로젝트용 동등한 사용 지침

이 파일들은 실제 도구 흐름과 안전 제약을 설명하며 자격증명이나 로컬 공유기 정보는 포함하지 않습니다.

## 라이선스

[MIT](LICENSE) © 2026 mikusnuz
