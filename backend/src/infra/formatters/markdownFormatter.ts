import { injectable } from "inversify";
import type { Config, MaterialNode, OutputFormat, RunResult, TreeNode } from "../../domain/types";
import type { IFormatter } from "../../domain/formatter";

@injectable()
export class MarkdownFormatter implements IFormatter {
  readonly format: OutputFormat = "markdown";

  render(config: Config, result: RunResult | null): string {
    const lines: string[] = [];

    lines.push(`# 目录结构：${config.workspace.replace(/[/\\]+$/, "")}/`);
    if (config.description) {
      lines.push("");
      lines.push(`> ${config.description}`);
    }
    lines.push("");
    lines.push("## 目录树");
    lines.push("");
    lines.push("```");
    lines.push(this.renderTree(config));
    lines.push("```");

    const materials = this.collectMaterials(config.structure);
    if (materials.length > 0) {
      lines.push("");
      lines.push("## 拷贝说明");
      lines.push("");
      lines.push("| 目标文件名 | 来源路径 | 说明 |");
      lines.push("| --- | --- | --- |");
      for (const m of materials) {
        const desc = m.description ?? "";
        lines.push(`| ${m.name} | ${m.resource} | ${desc} |`);
      }
    }

    if (result) {
      lines.push("");
      lines.push("## 执行报告");
      lines.push("");
      lines.push(`- 创建目录数：${result.createdDirectories.length}`);
      lines.push(`- 拷贝文件数：${result.copiedFiles.length}`);
      lines.push(`- 覆盖文件数：${result.overwrittenFiles.length}`);
      lines.push(`- 跳过文件数：${result.skippedFiles.length}`);
      lines.push(`- 缺失资源数：${result.missingResources.length}`);
      lines.push(`- 错误数：${result.errors.length}`);
    }

    return lines.join("\n") + "\n";
  }

  private renderTree(config: Config): string {
    const treeLines: string[] = [];
    treeLines.push(`${config.workspace.replace(/[/\\]+$/, "")}/`);

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
          treeLines.push(`${prefixParts}${branch}${node.name}`);
        }
      });
    };

    walk(config.structure, "", true);
    return treeLines.join("\n");
  }

  private collectMaterials(nodes: TreeNode[]): MaterialNode[] {
    const materials: MaterialNode[] = [];
    for (const node of nodes) {
      if (node.type === "category") {
        materials.push(...this.collectMaterials(node.children));
      } else {
        materials.push(node);
      }
    }
    return materials;
  }
}
