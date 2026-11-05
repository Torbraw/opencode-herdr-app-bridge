# herdr-app-bridge

OpenCode V2 TUI plugin for the [Herdr app layout](https://github.com/Torbraw/herdr-app-layout). Shows open tabs, session titles, activity and model/provider details in Herdr. Click a session in the sidebar to focus its OpenCode tab.

## Install

Install the linked Herdr app layout, then merge this into `~/.config/opencode/cli.json`:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["github:Torbraw/opencode-herdr-app-bridge#main"],
  "tabs": { "mode": "on" }
}
```

Keep other plugins/settings. Enable this plugin only once: replace an existing local `herdr-app-bridge` entry when switching to the GitHub package. Config changes reload automatically.

OpenCode installs the plugin directly from GitHub; no npm install or build step is needed. See OpenCode's [package installation documentation](https://opencode.ai/v2/docs/plugins).

### Updates

```sh
opencode plugin check
opencode plugin update 'github:Torbraw/opencode-herdr-app-bridge#main'
```

## Behavior

- Runs inside terminals with Herdr's `HC_TERMINAL_ID`; otherwise does nothing.
- Writes version-1 snapshots to `${HERDR_APP_HOME:-~/.config/herdr-app}/data/herdr-app-bridge/<pid>.json`.
- Exposes session IDs, titles, selected model/provider, active tab and status. No conversation bodies or credentials are exported.
- Coalesces metadata changes; unchanged state produces no disk writes. No heartbeat timer.
- Watches `<pid>.command.json` for focus requests, rejecting expired requests and sessions absent from that frontend.
- Removes its snapshot and mailbox on unload. Herdr also matches snapshots against the live process PID.
- The Herdr layout works without this plugin, using native agent rows instead.

Status is per OpenCode tab. Herdr supplements the selected tab's idle status with its own unread-completion signal.

## Development

For local development, clone this repository and use its absolute directory path in `plugins` instead. No build is required; OpenCode supplies the TUI and Solid runtime imports.

```sh
bun test
```

The integration test exercises metadata publication, focus requests, stale-request rejection and idle-write deduplication.

Requires OpenCode V2's TUI plugin API and a local Herdr frontend. Remote Herdr machines do not share this local file bridge.
