import { useEffect, useState } from "react";
import MainLayout from "./components/layout/MainLayout";
import Wizard from "./components/setup/Wizard";
import logger from "./utils/logger";

import "./App.css";

function App() {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    logger.info("アプリが起動したよ！");
    const completed = localStorage.getItem("setup_completed") === "true";
    setSetupCompleted(completed);
    logger.debug(`セットアップ状況を読み込んだよ: ${completed}`);

    // テーマの初期適用
    const savedTheme = localStorage.getItem("settings_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    logger.debug(`初期テーマを適用したよ: ${savedTheme}`);
  }, []);

  const handleSetupComplete = () => {
    logger.info("セットアップが完了したよ！メイン画面に移動するね");
    localStorage.setItem("setup_completed", "true");
    setSetupCompleted(true);
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
