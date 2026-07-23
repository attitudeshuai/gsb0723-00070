import type { Config } from "./types";

export interface IResourceChecker {
  check(config: Config): Promise<string[]>;
}
