import { injectable } from "inversify";
import type { CliMode, RunResult } from "../domain/types";
import type { IReportRenderer } from "../domain/reporter";

@injectable()
export class TextReportRenderer implements IReportRenderer {
  render(mode: CliMode, result: RunResult): string {
    const lines: string[] = [];
    const modeLabel = mode === "execute" ? "执行" : mode === "check" ? "检查" : "预览";

    lines.push("");
    lines.push(`===== ${modeLabel}报告 =====`);
    lines.push(`创建目录数：${result.createdDirectories.length}`);
    lines.push(`拷贝文件数：${result.copiedFiles.length}`);
    lines.push(`覆盖文件数：${result.overwrittenFiles.length}`);
    lines.push(`跳过文件数：${result.skippedFiles.length}`);
    lines.push(`缺失资源数：${result.missingResources.length}`);
    lines.push(`错误数：${result.errors.length}`);

    if (result.missingResources.length > 0) {
      lines.push("");
      lines.push("缺失资源：");
      for (const r of result.missingResources) {
        lines.push(`  - ${r}`);
      }
    }

    if (result.errors.length > 0) {
      lines.push("");
      lines.push("错误：");
      for (const e of result.errors) {
        const loc = e.nodePath ? ` [${e.nodePath}]` : "";
        lines.push(`  - [${e.code}]${loc} ${e.message}`);
      }
    }

    if (result.skippedFiles.length > 0) {
      lines.push("");
      lines.push("跳过文件：");
      for (const s of result.skippedFiles) {
        lines.push(`  - ${s.dst}（${s.reason}）`);
      }
    }

    if (result.overwrittenFiles.length > 0) {
      lines.push("");
      lines.push("覆盖文件：");
      for (const o of result.overwrittenFiles) {
        lines.push(`  - ${o.dst}（来自 ${o.src}）`);
      }
    }

    return lines.join("\n") + "\n";
  }
}
