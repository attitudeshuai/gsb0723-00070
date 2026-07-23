# Material Organizer（配置目录树解析与预览）

## 项目说明

根据 JSON 配置文件中的**分类（category）与物料（material）**结构，输出目标目录树预览及拷贝说明的 CLI 工具。

- **仅预览，不写盘**：CLI **不会**创建目录、**不会**复制文件；仅根据配置输出“若按此配置执行时将生成的目录结构”及“从哪里拷贝到哪”的说明。
- **material 展示**：目录树中物料项使用 `resource` 路径的最后一段文件名展示。
- **拷贝说明**：输出 `文件名从resource路径拷贝`，多个物料用中文逗号 `，` 连接。
- **程序化能力**：应用层提供 `GenerateStructureUseCase` / `RunnerService`，可按配置执行真实的建目录与拷贝（供脚本或其它入口调用）；CLI 入口不调用该执行逻辑。

## 🛠 技术栈
- **Runtime**: Node.js 20
- **Language**: TypeScript 5.9
- **DI Framework**: Inversify 7.11（依赖注入容器）
- **Test Framework**: Jest 30 + ts-jest 29
- **Build Tool**: TypeScript Compiler (tsc)
- **Container**: Docker + Docker Compose

## 📁 项目目录结构

```
material-organizer/
├── backend/                    # 后端代码
│   ├── src/                    # 源代码
│   │   ├── domain/             # 领域层：类型、校验、错误
│   │   ├── application/         # 应用层：用例、服务
│   │   ├── infra/              # 基础设施层：配置加载、文件系统
│   │   ├── di/                  # 依赖注入容器
│   │   └── cli*.ts              # CLI 入口和主逻辑
│   ├── tests/                   # 单元测试
│   ├── Dockerfile              # Docker 镜像构建
│   └── package.json            # 项目配置
├── config/                     # 配置文件目录（挂载到容器）
├── docker-compose.yml          # Docker Compose 配置
└── README.md                   # 项目文档
```

## 🏗️ 技术架构

### 分层架构（Layered Architecture）

项目采用**分层架构**设计，遵循**关注点分离**原则：

1. **Domain Layer（领域层）**
   - 核心业务逻辑和领域模型
   - 类型定义：`Config`, `TreeNode`, `RunResult`, `ErrorRecord`
   - 校验规则：`NodeValidator`（配置校验、同名冲突检测）
   - 错误模型：`ConfigParseError`, `ConfigValidationError`

2. **Application Layer（应用层）**
   - 用例编排：`GenerateStructureUseCase`（配置校验；内含按配置建目录与拷贝文件的逻辑，CLI 不调用执行）
   - 服务封装：`RunnerService`（配置加载；`loadAndRun` / `runWithConfig` 可执行生成，CLI 仅做预览）

3. **Infrastructure Layer（基础设施层）**
   - 外部依赖抽象：`IConfigLoader`（配置加载）、`IFileSystem`（文件系统）
   - 具体实现：`JsonConfigLoader`、`NodeFsFileSystem`

4. **Presentation Layer（表现层）**
   - CLI 入口：`cli.ts`, `cliMain.ts`
   - 参数解析、输出格式化、错误处理

### 依赖注入（Dependency Injection）

使用 **Inversify** 实现依赖注入，实现：
- **解耦**：各层通过接口依赖，不直接依赖具体实现
- **可测试性**：测试时可注入 Mock 实现
- **可扩展性**：易于替换实现（如文件系统、配置加载器）

### 设计模式

- **策略模式**：文件系统、配置加载器通过接口抽象
- **工厂模式**：`buildContainer()` 创建 DI 容器
- **单例模式**：DI 容器使用 Singleton 作用域

## 🚀 启动指南 (How to Run)

### 方式一：使用 Docker（推荐）

1. 确保 Docker Desktop 已启动

2. 在项目根目录执行（容器会保持运行）：

```bash
docker compose up -d --build
```

3. 在宿主机进入容器执行 CLI（仅输出目录树预览，不创建目录、不拷贝文件）：

