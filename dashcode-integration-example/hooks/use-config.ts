import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useMemo } from "react";
import type { SetStateAction } from "react";
import { layoutType, sidebarType, navBarType } from "@/lib/type";

export type Config = {
  collapsed: boolean;
  theme: string;
  skin: "default" | "bordered";
  layout: layoutType;
  sidebar: sidebarType;
  menuHidden: boolean;
  showSearchBar: boolean;
  showSwitcher: boolean;
  topHeader: "default" | "links";
  contentWidth: "wide" | "boxed";
  navbar: navBarType;
  footer: "sticky" | "default" | "hidden";
  isRtl: boolean;
  subMenu: boolean;
  hasSubMenu: boolean;
  sidebarColor: string;
  headerColor: string;
  sidebarBgImage?: string;
  radius: number;
};
export const defaultConfig: Config = {
  collapsed: false,
  theme: "zinc",
  skin: "default",
  layout: "vertical",
  sidebar: "classic",
  menuHidden: false,
  showSearchBar: true,
  topHeader: "default",
  contentWidth: "wide",
  navbar: "sticky",
  footer: "default",
  isRtl: false,
  showSwitcher: true,
  subMenu: false,
  hasSubMenu: false,
  sidebarColor: "light",
  headerColor: "light",
  sidebarBgImage: undefined,
  radius: 0.5,
};

type StoredConfig = Partial<Config> | null | undefined;

function normalizeConfig(value: StoredConfig): Config {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultConfig;
  }

  return {
    ...defaultConfig,
    ...value,
  };
}

const configAtom = atomWithStorage<StoredConfig>("config", defaultConfig);

export function useConfig() {
  const [storedConfig, setStoredConfig] = useAtom(configAtom);
  const config = useMemo(() => normalizeConfig(storedConfig), [storedConfig]);

  const setConfig = useCallback(
    (nextConfig: SetStateAction<Config>) => {
      setStoredConfig((prevConfig) => {
        const normalizedPrevious = normalizeConfig(prevConfig);
        const resolvedConfig =
          typeof nextConfig === "function"
            ? nextConfig(normalizedPrevious)
            : nextConfig;

        return normalizeConfig(resolvedConfig);
      });
    },
    [setStoredConfig]
  );

  return [config, setConfig] as const;
}
