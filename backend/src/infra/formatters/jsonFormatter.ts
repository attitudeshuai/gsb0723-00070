import { injectable } from "inversify";
import type { Config, OutputFormat, RunResult } from "../../domain/types";
import type { IFormatter } from "../../domain/formatter";

@injectable()
export class JsonFormatter implements IFormatter {
  readonly format: OutputFormat = "json";

  render(config: Config, result: RunResult | null): string {
    const output: Record<string, unknown> = {
      workspace: config.workspace,
      description: config.description,
      structure: config.structure,
    };
    if (result) {
      output.report = {
        createdDirectories: result.createdDirectories.length,
        copiedFiles: result.copiedFiles.length,
        overwrittenFiles: result.overwrittenFiles.length,
        skippedFiles: result.skippedFiles.length,
        missingResources: result.missingResources.length,
        errors: result.errors.length,
        details: {
          createdDirectories: result.createdDirectories,
          copiedFiles: result.copiedFiles,
          overwrittenFiles: result.overwrittenFiles,
          skippedFiles: result.skippedFiles,
          missingResources: result.missingResources,
          errors: result.errors,
        },
      };
    }
    return JSON.stringify(output, null, 2) + "\n";
  }
}