```bash
docker compose exec backend node dist/cli.js --config /app/config/example-config.json
```

或进入容器交互式终端后执行：

```bash
docker compose exec backend sh
# 在容器内
node dist/cli.js --config /app/config/example-config.json
```

### 方式二：本地开发

1. 进入后端目录：

```bash
cd material-organizer/backend
```

2. 安装依赖：

```bash
npm install
```

3. 编译：

```bash
npm run build
```

4. 运行（传入配置文件路径；仅预览，不写盘）：

```bash
node dist/cli.js --config /path/to/config.json
```

## 🧾 配置文件格式
- `workspace: string`
- `structure: TreeNode[]`
  - `category`: `{ type: "category", name: string, children: TreeNode[] }`
  - `material`: `{ type: "material", name: string, description?: string, resource: string }`

## ✅ 成功输出示例

当配置解析成功且校验通过（无错误）时，stdout 输出目录树文本。以 `config/example-config.json` 为例：

```text
D:/workspace/
└── CategoryA/
    ├── CategoryB/
    ├── c.tcad
    └── c.pdf

c.tcad从d:/tcad/c.tcad拷贝，c.pdf从d:/pdf/c.pdf拷贝
```

## ❌ 错误输出示例
若配置校验失败（例如同一目录层级下 material 重名），stdout 输出 JSON：

```json
{
  "errors": [
    {
      "code": "ConfigValidationError",
      "message": "同一目录层级下存在重名：x",
      "nodePath": "structure[0].children[1].name",
      "details": {
        "name": "x"
      }
    }
  ]
}
```

## 📦 退出码 (Exit Code)

- **0**：解析成功且校验通过，已输出目录树预览（未执行任何创建/拷贝）
- **1**：配置校验失败（stdout 输出 JSON `errors`）或配置文件读取/JSON 解析失败（stderr 输出错误信息）

## 🧪 测试

### 测试策略

项目采用 **单元测试** 为主，覆盖核心业务逻辑：

- **Validator 测试**：配置校验规则、同层级同名冲突检测、错误收集
- **UseCase 测试**：配置校验；结构生成（建目录、拷贝文件、skipIfExists/overwrite）通过 InMemoryFileSystem 断言
- **CLI 测试**：缺少 `--config` 时用法提示；校验通过时目录树输出；校验失败时 JSON errors 与退出码

### 本地测试

```bash
cd material-organizer/backend
npm test
```

### Docker 内测试

```bash
docker compose run --rm backend npm test
```

### 测试覆盖率

运行测试时可通过以下命令查看覆盖率：

```bash
cd material-organizer/backend
npm test -- --coverage
```

## 🐳 Docker 说明

项目已完全容器化，符合开发规范要求：

- **Dockerfile**: 位于 `backend/Dockerfile`，使用 Node.js 20 Alpine 镜像，自动安装依赖并构建项目
- **docker-compose.yml**: 配置了 backend 服务，支持一键启动
- **.dockerignore**: 排除不必要的文件，加速构建

### Docker 服务配置

- **Backend**: 容器内工作目录 `/app`
- **配置文件挂载**: `./config` → `/app/config`（只读），即读取的配置文件需要放置在根目录 `./config` 文件夹里，才能挂载到 docker 容器中读取

### 常用 Docker 命令

```bash
# 构建并启动服务（容器会保持后台运行）
docker compose up --build -d

# 在运行中的容器内执行 CLI 命令
docker compose exec backend node dist/cli.js --config /app/config/example-config.json

# 进入容器的交互式终端
docker compose exec backend sh

# 查看日志
docker compose logs backend

# 查看容器状态
docker compose ps

# 停止并删除容器
docker compose down

# 仅构建镜像（不启动）
docker compose build
```

## 🔧 开发环境要求

- **Node.js**: >= 20.0.0
- **npm**: >= 10.0.0
- **Docker**: >= 20.10.0
- **Docker Compose**: >= 2.0.0

## 📝 许可证

ISC License

## 👥 贡献

欢迎提交 Issue 和 Pull Request。

```
