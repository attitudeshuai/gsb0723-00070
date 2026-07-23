import { injectable } from "inversify";
import type { FormatContext, IOutputFormatter } from "./outputFormatter";
import { rootLabel, walkTree } from "./treeWalker";

@injectable()
export class TextTreeFormatter implements IOutputFormatter {
  format(ctx: FormatContext): string {
    const lines: string[] = [];

    if (ctx.validationErrors.length > 0) {
      lines.push("配置校验失败：");
      for (const e of ctx.validationErrors) {
        const where = e.nodePath ? ` (${e.nodePath})` : "";
        lines.push(`- [${e.code}]${where} ${e.message}`);
      }
      return lines.join("\n") + "\n";
    }

    if (ctx.mode === "check" && ctx.checkResult) {
      const missing = ctx.checkResult.missingResources;
      if (missing.length === 0) {
        lines.push("检查通过：所有资源文件均存在且可读。");
      } else {
        lines.push("发现缺失或不可读的资源文件：");
        for (const m of missing) {
          const where = m.nodePath ? ` (${m.nodePath})` : "";
          const label = m.reason === "not_found" ? "不存在" : "不可读";
          lines.push(`- ${m.resource}${where}：${label}`);
        }
      }
      return lines.join("\n") + "\n";
    }

    if (!ctx.config) {
      return "";
    }

    const copyNotes: string[] = [];
    lines.push(rootLabel(ctx.config));
    walkTree(ctx.config, {
      onEnterDir: (name, prefix, branch) => {
        lines.push(`${prefix}${branch}${name}/`);
      },
      onFile: (name, prefix, branch, _isLast, row) => {
        lines.push(`${prefix}${branch}${name}`);
        copyNotes.push(`${row.name}从${row.resource}拷贝`);
      },
    });
    if (copyNotes.length > 0) {
      lines.push("");
      lines.push(copyNotes.join("，"));
    }
    return lines.join("\n") + "\n";
  }
}
