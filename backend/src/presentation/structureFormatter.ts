import { injectable } from "inversify";
import type { Config, OutputFormat, TreeNode } from "../domain/types";

/**
 * 结构格式化器：将配置渲染为特定输出格式的文本。
 * 每个实现声明自己负责的 format，由 StructureRenderer 按需选择。
 */
export interface IStructureFormatter {
  readonly format: OutputFormat;
  render(config: Config): string;
}

interface CopyNote {
  name: string;
  resource: string;
}

function stripTrailingSep(p: string): string {
  return p.replace(/[/\\]+$/, "");
}

function resourceFileName(node: { resource: string; name: string }): string {
  return node.resource.split(/[/\\]/).pop() || node.name;
}

/**
 * 现有文本目录树格式（保持与升级前完全一致的输出）。
 */
@injectable()
export class TextStructureFormatter implements IStructureFormatter {
  readonly format: OutputFormat = "text";

  render(config: Config): string {
    const lines: string[] = [];
    const copyNotes: string[] = [];
    lines.push(`${stripTrailingSep(config.workspace)}/`);

    const walk = (nodes: TreeNode[], prefixParts: string, isRoot: boolean) => {
      const lastIdx = nodes.length - 1;
      nodes.forEach((node, idx) => {
        const isLast = idx === lastIdx;
        const branch = isRoot ? "└── " : isLast ? "└── " : "├── ";
        const nextPrefix = isRoot ? "" : prefixParts + (isLast ? "    " : "│   ");

        if (node.type === "category") {
          lines.push(`${prefixParts}${branch}${node.name}/`);
          if (node.children.length > 0) {
            walk(node.children, nextPrefix, false);
          }
        } else {
          const fileName = resourceFileName(node);
          lines.push(`${prefixParts}${branch}${fileName}`);
          copyNotes.push(`${fileName}从${node.resource}拷贝`);
        }
      });
    };

    walk(config.structure, "", true);
    if (copyNotes.length > 0) {
      lines.push("");
      lines.push(copyNotes.join("，"));
    }
    return lines.join("\n") + "\n";
  }
}

/**
 * JSON 结构格式：输出规范化后的结构树。
 */
@injectable()
export class JsonStructureFormatter implements IStructureFormatter {
  readonly format: OutputFormat = "json";

  render(config: Config): string {
    const payload = {
      workspace: stripTrailingSep(config.workspace),
      structure: config.structure,
    };
    return JSON.stringify(payload, null, 2) + "\n";
  }
}

/**
 * Markdown 清单：包含目录树代码块与拷贝说明表格。
 */
@injectable()
export class MarkdownStructureFormatter implements IStructureFormatter {
  readonly format: OutputFormat = "markdown";

  render(config: Config): string {
    const treeLines: string[] = [];
    const copies: CopyNote[] = [];
    treeLines.push(`${stripTrailingSep(config.workspace)}/`);

    const walk = (nodes: TreeNode[], prefixParts: string, isRoot: boolean) => {
      const lastIdx = nodes.length - 1;
      nodes.forEach((node, idx) => {
        const isLast = idx === lastIdx;
        const branch = isRoot ? "└── " : isLast ? "└── " : "├── ";
        const nextPrefix = isRoot ? "" : prefixParts + (isLast ? "    " : "│   ");

        if (node.type === "category") {
          treeLines.push(`${prefixParts}${branch}${node.name}/`);
          if (node.children.length > 0) {
            walk(node.children, nextPrefix, false);
          }
        } else {
          const fileName = resourceFileName(node);
          treeLines.push(`${prefixParts}${branch}${fileName}`);
          copies.push({ name: fileName, resource: node.resource });
        }
      });
    };

    walk(config.structure, "", true);

    const out: string[] = [];
    out.push("# 目录结构清单");
    out.push("");
    if (config.description) {
      out.push(config.description);
      out.push("");
    }
    out.push("## 目录树");
    out.push("");
    out.push("```");
    out.push(...treeLines);
    out.push("```");
    out.push("");
    out.push("## 拷贝说明");
    out.push("");
    if (copies.length > 0) {
      out.push("| 文件 | 来源 |");
      out.push("| --- | --- |");
      for (const c of copies) {
        out.push(`| ${c.name} | ${c.resource} |`);
      }
    } else {
      out.push("（无拷贝文件）");
    }
    out.push("");
    return out.join("\n");
  }
}
