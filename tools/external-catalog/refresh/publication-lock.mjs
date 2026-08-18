import { realpath } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

import { sha256Hex } from "../lib/canonical.mjs";

function publishLockEndpoint(repositoryRoot) {
  const resolved = path.resolve(repositoryRoot);
  const normalized =
    process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const digest = sha256Hex(normalized).slice(0, 32);
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\winui-samples-external-catalog-${digest}`;
  }
  if (process.platform === "linux") {
    return `\0winui-samples-external-catalog-${digest}`;
  }
  return {
    host: "127.0.0.1",
    port: 49152 + (Number.parseInt(digest.slice(0, 4), 16) % 16384),
    exclusive: true,
  };
}

export async function acquirePublishLock(repositoryRoot) {
  const server = createServer((socket) => socket.destroy());
  const endpoint = publishLockEndpoint(await realpath(repositoryRoot));
  await new Promise((resolve, reject) => {
    function onError(error) {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            "another external catalog refresh is publishing state",
          ),
        );
      } else {
        reject(error);
      }
    }
    server.once("error", onError);
    server.listen(endpoint, () => {
      server.off("error", onError);
      resolve();
    });
  });

  let released = false;
  return async () => {
    if (released) {
      return;
    }
    released = true;
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };
}
