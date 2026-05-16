import { useState, useEffect } from "react";
import MainLayout from "./components/layout/MainLayout";
import Wizard from "./components/setup/Wizard";
import "./App.css";

function App() {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem("setup_completed") === "true";
    setSetupCompleted(completed);
  }, []);

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
