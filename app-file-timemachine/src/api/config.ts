import { invoke } from "@tauri-apps/api/core";

export interface AppConfig {
  last_opened_folder: string | null;
  settings_save_behavior: string | null;
  setup_completed: boolean | null;
  settings_theme: string | null;
  settings_auto_scan: boolean | null;
}

export const getAppConfig = async (): Promise<AppConfig> => {
  return await invoke("get_app_config");
};

export const setAppConfig = async (config: AppConfig): Promise<void> => {
  await invoke("set_app_config", { config });
};

export const updateAppConfig = async (partialConfig: Partial<AppConfig>): Promise<void> => {
  const current = await getAppConfig();
  const updated = { ...current, ...partialConfig };
  await setAppConfig(updated);
};
