import { invoke } from "@tauri-apps/api/core";

export interface ProjectPosition {
  gitgraph_scale?: number | null;
  gitgraph_offset_x?: number | null;
  gitgraph_offset_y?: number | null;
  history_list_scroll_y?: number | null;
  gitgraph_sort_desc?: boolean | null;
  history_list_sort_desc?: boolean | null;
}

export interface AppConfig {
  last_opened_folder: string | null;
  settings_save_behavior: string | null;
  setup_completed: boolean | null;
  settings_theme: string | null;
  settings_auto_scan: boolean | null;
  github_token: string | null;
  github_username: string | null;
  project_positions?: Record<string, ProjectPosition> | null;
}

export const getAppConfig = async (): Promise<AppConfig> => {
  return await invoke("get_app_config");
};

export const setAppConfig = async (config: AppConfig): Promise<void> => {
  await invoke("set_app_config", { config });
};

// 設定更新を直列化するためのキュー
let updateQueue: Promise<void> = Promise.resolve();

export const updateAppConfig = async (partialConfig: Partial<AppConfig>): Promise<void> => {
  // 並行書き込みによる設定ファイルの破損を防ぐため、Promiseキューで直列化する
  updateQueue = updateQueue.then(async () => {
    const current = await getAppConfig();
    const updated = { ...current, ...partialConfig };
    await setAppConfig(updated);
  }).catch((error) => {
    console.error("設定の保存キューでエラーが発生したよ:", error);
    throw error;
  });
  
  return updateQueue;
};
