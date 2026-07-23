import "reflect-metadata";
import { Container } from "inversify";
import type { INodeValidator } from "../domain/validator";
import { NodeValidator } from "../domain/validator";
import type { IFileSystem } from "../infra/fileSystem";
import { NodeFsFileSystem } from "../infra/nodeFsFileSystem";
import type { IConfigLoader } from "../infra/configLoader";
import { JsonConfigLoader } from "../infra/configLoader";
import type { IResourceChecker } from "../domain/checker";
import { ResourceChecker } from "../infra/resourceChecker";
import type { IGenerateStructureUseCase } from "../application/generateStructureUseCase";
import { GenerateStructureUseCase } from "../application/generateStructureUseCase";
import type { ICheckStructureUseCase } from "../application/checkStructureUseCase";
import { CheckStructureUseCase } from "../application/checkStructureUseCase";
import type { IRunnerService } from "../application/runnerService";
import { RunnerService } from "../application/runnerService";
import type { IFormatter } from "../domain/formatter";
import { TextFormatter } from "../infra/formatters/textFormatter";
import { JsonFormatter } from "../infra/formatters/jsonFormatter";
import { MarkdownFormatter } from "../infra/formatters/markdownFormatter";
import type { IReportRenderer } from "../domain/reporter";
import { TextReportRenderer } from "../infra/reportRenderer";
import { DI_TYPES } from "./types";

export function buildContainer(): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container.bind<IFileSystem>(DI_TYPES.FileSystem).to(NodeFsFileSystem);
  container.bind<IConfigLoader>(DI_TYPES.ConfigLoader).to(JsonConfigLoader);
  container.bind<INodeValidator>(DI_TYPES.NodeValidator).to(NodeValidator);
  container.bind<IResourceChecker>(DI_TYPES.ResourceChecker).to(ResourceChecker);
  container.bind<IGenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase).to(GenerateStructureUseCase);
  container.bind<ICheckStructureUseCase>(DI_TYPES.CheckStructureUseCase).to(CheckStructureUseCase);
  container.bind<IRunnerService>(DI_TYPES.RunnerService).to(RunnerService);
  container.bind<IFormatter>(DI_TYPES.TextFormatter).to(TextFormatter);
  container.bind<IFormatter>(DI_TYPES.JsonFormatter).to(JsonFormatter);
  container.bind<IFormatter>(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);
  container.bind<IReportRenderer>(DI_TYPES.ReportRenderer).to(TextReportRenderer);

  return container;
}
