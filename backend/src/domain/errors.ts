export class ConfigParseError extends Error {
  override name = "ConfigParseError";

  constructor(message: string) {
    super(message);
  }
}

