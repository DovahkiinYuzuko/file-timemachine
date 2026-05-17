import { info, warn, error, debug, trace, attachConsole } from '@tauri-apps/plugin-log';

/**
 * Tauriのログプラグインを使用したロガーユーティリティ
 */
export const logger = {
  /**
   * インフォメーションレベルのログ
   */
  info: (message: string) => info(message),
  
  /**
   * 警告レベルのログ
   */
  warn: (message: string) => warn(message),
  
  /**
   * エラーレベルのログ
   */
  error: (message: string) => error(message),
  
  /**
   * デバッグレベルのログ
   */
  debug: (message: string) => debug(message),
  
  /**
   * トレースレベルのログ
   */
  trace: (message: string) => trace(message),
  
  /**
   * ブラウザのコンソールにRust側も含めたログを流す
   */
  attachConsole: () => attachConsole(),
};

export default logger;
