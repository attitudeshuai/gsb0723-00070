import { inject, injectable } from "inversify";
import type { Config, RunResult } from "../domain/types";
import type { INodeValidator } from "../domain/validator";
import type { IResourceChecker } from "../domain/checker";
import { DI_TYPES } from "../di/types";

export interface ICheckStructureUseCase {
  run(config: Config): Promise<RunResult>;
}

function emptyResult(): RunResult {
  return {
    createdDirectories: [],
    copiedFiles: [],
    overwrittenFiles: [],
    skippedFiles: [],
    missingResources: [],
    errors: [],
  };
}

@injectable()
export class CheckStructureUseCase implements ICheckStructureUseCase {
  constructor(
    @inject(DI_TYPES.NodeValidator) private readonly validator: INodeValidator,
    @inject(DI_TYPES.ResourceChecker) private readonly resourceChecker: IResourceChecker,
  ) {}

  async run(config: Config): Promise<RunResult> {
    const result = emptyResult();
    const validationErrors = this.validator.validate(config);
    if (validationErrors.length > 0) {
      result.errors.push(...validationErrors);
    }

    const missing = await this.resourceChecker.check(config);
    result.missingResources.push(...missing);

    return result;
  }
}
