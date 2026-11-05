import { Plugin } from "@opencode/plugin/tui";
import { createEffect } from "solid-js";
import { watch } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { publisher } from "./publisher";
import { sessions } from "./sessions";
import { focusCommand } from "./command";

export default Plugin.define({
  id: "herdr-app-bridge",
  async setup(context) {
    const terminal = process.env.HC_TERMINAL_ID;
    if (!terminal || !/^[\w-]+$/.test(terminal)) return;
    const home = process.env.HERDR_APP_HOME ?? join(homedir(), ".config/herdr-app");
    const directory = join(home, "data/herdr-app-bridge");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, `${process.pid}.json`);
    const commandName = `${process.pid}.command.json`;
    const mailbox = join(directory, commandName);
    let lastCommand = "";
    let stopped = false;

    const output = publisher(async (content) => {
      await writeFile(`${path}.tmp`, content, { mode: 0o600 });
      await rename(`${path}.tmp`, path);
    });

    async function consumeCommand() {
      const text = await readFile(mailbox, "utf8").catch(() => "null");
      const command = focusCommand(JSON.parse(text));
      if (stopped || !command || command.nonce === lastCommand) return;
      lastCommand = command.nonce;
      if (Math.abs(Date.now() - command.created) > 10_000) return;
      if (!sessions(context).some((session) => session.id === command.sessionID)) return;
      if (!context.ui.tabs.focus(command.sessionID)) {
        context.ui.router.navigate({ type: "session", sessionID: command.sessionID });
      }
    }

    const watcher = watch(directory, (_event, filename) => {
      if (String(filename) === commandName) void consumeCommand().catch(() => {});
    });
    const unregister = context.ui.slot({
      append: "app",
      render: () => {
        createEffect(() => {
          output.publish(JSON.stringify({ version: 1, terminal, pid: process.pid, sessions: sessions(context) }));
        });
        return null;
      },
    });

    return async () => {
      stopped = true;
      watcher.close();
      unregister();
      await output.close();
      await Promise.all([path, `${path}.tmp`, mailbox].map((file) => unlink(file).catch(() => {})));
    };
  },
});
