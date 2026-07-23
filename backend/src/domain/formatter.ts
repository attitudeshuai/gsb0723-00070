import type { Config, OutputFormat, RunResult } from "./types";

export interface IFormatter {
  readonly format: OutputFormat;
  render(config: Config, result: RunResult | null): string;
}
