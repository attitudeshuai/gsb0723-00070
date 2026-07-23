import { injectable } from "inversify";
import type {
  ErrorRecord,
  MissingResource,
} from "../domain/types";
import type { FormatContext, IOutputFormatter } from "./outputFormatter";
import { rootLabel, walkTree } from "./treeWalker";

function renderErrors(errors: ErrorRecord[]): string[] {
  const out: string[] = [];
  out.push("## 校验错误");
  out.push("");
  if (errors.length === 0) {
    out.push("_无_");
  } else {
    out.push("| 代码 | 路径 | 消息 |");
    out.push("| --- | --- | --- |");
    for (const e of errors) {
      const path = e.nodePath ?? "";
      out.push(`| ${e.code} | ${path} | ${e.message} |`);
    }
  }
  out.push("");
  return out;
}

function renderMissing(missing: MissingResource[]): string[] {
  const out: string[] = [];
  out.push("## 缺失/不可读资源");
  out.push("");
  if (missing.length === 0) {
    out.push("_无_");
  } else {
    out.push("| 资源路径 | 原因 | 节点路径 |");
    out.push("| --- | --- | --- |");
    for (const m of missing) {
      const label = m.reason === "not_found" ? "不存在" : "不可读";
      out.push(`| ${m.resource} | ${label} | ${m.nodePath ?? ""} |`);
    }
  }
  out.push("");
  return out;
}

@injectable()
export class MarkdownListFormatter implements IOutputFormatter {
  format(ctx: FormatContext): string {
    const lines: string[] = [];

    if (ctx.validationErrors.length > 0) {
      lines.push(...renderErrors(ctx.validationErrors));
      return lines.join("\n") + "\n";
    }

    if (ctx.mode === "check" && ctx.checkResult) {
      lines.push("# 检查结果");
      lines.push("");
      lines.push(...renderErrors(ctx.checkResult.validationErrors));
      lines.push(...renderMissing(ctx.checkResult.missingResources));
      return lines.join("\n") + "\n";
    }

    if (!ctx.config) {
      return "";
    }

    lines.push(`# 目录结构清单：${ctx.config.workspace}`);
    lines.push("");
    if (ctx.config.description) {
      lines.push(`> ${ctx.config.description}`);
      lines.push("");
    }

    lines.push("## 目录树");
    lines.push("");
    lines.push("```text");
    lines.push(rootLabel(ctx.config));
    walkTree(ctx.config, {
      onEnterDir: (name, prefix, branch) => {
        lines.push(`${prefix}${branch}${name}/`);
      },
      onFile: (name, prefix, branch) => {
        lines.push(`${prefix}${branch}${name}`);
      },
    });
    lines.push("```");
    lines.push("");

    const rows = walkTree(ctx.config, {});
    lines.push("## 拷贝清单");
    lines.push("");
    if (rows.length === 0) {
      lines.push("_无需拷贝的物料_");
    } else {
      lines.push("| 名称 | 来源 | 目标 |");
      lines.push("| --- | --- | --- |");
      for (const r of rows) {
        lines.push(`| ${r.name} | ${r.resource} | ${r.destination} |`);
      }
    }
    lines.push("");
    return lines.join("\n") + "\n";
  }
}
