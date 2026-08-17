import generatedActivity from "../generated/sample-activity.json";

export type ActivityKind = "new" | "updated" | "refreshed";

export interface ActivityPullRequest {
  number: number;
  title: string;
  url: string;
}

export interface SampleActivityEntry {
  sampleId: string;
  kind: ActivityKind;
  mergedAt: string;
  pullRequest: ActivityPullRequest;
  provenance: ActivityPullRequest[];
}

export interface SampleActivity {
  schemaVersion: 1;
  source: "github" | "git" | "offline";
  entries: SampleActivityEntry[];
}

function isPullRequest(value: unknown): value is ActivityPullRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isInteger((value as ActivityPullRequest).number) &&
    typeof (value as ActivityPullRequest).title === "string" &&
    typeof (value as ActivityPullRequest).url === "string"
  );
}

export function parseActivity(value: unknown): SampleActivity {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as SampleActivity).schemaVersion !== 1 ||
    !["github", "git", "offline"].includes((value as SampleActivity).source) ||
    !Array.isArray((value as SampleActivity).entries)
  ) {
    throw new Error("Invalid generated sample activity.");
  }

  for (const entry of (value as SampleActivity).entries) {
    if (
      typeof entry.sampleId !== "string" ||
      !["new", "updated", "refreshed"].includes(entry.kind) ||
      Number.isNaN(Date.parse(entry.mergedAt)) ||
      !isPullRequest(entry.pullRequest) ||
      !Array.isArray(entry.provenance) ||
      !entry.provenance.every(isPullRequest)
    ) {
      throw new Error("Invalid generated sample activity entry.");
    }
  }
  return value as SampleActivity;
}

export const activity = parseActivity(generatedActivity);

