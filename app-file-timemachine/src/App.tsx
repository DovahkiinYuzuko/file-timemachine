import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import MainLayout from "./components/layout/MainLayout";
import Wizard from "./components/setup/Wizard";
import "./App.css";

function App() {
  const { i18n } = useTranslation();
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem("setup_completed") === "true";
    setSetupCompleted(completed);
  }, []);

  useEffect(() => {
    // 言語設定に応じてHTMLのdirとlang属性を更新
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const handleSetupComplete = () => {
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
