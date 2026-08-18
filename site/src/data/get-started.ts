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
    title: "Choose your app stack",
    description:
      "Review the Windows App SDK, WinUI 3, release channels, and supported Windows versions.",
    href: "https://learn.microsoft.com/windows/apps/windows-app-sdk/",
    linkLabel: "Windows App SDK overview",
  },
  {
    id: "windows-app-development",
    title: "Design for Windows",
    description:
      "Use Windows guidance for layout, navigation, accessibility, packaging, and deployment.",
    href: "https://learn.microsoft.com/windows/apps/",
    linkLabel: "Windows app guidance",
  },
  {
    id: "winui-skills",
    title: "Work with the WinUI plugin",
    description:
      "Get focused implementation, design, packaging, review, and test guidance in your coding agent.",
    href: "https://github.com/niels9001/win-dev-skills/tree/main/plugins/winui",
    linkLabel: "Open the WinUI plugin",
  },
] as const satisfies readonly GetStartedResource[];
