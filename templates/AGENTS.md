# iptime-mcp usage instructions

This project can use the `iptime` MCP server to inspect and manage configured ipTIME routers.

## When to use it

Use iptime-mcp for router status, connected devices, DHCP reservations, Wi-Fi, EasyMesh, port forwarding, firewall, QoS, VPN, DDNS, USB/NAS services, logs, routines, Wake-on-LAN, backups, restores, and firmware workflows.

## Required workflow

1. Start with `iptime_status` to select the router, detect its interface, and establish a session.
2. Use `iptime_capabilities` for the relevant domain because support varies by model and firmware.
3. Use `iptime_list_operations` to find the exact operation, mode, risk, and parameter hint.
4. Run read-only operations with `iptime_read`.
5. For every change, call `iptime_plan_change`, `iptime_plan_firmware_upgrade`, or `iptime_plan_config_restore` first.
6. Present the plan's operation, parameters, risk, previous state, expiry, and exact confirmation string to the user.
7. Call `iptime_apply_change` only after the user explicitly repeats that exact confirmation string.

## Safety rules

- Never ask the user to paste router credentials into chat or a tool call. Credentials must already exist in the MCP server environment.
- Never treat a general request such as “change it” as the exact plan confirmation. Do not repeat or synthesize the confirmation on the user's behalf.
- Warn clearly before connectivity or critical changes that may disconnect the user, reboot the router, reset configuration, change admin access, restore a backup, upgrade firmware, or format storage.
- Prefer creating a configuration backup before high-risk changes when the router supports it.
- Never enable public plain HTTP access or `IPTIME_ALLOW_INSECURE_REMOTE_HTTP` without an explicit, informed user decision.
- Never retry a write after a timeout, lost response, or unknown outcome. Inspect the plan's `verification` state first.
- Treat configuration backups and returned network topology as sensitive.
- Use only operations returned by `iptime_list_operations`; do not invent private method names.

## Tool reference

- Discovery: `iptime_status`, `iptime_capabilities`, `iptime_list_operations`
- Session: `iptime_login`, `iptime_logout`
- Reads: `iptime_read`
- Backup: `iptime_backup_config`
- Planning: `iptime_plan_change`, `iptime_plan_firmware_upgrade`, `iptime_plan_config_restore`
- Plan lifecycle: `iptime_apply_change`, `iptime_cancel_change`, `iptime_list_plans`

## Parameter handling

The `params` value can be an object, array, string, number, boolean, or null. Preserve the shape described in `paramsHint`; omitting `params` is not the same as sending `{}`. Obtain target IDs, bands, service names, hostnames, and history ranges through read operations before using item-specific calls.

When only one router is configured, omit `router_id`. When multiple routers exist, ask which configured profile to use unless the user already identified it.
