import { createRequire } from "node:module";
import type { ComponentType, ExoticComponent } from "react";

interface IconProps {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

type IconComponent =
  | ComponentType<IconProps>
  | ExoticComponent<IconProps>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIconComponent(value: unknown): value is IconComponent {
  return (
    typeof value === "function" ||
    (isRecord(value) && "$$typeof" in value)
  );
}

interface SampleIconProps {
  name: string;
  className?: string;
}

const loadModule = createRequire(import.meta.url);
const fluentIconExports: unknown = loadModule("@fluentui/react-icons");

export function SampleIcon({ name, className }: SampleIconProps) {
  if (!isRecord(fluentIconExports)) {
    throw new Error("Fluent System Icons did not expose an icon registry.");
  }

  const Icon = fluentIconExports[name];
  if (!isIconComponent(Icon)) {
    throw new Error(`Unknown Fluent System Icon export: ${name}`);
  }

  return <Icon aria-hidden="true" className={className} />;
}
