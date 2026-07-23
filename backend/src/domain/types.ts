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
  overwrittenFiles: CopyEntry[];
  skippedFiles: SkipEntry[];
  missingResources: string[];
  errors: ErrorRecord[];
}

export type OutputFormat = "text" | "json" | "markdown";

export type CliMode = "preview" | "execute" | "check";

