import { injectable } from "inversify";
import type {
  CheckResult,
  RunReport,
  RunResult,
} from "../domain/types";

export interface IReporter {
  /** 由执行结果构建汇总报告。 */
  fromRunResult(result: RunResult): RunReport;
  /** 由检查结果构建汇总报告。 */
  fromCheckResult(result: CheckResult): RunReport;
  /** 将报告渲染为可读文本。 */
  format(report: RunReport): string;
}

/**
 * 执行 / 检查报告器：把结果聚合成统一的 RunReport 并渲染文本汇总。
 */
@injectable()
export class Reporter implements IReporter {
  fromRunResult(result: RunResult): RunReport {
    return {
      mode: "execute",
      createdDirectories: result.createdDirectories.length,
      copiedFiles: result.copiedFiles.length,
      skippedFiles: result.skippedFiles.length,
      overwrittenFiles: result.overwrittenFiles.length,
      errors: result.errors.length,
      missingResources: 0,
    };
  }

  fromCheckResult(result: CheckResult): RunReport {
    return {
      mode: "check",
      createdDirectories: 0,
      copiedFiles: 0,
      skippedFiles: 0,
      overwrittenFiles: 0,
      errors: result.validationErrors.length,
      missingResources: result.missingResources.length,
    };
  }

  format(report: RunReport): string {
    const modeLabel =
      report.mode === "execute"
        ? "执行"
        : report.mode === "check"
          ? "检查"
          : "预览";
    const lines: string[] = [];
    lines.push(`===== ${modeLabel}汇总 =====`);
    lines.push(`创建目录数：${report.createdDirectories}`);
    lines.push(`拷贝文件数：${report.copiedFiles}`);
    lines.push(`跳过数：${report.skippedFiles}`);
    lines.push(`覆盖数：${report.overwrittenFiles}`);
    lines.push(`错误数：${report.errors}`);
    lines.push(`缺失资源数：${report.missingResources}`);
    return lines.join("\n") + "\n";
  }
}
