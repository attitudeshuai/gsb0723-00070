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
import type { IStructureChecker } from "../application/structureChecker";
import { StructureChecker } from "../application/structureChecker";
import type { IOutputFormatter } from "../presentation/outputFormatter";
import { TextTreeFormatter } from "../presentation/textTreeFormatter";
import { JsonStructureFormatter } from "../presentation/jsonStructureFormatter";
import { MarkdownListFormatter } from "../presentation/markdownListFormatter";
import type { IReportRenderer } from "../presentation/reportRenderer";
import { TextReportRenderer } from "../presentation/textReportRenderer";
import { JsonReportRenderer } from "../presentation/jsonReportRenderer";
import { MarkdownReportRenderer } from "../presentation/markdownReportRenderer";
import { DI_TYPES } from "./types";
import type { OutputFormat } from "../domain/types";

export const FORMAT_TEXT: OutputFormat = "text";
export const FORMAT_JSON: OutputFormat = "json";
export const FORMAT_MARKDOWN: OutputFormat = "markdown";

export function buildContainer(): Container {
  const container = new Container({ defaultScope: "Singleton" });

  container.bind<IFileSystem>(DI_TYPES.FileSystem).to(NodeFsFileSystem);
  container.bind<IConfigLoader>(DI_TYPES.ConfigLoader).to(JsonConfigLoader);
  container.bind<INodeValidator>(DI_TYPES.NodeValidator).to(NodeValidator);
  container.bind<IGenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase).to(GenerateStructureUseCase);
  container.bind<IRunnerService>(DI_TYPES.RunnerService).to(RunnerService);
  container.bind<IStructureChecker>(DI_TYPES.StructureChecker).to(StructureChecker);

  container.bind<IOutputFormatter>(DI_TYPES.OutputFormatter).to(TextTreeFormatter).whenNamed(FORMAT_TEXT);
  container.bind<IOutputFormatter>(DI_TYPES.OutputFormatter).to(JsonStructureFormatter).whenNamed(FORMAT_JSON);
  container.bind<IOutputFormatter>(DI_TYPES.OutputFormatter).to(MarkdownListFormatter).whenNamed(FORMAT_MARKDOWN);

  container.bind<IReportRenderer>(DI_TYPES.ReportRenderer).to(TextReportRenderer).whenNamed(FORMAT_TEXT);
  container.bind<IReportRenderer>(DI_TYPES.ReportRenderer).to(JsonReportRenderer).whenNamed(FORMAT_JSON);
  container.bind<IReportRenderer>(DI_TYPES.ReportRenderer).to(MarkdownReportRenderer).whenNamed(FORMAT_MARKDOWN);

  return container;
}
