import { injectable } from "inversify";
import type { ReportSummary } from "../domain/types";
import type { IReportRenderer } from "./reportRenderer";

const MODE_LABEL: Record<ReportSummary["mode"], string> = {
  preview: "预览",
  check: "检查",
  execute: "执行",
};

@injectable()
export class TextReportRenderer implements IReportRenderer {
  render(summary: ReportSummary): string {
    const lines: string[] = [];
    lines.push("==== 报告 ====");
    lines.push(`模式: ${MODE_LABEL[summary.mode]}`);
    lines.push(`格式: ${summary.format}`);
    lines.push(`工作区: ${summary.workspace}`);
    lines.push(`创建目录: ${summary.createdDirectories}`);
    lines.push(`拷贝文件: ${summary.copiedFiles}`);
    lines.push(`跳过文件: ${summary.skippedFiles}`);
    lines.push(`覆盖文件: ${summary.overwrittenFiles}`);
    lines.push(`缺失资源: ${summary.missingResources}`);
    lines.push(`错误: ${summary.errors}`);
    lines.push(`耗时: ${summary.elapsedMs}ms`);

    if (summary.missingList.length > 0) {
      lines.push("缺失资源列表:");
      for (const m of summary.missingList) {
        const where = m.nodePath ? ` (${m.nodePath})` : "";
        const label = m.reason === "not_found" ? "不存在" : "不可读";
        lines.push(`  - ${m.resource}${where}: ${label}`);
      }
    }
    if (summary.errorList.length > 0) {
      lines.push("错误列表:");
      for (const e of summary.errorList) {
        const where = e.nodePath ? ` (${e.nodePath})` : "";
        lines.push(`  - [${e.code}]${where} ${e.message}`);
      }
    }
    return lines.join("\n") + "\n";
  }
}
