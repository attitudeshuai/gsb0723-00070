import type { CliMode, RunResult } from "./types";

export interface IReportRenderer {
  render(mode: CliMode, result: RunResult): string;
}
