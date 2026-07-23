export type NodeType = "category" | "material";

export interface Config {
  description?: string;
  workspace: string;
  structure: TreeNode[];
}

export interface CategoryNode {
  type: "category";
  name: string;
  children: TreeNode[];
}

export interface MaterialNode {
  type: "material";
  name: string;
  description?: string;
  resource: string;
}

export type TreeNode = CategoryNode | MaterialNode;

export interface RunOptions {
  /**
   * 目标文件已存在时跳过复制。默认 true。
   */
  skipIfExists?: boolean;
  /**
   * 覆盖已存在的目标文件。默认 false。若为 true，则优先于 skipIfExists。
   */
  overwrite?: boolean;
}

export interface CopyEntry {
  src: string;
  dst: string;
}

export interface SkipEntry {
  src: string;
  dst: string;
  reason: string;
}

export interface ErrorRecord {
  code: string;
  message: string;
  nodePath?: string;
  details?: Record<string, unknown>;
}

export interface MissingResource {
  resource: string;
  reason: "not_found" | "not_readable";
  nodePath?: string;
}

export interface RunResult {
  createdDirectories: string[];
  copiedFiles: CopyEntry[];
  skippedFiles: SkipEntry[];
  overwrittenFiles: CopyEntry[];
  missingResources: MissingResource[];
  errors: ErrorRecord[];
}

export type RunMode = "preview" | "check" | "execute";

export type OutputFormat = "text" | "json" | "markdown";

export interface CheckResult {
  validationErrors: ErrorRecord[];
  missingResources: MissingResource[];
}

export interface CliOptions {
  mode: RunMode;
  format: OutputFormat;
  skipIfExists: boolean;
  overwrite: boolean;
  reportPath?: string;
}

export interface ReportSummary {
  mode: RunMode;
  format: OutputFormat;
  workspace: string;
  createdDirectories: number;
  copiedFiles: number;
  skippedFiles: number;
  overwrittenFiles: number;
  missingResources: number;
  errors: number;
  elapsedMs: number;
  errorList: ErrorRecord[];
  missingList: MissingResource[];
}
