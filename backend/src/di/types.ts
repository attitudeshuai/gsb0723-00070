export const DI_TYPES = {
  FileSystem: Symbol.for("FileSystem"),
  ConfigLoader: Symbol.for("ConfigLoader"),
  NodeValidator: Symbol.for("NodeValidator"),
  ResourceChecker: Symbol.for("ResourceChecker"),
  GenerateStructureUseCase: Symbol.for("GenerateStructureUseCase"),
  CheckStructureUseCase: Symbol.for("CheckStructureUseCase"),
  RunnerService: Symbol.for("RunnerService"),
  TextFormatter: Symbol.for("TextFormatter"),
  JsonFormatter: Symbol.for("JsonFormatter"),
  MarkdownFormatter: Symbol.for("MarkdownFormatter"),
  ReportRenderer: Symbol.for("ReportRenderer"),
};
