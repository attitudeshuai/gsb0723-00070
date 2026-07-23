import { injectable } from "inversify";
import type { ReportSummary } from "../domain/types";
import type { IReportRenderer } from "./reportRenderer";

@injectable()
export class JsonReportRenderer implements IReportRenderer {
  render(summary: ReportSummary): string {
    return JSON.stringify({ report: summary }, null, 2) + "\n";
  }
}
