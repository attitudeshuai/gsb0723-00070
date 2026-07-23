import { injectable } from "inversify";
import * as fs from "node:fs/promises";
import type { Config } from "../domain/types";
import { ConfigParseError } from "../domain/errors";

export interface IConfigLoader {
  loadFromFile(path: string): Promise<Config>;
}

@injectable()
export class JsonConfigLoader implements IConfigLoader {
  async loadFromFile(path: string): Promise<Config> {
    let raw: string;
    try {
      raw = await fs.readFile(path, "utf-8");
    } catch (e) {
      throw new ConfigParseError(`无法读取配置文件：${path}`);
    }

    try {
      return JSON.parse(raw) as Config;
    } catch (e) {
      throw new ConfigParseError(`配置文件不是合法 JSON：${path}`);
    }
  }
}

