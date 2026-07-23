import { inject, injectable } from "inversify";
import type { Config, RunOptions, RunResult } from "../domain/types";
import type { IConfigLoader } from "../infra/configLoader";
import type { IGenerateStructureUseCase } from "./generateStructureUseCase";
import { DI_TYPES } from "../di/types";

export interface IRunnerService {
  loadAndRun(configPath: string, options?: RunOptions): Promise<RunResult>;
  runWithConfig(config: Config, options?: RunOptions): Promise<RunResult>;
}

@injectable()
export class RunnerService implements IRunnerService {
  constructor(
    @inject(DI_TYPES.ConfigLoader) private readonly loader: IConfigLoader,
    @inject(DI_TYPES.GenerateStructureUseCase) private readonly useCase: IGenerateStructureUseCase,
  ) {}

  async loadAndRun(configPath: string, options?: RunOptions): Promise<RunResult> {
    const config = await this.loader.loadFromFile(configPath);
    return this.useCase.run(config, options);
  }

  async runWithConfig(config: Config, options?: RunOptions): Promise<RunResult> {
    return this.useCase.run(config, options);
  }
}

