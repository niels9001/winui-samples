import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewedLifecycleOutput as buildGalleryOutput,
} from "../providers/winui-gallery/generate.mjs";
import {
  buildReviewedLifecycleOutput as buildWindowsOutput,
} from "../providers/windows-app-sdk-samples/index.mjs";

for (const [providerId, buildOutput] of [
  ["winui-gallery", buildGalleryOutput],
  ["windows-app-sdk-samples", buildWindowsOutput],
]) {
  test(`${providerId} emits persisted reviewed tombstones and redirects`, () => {
    const oldId = `${providerId}:old-record`;
    const newId = `${providerId}:new-record`;
    const history = {
      records: [
        {
          id: oldId,
          recordKey: "old-record",
          routePath: `samples/${providerId}--old-record--000000000000`,
          status: "tombstoned",
          removedAtSync: "sync-2",
        },
      ],
    };
    const redirect = {
      fromPath: `samples/${providerId}-legacy`,
      toId: newId,
      declaredAtSync: "sync-2",
      reason: "Reviewed legacy alias.",
    };
    const output = buildOutput(history, {
      renameDeclarations: [
        {
          fromId: oldId,
          toId: newId,
          declaredAtSync: "sync-2",
          reason: "Reviewed immutable-key replacement.",
        },
      ],
      redirectDeclarations: [redirect],
    });

    assert.deepEqual(output.redirects, [redirect]);
    assert.deepEqual(output.tombstones, [
      {
        id: oldId,
        providerId,
        recordKey: "old-record",
        routePath: `samples/${providerId}--old-record--000000000000`,
        removedAtSync: "sync-2",
        reason: "Reviewed immutable-key replacement.",
        redirectToId: newId,
      },
    ]);
  });
}
