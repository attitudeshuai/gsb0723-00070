import "reflect-metadata";
import { Container } from "inversify";
import type { INodeValidator } from "../domain/validator";
import { NodeValidator } from "../domain/validator";
import type { IFileSystem } from "../infra/fileSystem";
import { NodeFsFileSystem } from "../infra/nodeFsFileSystem";
import type { IConfigLoader } from "../infra/configLoader";
import { JsonConfigLoader } from "../infra/configLoader";
import type { IGenerateStructureUseCase } from "../application/generateStructureUseCase";
import { GenerateStructureUseCase } from "../application/generateStructureUseCase";
import type { IRunnerService } from "../application/runnerService";
import { RunnerService } from "../application/runnerService";
import { DI_TYPES } from "./types";

export function buildContainer(): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container.bind<IFileSystem>(DI_TYPES.FileSystem).to(NodeFsFileSystem);
  container.bind<IConfigLoader>(DI_TYPES.ConfigLoader).to(JsonConfigLoader);
  container.bind<INodeValidator>(DI_TYPES.NodeValidator).to(NodeValidator);
  container.bind<IGenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase).to(GenerateStructureUseCase);
  container.bind<IRunnerService>(DI_TYPES.RunnerService).to(RunnerService);

  return container;
}

