**English** | [한국어](README.ko.md)

# iptime-mcp

A safety-gated Model Context Protocol (MCP) server for operating ipTIME routers without repeatedly opening the web admin panel.

It can inspect router state, discover which catalogued operations a specific model and firmware support, and perform confirmed changes across networking, Wi-Fi, NAT, firewall, VPN, DDNS, USB/NAS, system, and automation features.

> This is an unofficial community project and is not affiliated with EFM Networks or ipTIME. Router APIs are firmware-dependent and are not published as a stable public contract.

## Highlights

- 13 focused MCP tools instead of hundreds of top-level tools
- 334 catalogued router operations: 171 reads and 163 writes
- Runtime capability checks on iUX3 through the router's `api/has` method
- Detection for iUX3, Mobile iUX, and classic CGI interfaces
- Read-only operations can run directly
- Every router change uses a short-lived, reviewable plan without confirmation tokens
- Configuration backup, restore planning, and firmware upgrade planning
- Single-router and multi-router profiles
- Credential and session-value redaction
- Public plain HTTP blocked by default

The catalog covers administration, firmware, backup and restore, WAN/LAN/DHCP/DNS, routing and switching, wireless and EasyMesh, NAT and port forwarding, firewall, QoS, VPN, DDNS, USB/NAS services, routines, history, logs, host scanning, and Wake-on-LAN.

## Compatibility

| Interface | Support |
|---|---|
| iUX3 | Uses `/cgi/service.cgi` JSON RPC and checks each known method with `api/has` |
| Mobile iUX | Exposes only explicitly mapped read operations |
| Classic CGI | Exposes only explicitly mapped read operations |

The fixed operation catalog is based on methods observed in an iUX3 application shipped with firmware 15.36.6. A method appearing in the catalog does not mean every router supports it. Always use `iptime_capabilities` for the target router before choosing an operation.

