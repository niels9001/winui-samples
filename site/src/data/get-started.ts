export interface GetStartedResource {
  id: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

export const getStartedResources = [
  {
    id: "windows-app-sdk",
    title: "Windows App SDK and WinUI 3",
    description:
      "Start with the platform overview, release guidance, and recommended desktop app stack.",
    href: "https://learn.microsoft.com/windows/apps/windows-app-sdk/",
    linkLabel: "Read the platform documentation",
  },
  {
    id: "windows-app-development",
    title: "Windows app development",
    description:
      "Explore guidance for design, development, deployment, and publishing on Windows.",
    href: "https://learn.microsoft.com/windows/apps/",
    linkLabel: "Explore Windows app guidance",
  },
  {
    id: "contributing",
    title: "Contribute a migrated sample",
    description:
      "Follow the repository conventions for metadata, migration verification, and pull requests.",
    href: "https://github.com/niels9001/winui-samples/blob/main/CONTRIBUTING.md",
    linkLabel: "Read the contributing guide",
  },
  {
    id: "winui-skills",
    title: "WinUI agent and skills",
    description:
      "Use the public WinUI plugin for focused implementation, design, review, packaging, and testing guidance.",
    href: "https://github.com/niels9001/win-dev-skills/tree/main/plugins/winui",
    linkLabel: "Open the WinUI plugin",
  },
] as const satisfies readonly GetStartedResource[];
