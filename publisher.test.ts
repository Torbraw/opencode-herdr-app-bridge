import { expect, test } from "bun:test";
import { publisher } from "./publisher";

test("repeated reactive updates do not produce heartbeat writes", async () => {
  const writes: string[] = [];
  const output = publisher(async (value) => { writes.push(value); });
  output.publish("metadata");
  for (let index = 0; index < 1000; index++) output.publish("metadata");
  await output.close();
  expect(writes).toEqual(["metadata"]);
});

test("slow storage coalesces intermediate snapshots without dropping the latest", async () => {
  const writes: string[] = [];
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const output = publisher(async (value) => {
    writes.push(value);
    if (value === "first") await gate;
  });
  output.publish("first");
  output.publish("superseded");
  output.publish("latest");
  release();
  await output.close();
  expect(writes).toEqual(["first", "latest"]);
});
