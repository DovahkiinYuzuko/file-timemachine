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

const DANGEROUS_EXTENSIONS = [
  ".env",
  ".pem",
  ".key",
  ".p12",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
];
const DANGEROUS_PATTERNS = ["node_modules/", ".git/"];
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB

/**
 * ファイルのリストを解析して、セキュリティ上の懸念や巨大ファイルを検知します。
 * 
 * @param files 解析対象のファイル情報の配列
 * @returns 検知された問題のリスト
 */
export const analyzeFilesForSafety = (files: FileInfo[]): SafetyIssue[] => {
  const issues: SafetyIssue[] = [];

  for (const file of files) {
    // 拡張子のチェック
    const isDangerousExt = DANGEROUS_EXTENSIONS.some((ext) =>
      file.path.toLowerCase().endsWith(ext)
    );
    if (isDangerousExt) {
      issues.push({
        path: file.path,
        reason: "security_risk_extension",
        type: "danger",
      });
      continue;
    }

    // 特定のパターンのチェック
    const isDangerousPattern = DANGEROUS_PATTERNS.some((pattern) =>
      file.path.includes(pattern)
    );
    if (isDangerousPattern) {
      issues.push({
        path: file.path,
        reason: "inappropriate_directory",
        type: "danger",
      });
      continue;
    }

    // ファイルサイズのチェック
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
