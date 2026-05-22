import { useEffect, useState } from "react";
import MainLayout from "./components/layout/MainLayout";
import Wizard from "./components/setup/Wizard";
import logger from "./utils/logger";
import { getAppConfig, updateAppConfig } from "./api/config";

import "./App.css";

function App() {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    logger.info("アプリが起動しました。");
    
    const initApp = async () => {
      try {
        const config = await getAppConfig();
        const completed = config.setup_completed === true;
        setSetupCompleted(completed);
        logger.debug(`セットアップ状況を読み込みました: ${completed}`);

        const savedTheme = config.settings_theme || "light";
        document.documentElement.setAttribute("data-theme", savedTheme);
        logger.debug(`初期テーマを適用しました: ${savedTheme}`);
      } catch (error) {
        logger.error(`設定の読み込みに失敗しました: ${error}`);
        setSetupCompleted(false);
      }
    };

    initApp();
  }, []);

  const handleSetupComplete = async () => {
    logger.info("セットアップが完了しました。メイン画面に移動します。");
    try {
      await updateAppConfig({ setup_completed: true });
      setSetupCompleted(true);
    } catch (error) {
      logger.error(`セットアップ完了フラグの保存に失敗しました: ${error}`);
    }
  };

  if (setupCompleted === null) {
    return null; // 初期ロード中
  }

  return (
    <div className="app-container">
      {setupCompleted ? (
        <MainLayout />
      ) : (
        <Wizard onComplete={handleSetupComplete} />
      )}
    </div>
  );
}

export default App;
