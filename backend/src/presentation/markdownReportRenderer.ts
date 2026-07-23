import { injectable } from "inversify";
import type { ReportSummary } from "../domain/types";
import type { IReportRenderer } from "./reportRenderer";

const MODE_LABEL: Record<ReportSummary["mode"], string> = {
  preview: "预览",
  check: "检查",
  execute: "执行",
};

@injectable()
export class MarkdownReportRenderer implements IReportRenderer {
  render(summary: ReportSummary): string {
    const lines: string[] = [];
    lines.push("## 执行报告");
    lines.push("");
    lines.push("| 指标 | 值 |");
    lines.push("| --- | --- |");
    lines.push(`| 模式 | ${MODE_LABEL[summary.mode]} |`);
    lines.push(`| 格式 | ${summary.format} |`);
    lines.push(`| 工作区 | ${summary.workspace} |`);
    lines.push(`| 创建目录 | ${summary.createdDirectories} |`);
    lines.push(`| 拷贝文件 | ${summary.copiedFiles} |`);
    lines.push(`| 跳过文件 | ${summary.skippedFiles} |`);
    lines.push(`| 覆盖文件 | ${summary.overwrittenFiles} |`);
    lines.push(`| 缺失资源 | ${summary.missingResources} |`);
    lines.push(`| 错误 | ${summary.errors} |`);
    lines.push(`| 耗时 | ${summary.elapsedMs}ms |`);
    lines.push("");

    if (summary.missingList.length > 0) {
      lines.push("### 缺失资源");
      lines.push("");
      lines.push("| 资源 | 原因 | 节点路径 |");
      lines.push("| --- | --- | --- |");
      for (const m of summary.missingList) {
        const label = m.reason === "not_found" ? "不存在" : "不可读";
        lines.push(`| ${m.resource} | ${label} | ${m.nodePath ?? ""} |`);
      }
      lines.push("");
    }
    if (summary.errorList.length > 0) {
      lines.push("### 错误");
      lines.push("");
      lines.push("| 代码 | 路径 | 消息 |");
      lines.push("| --- | --- | --- |");
      for (const e of summary.errorList) {
        lines.push(`| ${e.code} | ${e.nodePath ?? ""} | ${e.message} |`);
      }
      lines.push("");
    }
    return lines.join("\n") + "\n";
  }
}
