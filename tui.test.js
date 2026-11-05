import { expect, mock, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const effects = new Set();
mock.module("@opencode/plugin/tui", () => ({ Plugin: { define: (definition) => definition } }));
mock.module("solid-js", () => ({ createEffect: (effect) => { effects.add(effect); effect(); } }));
const { default: plugin } = await import("./tui.ts");

async function waitFor(path, predicate) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    try {
      const data = JSON.parse(await readFile(path, "utf8"));
      if (predicate(data)) return data;
    } catch { /* Atomic writer may not have published its first snapshot yet. */ }
    await Bun.sleep(10);
  }
  throw new Error("Bridge did not publish the expected metadata");
}

test("publishes all tabs and models, focuses by file event, stays idle without metadata changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "herdr-app-bridge-test-"));
  const previousHome = process.env.HERDR_APP_HOME;
  const previousTerminal = process.env.HC_TERMINAL_ID;
  process.env.HERDR_APP_HOME = directory;
  process.env.HC_TERMINAL_ID = "test-terminal";
  let selected = "a";
  const models = { a: { id: "gpt-6.1-sol", providerID: "openai" },
    b: { id: "claude-opus", providerID: "claude-agent" } };
  const update = () => effects.forEach((effect) => effect());
  const context = {
    ui: {
      slot: (claim) => { claim.render(); return () => effects.clear(); },
      router: { current: () => ({ type: "session", sessionID: selected }) },
      model: { current: () => ({ providerID: models[selected].providerID, modelID: models[selected].id }) },
      tabs: {
        enabled: () => true,
        list: () => Object.keys(models).map((sessionID) => ({ sessionID, active: sessionID === selected, busy: false })),
        focus: (id) => { selected = id; update(); return true; },
      },
    },
    data: { session: {
      get: (id) => ({ title: id, model: models[id], time: { viewed: 2, idle: 1 } }),
      status: () => "idle", permission: { list: () => [] }, form: { list: () => [] },
    } },
  };
  const stop = await plugin.setup(context);
  const path = join(directory, "data/herdr-app-bridge", `${process.pid}.json`);
  try {
    const initial = await waitFor(path, (data) => data.sessions.length === 2);
    expect(initial.sessions.map((session) => [session.id, session.active, session.model])).toEqual([
      ["a", true, "gpt-6.1-sol"], ["b", false, "claude-opus"],
    ]);
    const before = (await stat(path)).mtimeMs;
    for (let index = 0; index < 100; index++) update();
    await Bun.sleep(60);
    expect((await stat(path)).mtimeMs).toBe(before);
    await writeFile(path.replace(".json", ".command.json"), JSON.stringify({
      sessionID: "b", nonce: "switch", created: Date.now(),
    }));
    const switched = await waitFor(path, (data) => data.sessions[1].active);
    expect(switched.sessions.map((session) => session.active)).toEqual([false, true]);
    await writeFile(path.replace(".json", ".command.json"), JSON.stringify({
      sessionID: "a", nonce: "stale", created: Date.now() - 20000,
    }));
    await Bun.sleep(60);
    expect(selected).toBe("b");
  } finally {
    await stop();
    if (previousHome === undefined) delete process.env.HERDR_APP_HOME;
    else process.env.HERDR_APP_HOME = previousHome;
    if (previousTerminal === undefined) delete process.env.HC_TERMINAL_ID;
    else process.env.HC_TERMINAL_ID = previousTerminal;
    await rm(directory, { recursive: true, force: true });
  }
});
