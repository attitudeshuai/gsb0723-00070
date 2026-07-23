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
import type { ICheckResourcesUseCase } from "../application/checkResourcesUseCase";
import { CheckResourcesUseCase } from "../application/checkResourcesUseCase";
import type { IRunnerService } from "../application/runnerService";
import { RunnerService } from "../application/runnerService";
import type { IStructureFormatter } from "../presentation/structureFormatter";
import {
  JsonStructureFormatter,
  MarkdownStructureFormatter,
  TextStructureFormatter,
} from "../presentation/structureFormatter";
import type { IStructureRenderer } from "../presentation/structureRenderer";
import { StructureRenderer } from "../presentation/structureRenderer";
import type { IReporter } from "../presentation/reporter";
import { Reporter } from "../presentation/reporter";
import { DI_TYPES } from "./types";

export function buildContainer(): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container.bind<IFileSystem>(DI_TYPES.FileSystem).to(NodeFsFileSystem);
  container.bind<IConfigLoader>(DI_TYPES.ConfigLoader).to(JsonConfigLoader);
  container.bind<INodeValidator>(DI_TYPES.NodeValidator).to(NodeValidator);
  container.bind<IGenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase).to(GenerateStructureUseCase);
  container.bind<ICheckResourcesUseCase>(DI_TYPES.CheckResourcesUseCase).to(CheckResourcesUseCase);
  container.bind<IRunnerService>(DI_TYPES.RunnerService).to(RunnerService);

  container.bind<IStructureFormatter>(DI_TYPES.StructureFormatter).to(TextStructureFormatter);
  container.bind<IStructureFormatter>(DI_TYPES.StructureFormatter).to(JsonStructureFormatter);
  container.bind<IStructureFormatter>(DI_TYPES.StructureFormatter).to(MarkdownStructureFormatter);
  container.bind<IStructureRenderer>(DI_TYPES.StructureRenderer).to(StructureRenderer);
  container.bind<IReporter>(DI_TYPES.Reporter).to(Reporter);

  return container;
}
