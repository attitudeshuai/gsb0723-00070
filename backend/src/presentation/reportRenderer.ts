import type { ReportSummary } from "../domain/types";

export interface IReportRenderer {
  render(summary: ReportSummary): string;
}
