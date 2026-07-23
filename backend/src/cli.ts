import { runCli } from "./cliMain";

runCli(process.argv)
  .then(({ exitCode }) => process.exit(exitCode))
  .catch(() => process.exit(1));

