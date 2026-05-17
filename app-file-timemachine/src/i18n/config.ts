import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const supportedLngs = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'th', 'vi', 'id', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ar', 'hi'];

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'ja',
    supportedLngs,
    debug: false,
    interpolation: {
      escapeValue: false, // Reactはデフォルトでエスケープするため不要
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

// 言語切り替え時にRTL（右から左）設定とlang属性を更新
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = i18n.dir(lng);
  document.documentElement.lang = lng;
});

export default i18n;
