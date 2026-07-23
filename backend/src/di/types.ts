export const DI_TYPES = {
  FileSystem: Symbol.for("FileSystem"),
  ConfigLoader: Symbol.for("ConfigLoader"),
  NodeValidator: Symbol.for("NodeValidator"),
  GenerateStructureUseCase: Symbol.for("GenerateStructureUseCase"),
  RunnerService: Symbol.for("RunnerService"),
  StructureChecker: Symbol.for("StructureChecker"),
  OutputFormatter: Symbol.for("OutputFormatter"),
  ReportRenderer: Symbol.for("ReportRenderer"),
} as const;
