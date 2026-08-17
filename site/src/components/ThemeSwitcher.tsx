import { useEffect, useState } from "react";
import { Button } from "@fluentui/react-button";
import { FluentProvider } from "@fluentui/react-provider";
import { webDarkTheme, webLightTheme } from "@fluentui/react-theme";
import {
  DesktopRegular,
} from "@fluentui/react-icons/svg/desktop";
import { WeatherMoonRegular } from "@fluentui/react-icons/svg/weather-moon";
import { WeatherSunnyRegular } from "@fluentui/react-icons/svg/weather-sunny";

import "./ThemeSwitcher.css";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const storageKey = "winui-samples-theme";
const preferences: ThemePreference[] = ["system", "light", "dark"];

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

function applyDocumentTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
) {
  document.documentElement.dataset.theme = resolveTheme(preference, systemTheme);
  document.documentElement.dataset.themePreference = preference;
}

function PreferenceIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") {
    return <WeatherSunnyRegular />;
  }
  if (preference === "dark") {
    return <WeatherMoonRegular />;
  }
  return <DesktopRegular />;
}

export function ThemeSwitcher() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");
  const resolvedTheme = resolveTheme(preference, systemTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const storedPreference = window.localStorage.getItem(storageKey);
    const initialPreference = isThemePreference(storedPreference)
      ? storedPreference
      : "system";
    const initialSystemTheme = media.matches ? "dark" : "light";

    setPreference(initialPreference);
    setSystemTheme(initialSystemTheme);
    applyDocumentTheme(initialPreference, initialSystemTheme);

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", handleSystemThemeChange);

    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, []);

  useEffect(() => {
    applyDocumentTheme(preference, systemTheme);
  }, [preference, systemTheme]);

  const updatePreference = (nextPreference: ThemePreference) => {
    window.localStorage.setItem(storageKey, nextPreference);
    setPreference(nextPreference);
  };

  const preferenceIndex = preferences.indexOf(preference);
  const nextPreference =
    preferences[(preferenceIndex + 1) % preferences.length] ?? "system";

  return (
    <FluentProvider
      className="theme-switcher-provider"
      theme={resolvedTheme === "dark" ? webDarkTheme : webLightTheme}
    >
      <Button
        appearance="subtle"
        aria-label={`Color theme: ${preference}. Activate to use ${nextPreference}.`}
        icon={<PreferenceIcon preference={preference} />}
        onClick={() => updatePreference(nextPreference)}
      >
        <span className="theme-switcher-label">
          {preference.charAt(0).toUpperCase()}
          {preference.slice(1)}
        </span>
      </Button>
    </FluentProvider>
  );
}
