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

export interface RunResult {
  createdDirectories: string[];
  copiedFiles: CopyEntry[];
  skippedFiles: SkipEntry[];
  /**
   * 因 overwrite 策略而覆盖已存在目标的文件。是 copiedFiles 的子集。
   */
  overwrittenFiles: CopyEntry[];
  errors: ErrorRecord[];
}

/**
 * 结构预览的输出格式。
 */
export type OutputFormat = "text" | "json" | "markdown";

/**
 * 检查模式下发现的缺失或不可读资源。
 */
export interface MissingResource {
  /** material.resource 原始路径 */
  resource: string;
  /** 该资源在配置结构中的路径，便于定位 */
  nodePath: string;
  /** 缺失原因（不存在 / 不可读） */
  reason: string;
}

/**
 * 检查模式结果：仅做校验与资源存在性验证，不涉及任何写操作。
 */
export interface CheckResult {
  validationErrors: ErrorRecord[];
  missingResources: MissingResource[];
}

/**
 * 执行 / 检查 / 预览结束后的统一汇总报告。
 */
export interface RunReport {
  mode: "preview" | "execute" | "check";
  createdDirectories: number;
  copiedFiles: number;
  skippedFiles: number;
  overwrittenFiles: number;
  errors: number;
  missingResources: number;
}

