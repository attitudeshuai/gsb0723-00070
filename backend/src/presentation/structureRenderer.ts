import { inject, injectable, multiInject } from "inversify";
import type { Config, OutputFormat } from "../domain/types";
import { DI_TYPES } from "../di/types";
import type { IStructureFormatter } from "./structureFormatter";

export interface IStructureRenderer {
  render(config: Config, format: OutputFormat): string;
  supports(format: string): format is OutputFormat;
}

/**
 * 汇聚所有已注册的 IStructureFormatter，按请求的格式分发。
 */
@injectable()
export class StructureRenderer implements IStructureRenderer {
  private readonly byFormat = new Map<OutputFormat, IStructureFormatter>();

  constructor(
    @multiInject(DI_TYPES.StructureFormatter)
    formatters: IStructureFormatter[],
  ) {
    for (const f of formatters) {
      this.byFormat.set(f.format, f);
    }
  }

  supports(format: string): format is OutputFormat {
    return this.byFormat.has(format as OutputFormat);
  }

  render(config: Config, format: OutputFormat): string {
    const formatter = this.byFormat.get(format);
    if (!formatter) {
      throw new Error(`不支持的输出格式：${format}`);
    }
    return formatter.render(config);
  }
}
