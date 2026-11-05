import type { Context } from "@opencode/plugin/tui/context";

function model(context: Context, sessionID: string, active: boolean) {
  const saved = context.data.session.get(sessionID)?.model;
  const previous = saved ? { providerID: saved.providerID, modelID: saved.id } : undefined;
  return active ? context.ui.model.current() ?? previous : previous;
}

function needsInput(context: Context, sessionID: string) {
  return Boolean(context.data.session.permission.list(sessionID)?.length ||
    context.data.session.form.list(sessionID)?.length);
}

function unseen(context: Context, sessionID: string) {
  const time = context.data.session.get(sessionID)?.time;
  return (time?.idle ?? 0) > (time?.viewed ?? 0);
}

function status(context: Context, sessionID: string, busy: boolean) {
  if (needsInput(context, sessionID)) return "blocked";
  if (busy || context.data.session.status(sessionID) === "running") return "working";
  if (context.data.session.get(sessionID)?.outcome === "failed") return "blocked";
  return unseen(context, sessionID) ? "done" : "idle";
}

/** Read only tab/session metadata, never messages or streamed token counts. */
export function sessions(context: Context) {
  const route = context.ui.router.current();
  const currentID = route.type === "session" ? route.sessionID : undefined;
  const tabs = context.ui.tabs.enabled() ? context.ui.tabs.list()
    : currentID ? [{ sessionID: currentID, active: true, busy: false }] : [];
  return tabs.map((tab) => {
    const selected = model(context, tab.sessionID, tab.active);
    return {
      id: tab.sessionID,
      title: context.data.session.get(tab.sessionID)?.title ?? "New session",
      active: tab.active,
      status: status(context, tab.sessionID, tab.busy),
      provider: selected?.providerID ?? null,
      model: selected?.modelID ?? null,
    };
  });
}
