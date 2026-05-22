import { useEffect, useState } from "react";
import MainLayout from "./components/layout/MainLayout";
import Wizard from "./components/setup/Wizard";
import logger from "./utils/logger";
import { getAppConfig, updateAppConfig } from "./api/config";

import "./App.css";

function App() {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    logger.info("Application started.");
    
    const initApp = async () => {
      try {
        const config = await getAppConfig();
        const completed = config.setup_completed === true;
        setSetupCompleted(completed);
        logger.debug(`Loaded setup completed status: ${completed}`);

        const savedTheme = config.settings_theme || "light";
        document.documentElement.setAttribute("data-theme", savedTheme);
        logger.debug(`Applied initial theme: ${savedTheme}`);
      } catch (error) {
        logger.error(`Failed to load settings: ${error}`);
        setSetupCompleted(false);
      }
    };

    initApp();
  }, []);

  const handleSetupComplete = async () => {
    logger.info("Setup completed. Redirecting to main layout.");
    try {
      await updateAppConfig({ setup_completed: true });
      setSetupCompleted(true);
    } catch (error) {
      logger.error(`Failed to save setup completed flag: ${error}`);
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