Firmware 16.00.0 introduced ipTIME ID, EasyMesh client connection pinning, and paginated system logs ([official release notes](https://www.iptime.com/support/downloads/27529)). These additions have not been validated against this catalog. This server connects directly to the configured router; it does not authenticate through ipTIME ID or provide its cloud relay. Do not infer support for new features from a firmware version or from a successful status query. For logs, inspect the actual response and firmware-specific pagination before treating a result as complete. Only verified methods are exposed, and unknown write capabilities remain blocked.

Legacy support is intentionally limited to known-safe mappings for system information, DHCP leases and configuration, port forwarding, and Wake-on-LAN. Legacy responses may be returned as raw text. Unknown legacy writes are rejected.

## Safety model

Router changes can interrupt internet access or make the admin interface unreachable. `iptime-mcp` therefore separates reading from writing:

1. `iptime_plan_change` or a file-specific planning tool creates an immutable plan without changing the router.
2. The plan reports the operation, parameters, current state when available, risk, and expiry.
3. `iptime_apply_change` applies that exact plan using only its `plan_id`; users never need to copy an `APPLY <UUID>` token.

A specific request for the same change is sufficient authorization. Clients should ask once more in ordinary language only when a critical-risk plan, such as firmware, restore, reset, credential, or storage-format work, was not already explicitly authorized. MCP clients may still show their normal destructive-tool approval prompt.

Plans expire after 10 minutes, are single-use, include an integrity digest, and are serialized per router. When a write response is lost, the server attempts a readback and does not retry the write automatically. Plans are held in memory and disappear when the MCP process restarts.

## Requirements

- Node.js 22 or later
- Network access to the router admin endpoint
- An ipTIME administrator username and password
- An MCP client with stdio server support

Use a LAN address, a VPN address, or a trusted HTTPS endpoint whenever possible.

## Install from npm

Use `npx -y iptime-mcp` as the stdio command in an MCP client and set `IPTIME_ROUTER_URL`, `IPTIME_ROUTER_USERNAME`, and `IPTIME_ROUTER_PASSWORD` in its private environment configuration. Keep the router URL on a trusted LAN or VPN. The examples below show the equivalent source-install setup for clients that need a local script path.

## Install from source

```sh
git clone https://github.com/mikusnuz/iptime-mcp.git
cd iptime-mcp
npm ci
npm run build
```

The executable entry point is `dist/server.js`.

For clients that support an environment file or configurable working directory, create a local `.env` first:

```sh
cp .env.example .env
```

Fill in the router URL, username, and password. `.env` is ignored by Git and must remain local.

## MCP client setup

Use a user-level configuration whenever possible because router credentials should not be committed to a project. Replace `/absolute/path/to/iptime-mcp` in every example. On Windows, forward-slash paths such as `C:/Users/name/iptime-mcp/dist/server.js` work in JSON. If a desktop client cannot find `node`, use the absolute path reported by `which node` on macOS/Linux or `where node` on Windows.

| Client | User-level configuration |
|---|---|
| Codex / ChatGPT desktop | **Settings → MCP servers** or `~/.codex/config.toml` |
| Claude Desktop | **Settings → Developer → Edit Config** |
| Claude Code | `claude mcp add --scope user` |
| Cursor | `~/.cursor/mcp.json` |
| VS Code agent chat | **MCP: Open User Configuration** |
| GitHub Copilot CLI | `~/.copilot/mcp-config.json` |
| Gemini CLI | `~/.gemini/settings.json` |

### Codex / ChatGPT desktop

Add a stdio server in **Settings → MCP servers**, or add the following to `~/.codex/config.toml`. Replace the path and credentials, save, and restart the MCP server.

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

Codex, its IDE extension, and the ChatGPT desktop app share the MCP configuration on the same Codex host. See the [official MCP configuration guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) for current client options.

If you prefer the local `.env` file, keep `cwd` and omit the `[mcp_servers.iptime.env]` table.

### Claude Desktop

Open **Settings → Developer → Edit Config**, merge the following `iptime` entry into `claude_desktop_config.json`, save, and fully restart Claude Desktop. Keep any other existing servers in the file.

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

Check **Connectors** in the chat composer after restart. See the [official Claude Desktop local MCP guide](https://modelcontextprotocol.io/quickstart/user).

### Claude Code

Register the server for all projects with the Claude Code CLI:

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

The final `--transport` option intentionally comes after the environment values so the variadic `--env` parser does not consume the server name. The user-scoped configuration is stored in `~/.claude.json`. See the [official Claude Code MCP guide](https://code.claude.com/docs/en/mcp).

### Cursor

Create or merge `~/.cursor/mcp.json`. This example reads the ignored local `.env` created above:

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

Restart Cursor, then check **Settings → Tools & MCP**. Project-scoped `.cursor/mcp.json` is also supported, but do not put router credentials in a file that may be committed. See the [official Cursor MCP guide](https://cursor.com/docs/mcp).

### VS Code agent chat / GitHub Copilot Chat

Run **MCP: Open User Configuration** from the Command Palette and merge this configuration. VS Code uses the top-level key `servers`, not `mcpServers`.

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

Start or inspect it with **MCP: List Servers** and accept the server trust prompt on first use. `.vscode/mcp.json` is available for workspace-scoped setup, but the user configuration is safer for router credentials. See the [official VS Code MCP setup](https://code.visualstudio.com/docs/agent-customization/mcp-servers) and [configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).

### GitHub Copilot CLI

GitHub Copilot CLI does not read VS Code's `.vscode/mcp.json`. Create or merge `~/.copilot/mcp-config.json` instead:

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

The configured `cwd` lets `iptime-mcp` load the local `.env`. Verify the connection with `copilot mcp list`. Project-level `.mcp.json` and `.github/mcp.json` are also supported, but never commit router credentials. See the [official Copilot CLI MCP guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers).

### Gemini CLI

Create or merge `~/.gemini/settings.json`:

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

The configured `cwd` lets the server load `.env`. Keep `trust` false so Gemini continues to ask before tool calls, then run `gemini mcp list`. If the current folder is not trusted, run `gemini trust`. The CLI command defaults to project scope; use `--scope user` when registering manually. See the [official Gemini CLI MCP guide](https://geminicli.com/docs/tools/mcp-server/).

### Other stdio MCP clients

Use `node` as the command, `/absolute/path/to/iptime-mcp/dist/server.js` as its only argument, and pass the `IPTIME_*` variables from `.env`. Do not assume every client uses the same JSON wrapper: for example, VS Code uses `servers`, while Claude Desktop, Cursor, Copilot CLI, and Gemini CLI use `mcpServers`.

## Environment variables

### Single router

| Variable | Required | Default | Description |
|---|---|---|---|
| `IPTIME_ROUTER_URL` | Yes | — | Router base URL using `http` or `https` |
| `IPTIME_ROUTER_ID` | No | `default` | Profile name exposed as `router_id` |
| `IPTIME_ROUTER_USERNAME` | For login | — | Router administrator username |
| `IPTIME_ROUTER_PASSWORD` | For login | — | Router administrator password |
| `IPTIME_ALLOW_INSECURE_REMOTE_HTTP` | No | `false` | Allows plain HTTP when the hostname resolves to a public address |
| `IPTIME_TLS_FINGERPRINT` | No | — | SHA-256 certificate fingerprint, with or without colons, checked in addition to normal TLS validation |
| `IPTIME_TIMEOUT_MS` | No | `12000` | Request timeout, clamped to 1,000–60,000 ms |

Credentials must not be embedded in `IPTIME_ROUTER_URL`.

The server also loads a `.env` file from its working directory. Copy `.env.example` to `.env` only for local use; `.env` and related secret files are ignored by Git.

### Multiple routers

Set `IPTIME_ROUTERS` to a JSON array. Use `username_env` and `password_env` so the JSON contains environment-variable names rather than credentials:

```sh
IPTIME_ROUTERS='[{"id":"home","url":"http://192.168.0.1","username_env":"HOME_ROUTER_USERNAME","password_env":"HOME_ROUTER_PASSWORD"},{"id":"office","url":"https://router.office.example","username_env":"OFFICE_ROUTER_USERNAME","password_env":"OFFICE_ROUTER_PASSWORD","timeout_ms":20000}]'
HOME_ROUTER_USERNAME=admin
HOME_ROUTER_PASSWORD=your-home-password
OFFICE_ROUTER_USERNAME=admin
OFFICE_ROUTER_PASSWORD=your-office-password
```

When one router is configured, `router_id` may be omitted. With multiple routers, pass the target `router_id` to router tools.

## MCP tools

| Tool | Purpose |
|---|---|
| `iptime_status` | Detect the interface, authenticate when credentials exist, and read product/system status |
| `iptime_login` | Log in with credentials from the MCP environment; optionally submit a CAPTCHA answer |
| `iptime_logout` | End the current router admin session |
| `iptime_capabilities` | Check catalogued operations against the target model and firmware |
| `iptime_list_operations` | List the local, auditable operation catalog by domain or mode |
| `iptime_read` | Run one read-only catalog operation |
| `iptime_backup_config` | Save a new `.config` backup file without overwriting an existing file |
| `iptime_plan_change` | Create a generic router-change plan without applying it |
| `iptime_plan_firmware_upgrade` | Hash a local `.bin` image and create a critical-risk upgrade plan |
| `iptime_plan_config_restore` | Hash a local `.config` backup and create a critical-risk restore plan |
| `iptime_apply_change` | Apply one pending plan by ID; no confirmation token required |
| `iptime_cancel_change` | Cancel a pending plan |
| `iptime_list_plans` | List pending and completed in-memory plans |

## MCP resources

| URI | Contents |
|---|---|
| `iptime://configuration` | Configured router profiles with credentials omitted |
| `iptime://operations` | Full operation catalog, domains, modes, risks, and parameter hints |

## Recommended workflow

1. Call `iptime_status` to detect the router and establish a session.
2. Call `iptime_capabilities`, optionally filtered by a domain such as `wireless`, `network`, `vpn`, or `usb`.
3. Use `iptime_list_operations` to find the exact operation and parameter hint.
4. Run reads with `iptime_read`.
5. For a change, create a plan and show its risk, parameters, previous state, and expiry to the user.
6. If the plan matches the user's specific request, apply it without asking them to repeat a token or plan ID. Ask once in natural language only for a critical-risk change that was not already explicitly authorized.
7. If the outcome is reported as unknown, inspect the returned verification state before doing anything else.

Useful read operations include:

- `product.info` and `system.info`
- `network.info` and `network.interface.lan.stations`
- `dhcpd.lease.show` and `dhcpd.reservedaddr.show`
- `wireless.client.show` and `wireless.channel.list`
- `portforward.get` and `upnp.relay`
- `firewall.get`
- `wg.client.show`, `wg.peer.show`, and `vpncli.status.list`
- `ddns.config` and `ddns.status.get`
- `usb.show`, `usb.mount.list`, and `nas.user.show`
- `syslog.show` and `wol.show`

Some methods require a scalar, array, or object rather than an empty object. The catalog's `paramsHint` and `defaultParams` fields describe known conventions. For example, Wi-Fi channel listing needs a band such as `"2g"` or `"5g"`, and DDNS status needs the configured hostname.

## Backup, restore, and firmware

`iptime_backup_config`:

- requires a destination ending in `.config`
- creates parent directories when necessary
- refuses to overwrite an existing file
- writes with owner-only permissions (`0600`)
- rejects empty backups and files larger than 32 MiB

Configuration backups can contain private network settings and secrets. `*.config` is ignored by Git and must never be committed.

Firmware and restore plans record the file size and SHA-256 hash, then verify the file again immediately before upload. Firmware images must end in `.bin`; configuration backups must end in `.config`. A firmware image is not validated for router-model compatibility, so obtain the correct image for the exact model and review the critical-risk plan carefully.

## Network security

- Public-address plain HTTP is rejected unless `IPTIME_ALLOW_INSECURE_REMOTE_HTTP=true`.
- Enabling that override can expose the administrator password and session cookie. Use it only through a trusted private tunnel when HTTPS is impossible.
- Redirects and cross-origin endpoint construction are blocked.
- Responses are capped at 8 MiB and requests have a bounded timeout.
- Only the ipTIME session cookie is retained.
- Passwords, tokens, session values, private keys, PSKs, and similar fields are recursively redacted from MCP output.
- An optional TLS fingerprint adds pinning after normal certificate validation; it does not make an untrusted self-signed certificate valid.

Treat MCP client configuration files as secrets because they may contain the router password.

## CAPTCHA and session behavior

If the router requests a CAPTCHA, `iptime_login` returns a `CAPTCHA_REQUIRED` error with available challenge information. Open the router admin page if needed, then retry `iptime_login` with `captcha_code`.

Expired sessions are automatically renewed once for read operations. Writes are never automatically retried after an authentication or network ambiguity.

## Development

```sh
npm ci
npm run lint
npm test
npm run build
```

For development mode:

```sh
npm run dev
```

The test suite uses loopback mock routers and does not require a physical device. Do not run write tests against a production router.

## Files for AI agents

- [`llms.txt`](llms.txt) provides a compact machine-readable project and tool summary.
- [`AGENTS.md`](AGENTS.md) contains repository contribution and safety rules for coding agents.
- [`templates/AGENTS.md`](templates/AGENTS.md) can be copied into a project that should use this MCP server.
- [`templates/CLAUDE.md`](templates/CLAUDE.md) provides equivalent usage guidance for Claude Code projects.

These files describe the actual tool workflow and safety constraints; they do not contain credentials or local router details.

## License

[MIT](LICENSE) © 2026 mikusnuz
