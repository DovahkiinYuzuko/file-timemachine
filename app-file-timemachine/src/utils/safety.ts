/**
 * 安全ガードのためのファイル解析ユーティリティ
 */

export interface SafetyIssue {
  path: string;
  reason: string;
  type: "danger" | "warning";
}

export interface FileInfo {
  path: string;
  size: number;
}

// 危険な拡張子 (大文字小文字を区別せず endsWith でチェック)
const DANGEROUS_EXTENSIONS = [
  // 共通のセキュリティリスク・認証情報
  ".env",
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".der",
  ".pub",
  ".pkcs12",

  // Windows 実行可能・システムファイル
  ".exe",
  ".dll",
  ".msi",
  ".msix",
  ".msm",
  ".msp",
  ".bat",
  ".cmd",
  ".lnk",
  ".sys",
  ".vbs",

  // macOS 実行可能・システムファイル
  ".dylib",
  ".dmg",
  ".pkg",
  ".app",
  ".ds_store",

  // Linux/Unix 実行可能ファイル
  ".so",
  ".out",
  ".bin",
  
  // 一時・バックアップファイル
  ".tmp",
  ".bak",
  ".swp",
];

// 危険なファイル名 (大文字小文字を区別せず完全一致でチェック)
const DANGEROUS_FILENAMES = [
  // Windows
  "thumbs.db",
  "ehthumbs.db",
  "desktop.ini",

  // macOS
  ".ds_store",
  ".apple_double",
  ".lsoverride",
  ".com.apple.timemachine.donotpresent",
  ".volumeicon.icns",

  // Linux
  ".directory",
  ".fuse_hidden",
  ".nfs",

  // SSH秘密鍵など（拡張子なし）
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rfc4716",

  // 認証設定
  ".npmrc",
  ".gitconfig",
];

// 危険なファイル名プレフィックス (大文字小文字を区別せず、ファイル名がこれらで始まるかチェック)
const DANGEROUS_PREFIXES = [
  "._", // AppleDouble リソース一時ファイル
  ".fuse_hidden",
  ".nfs",
  ".trash-",
];

// 危険なファイル名サフィックス (大文字小文字を区別せず、ファイル名がこれらで終わるかチェック)
const DANGEROUS_SUFFIXES = [
  "~", // エディタ等の一時バックアップファイル
];

// 危険なパス・ディレクトリパターン (大文字小文字を区別せず、パスのいずれかに含まれるかチェック)
const DANGEROUS_PATTERNS = [
  "node_modules/",
  ".git/",
  "$recycle.bin/",
  ".spotlight-v100/",
  ".trashes/",
  ".documentrevisions-v100/",
  ".idea/",
  ".vscode/",
  "npm-debug.log",
  "yarn-debug.log",
  "yarn-error.log",
  ".env.local",
  ".env.development.local",
  ".env.test.local",
  ".env.production.local",
];

const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB

/**
 * ファイルのリストを解析して、セキュリティ上の懸念や巨大ファイルを検知します。
 * 
 * @param files 解析対象 of ファイル情報の配列
 * @returns 検知された問題のリスト
 */
export const analyzeFilesForSafety = (files: FileInfo[]): SafetyIssue[] => {
  const issues: SafetyIssue[] = [];

  for (const file of files) {
    const normalizedPath = file.path.toLowerCase().replace(/\\/g, "/");
    // パスからファイル名（最後の要素）を取得
    const parts = normalizedPath.split("/");
    const filename = parts[parts.length - 1];

    // 1. セキュリティリスク (秘密鍵や設定ファイルなどの拡張子・ファイル名)
    const isSecurityRiskExt = DANGEROUS_EXTENSIONS.some((ext) =>
      filename.endsWith(ext)
    ) && [".env", ".pem", ".key", ".p12", ".pfx", ".der", ".pub", ".pkcs12"].some((secExt) =>
      filename.endsWith(secExt)
    );

    const isSecurityPrivateKey = ["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "id_rfc4716"].includes(filename);

    if (isSecurityRiskExt || isSecurityPrivateKey) {
      issues.push({
        path: file.path,
        reason: "security_risk_extension",
        type: "danger",
      });
      continue;
    }

    // 2. OS固有の不要なファイルや開発ゴミ (DANGEROUS_FILENAMES / DANGEROUS_PREFIXES / DANGEROUS_SUFFIXES / DANGEROUS_PATTERNS)
    const isDangerousFilename = DANGEROUS_FILENAMES.includes(filename);
    const isDangerousPrefix = DANGEROUS_PREFIXES.some((prefix) => filename.startsWith(prefix));
    const isDangerousSuffix = DANGEROUS_SUFFIXES.some((suffix) => filename.endsWith(suffix));
    const isDangerousPattern = DANGEROUS_PATTERNS.some((pattern) => normalizedPath.includes(pattern));
    
    // システムの実行可能ファイルや一時ファイルの拡張子も管理対象外にすべきファイルとして扱う
    const isSystemTrashExt = DANGEROUS_EXTENSIONS.some((ext) =>
      filename.endsWith(ext)
    ) && ![".env", ".pem", ".key", ".p12", ".pfx", ".der", ".pub", ".pkcs12"].some((secExt) =>
      filename.endsWith(secExt)
    );

    if (isDangerousFilename || isDangerousPrefix || isDangerousSuffix || isDangerousPattern || isSystemTrashExt) {
      issues.push({
        path: file.path,
        reason: "inappropriate_directory",
        type: "danger",
      });
      continue;
    }

    // 3. ファイルサイズのチェック
    if (file.size > LARGE_FILE_THRESHOLD) {
      issues.push({
        path: file.path,
        reason: "large_file",
        type: "warning",
      });
    }
  }

  return issues;
};
