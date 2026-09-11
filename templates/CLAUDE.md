# iptime-mcp instructions for Claude Code

Use the configured `iptime` MCP server for ipTIME router inspection and administration. Depending on the client, tool names may appear with an `mcp__iptime__` prefix.

## Workflow

1. Call `iptime_status` before other router work.
2. Call `iptime_capabilities` for the relevant domain.
3. Find the exact catalog entry and parameter shape with `iptime_list_operations`.
4. Execute reads with `iptime_read`.
5. For any write, create a plan first and show its operation, parameters, previous state, risk, and expiry.
6. If the plan matches the user's specific request, apply it without asking them to repeat a token or plan id. Ask once in natural language only for a critical-risk change not already explicitly authorized.

## Non-negotiable safety rules

- Router usernames and passwords belong only in the MCP process environment. Never request them in chat or pass them as tool arguments.
- Do not require or manufacture plan confirmation tokens. A vague request is not authorization for a specific write.
- Warn before connectivity or critical actions that can interrupt access, reboot, reset, restore, upgrade firmware, change administrator access, or format storage.
- Prefer a configuration backup before high-risk work.
- Never enable public plain HTTP access without an explicit, informed request.
- Never retry a write with an unknown result. Inspect the returned `verification` state.
- Do not invent router API methods. Use only catalogued and supported operations.
- Preserve the exact scalar, array, object, or omitted shape described by an operation's `paramsHint`.

## Tools

- Status and discovery: `iptime_status`, `iptime_capabilities`, `iptime_list_operations`
- Session: `iptime_login`, `iptime_logout`
- Read: `iptime_read`
- Backup: `iptime_backup_config`
- Plan: `iptime_plan_change`, `iptime_plan_firmware_upgrade`, `iptime_plan_config_restore`
- Apply or cancel: `iptime_apply_change`, `iptime_cancel_change`
- Inspect plans: `iptime_list_plans`

Use `router_id` when multiple router profiles are configured. Treat router backups, topology, client lists, and logs as sensitive data.
