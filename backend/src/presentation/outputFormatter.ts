import type {
  CheckResult,
  Config,
  ErrorRecord,
  RunMode,
  RunResult,
} from "../domain/types";

export interface FormatContext {
  mode: RunMode;
  config: Config | null;
  validationErrors: ErrorRecord[];
  checkResult?: CheckResult;
  runResult?: RunResult;
}

export interface IOutputFormatter {
  format(ctx: FormatContext): string;
}
