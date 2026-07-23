import * as path from "node:path";
import type { Config, TreeNode } from "../domain/types";

export interface CopyRow {
  name: string;
  resource: string;
  destination: string;
}

export interface TreeVisitor {
  onEnterDir?: (
    name: string,
    prefix: string,
    branch: string,
    isLast: boolean,
  ) => void;
  onFile?: (
    fileName: string,
    prefix: string,
    branch: string,
    isLast: boolean,
    row: CopyRow,
  ) => void;
}

function displayName(node: TreeNode): string {
  if (node.type === "material") {
    return node.resource.split(/[/\\]/).pop() || node.name;
  }
  return node.name;
}

export function walkTree(
  config: Config,
  visitor: TreeVisitor,
): CopyRow[] {
  const rows: CopyRow[] = [];
  const workspace = path.normalize(config.workspace.replace(/[/\\]+$/, ""));

  const walk = (
    nodes: TreeNode[],
    parentDir: string,
    prefixParts: string,
  ) => {
    const lastIdx = nodes.length - 1;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;
      const isLast = i === lastIdx;
      const branch = isLast ? "└── " : "├── ";
      const nextPrefix = prefixParts + (isLast ? "    " : "│   ");
      const name = displayName(node);

      if (node.type === "category") {
        visitor.onEnterDir?.(name, prefixParts, branch, isLast);
        const dirPath = path.join(parentDir, node.name);
        if (node.children.length > 0) {
          walk(node.children, dirPath, nextPrefix);
        }
      } else {
        const dst = path.join(parentDir, node.name);
        const row: CopyRow = { name, resource: node.resource, destination: dst };
        rows.push(row);
        visitor.onFile?.(name, prefixParts, branch, isLast, row);
      }
    }
  };

  walk(config.structure, workspace, "");
  return rows;
}

export function rootLabel(config: Config): string {
  return `${config.workspace.replace(/[/\\]+$/, "")}/`;
}
