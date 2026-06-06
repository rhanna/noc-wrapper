export interface CliOptions {
  readonly command?: string;
  readonly flags: Readonly<Record<string, string | boolean>>;
}

export interface HelpCommandSpec {
  readonly description: string;
}

export function parseArgs(args: readonly string[]): CliOptions {
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (!arg.startsWith("-")) {
      command ??= arg;
      continue;
    }

    const trimmed = arg.replace(/^-+/, "");
    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex >= 0) {
      flags[trimmed.slice(0, equalsIndex)] = trimmed.slice(equalsIndex + 1);
      continue;
    }

    const next = args[index + 1];

    if (next && !next.startsWith("-")) {
      flags[trimmed] = next;
      index += 1;
    } else {
      flags[trimmed] = true;
    }
  }

  return { command, flags };
}

export function readString(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): string | undefined {
  const value = flags[name];

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return undefined;
}

export function requireString(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): string {
  const value = readString(flags, name);

  if (!value) {
    throw new Error(`Missing required option --${name}`);
  }

  return value;
}

export function readBoolean(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): boolean | undefined {
  const value = flags[name];

  if (value === undefined) {
    return undefined;
  }

  if (value === true) {
    return true;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  throw new Error(`Option --${name} must be true or false`);
}

export function readOptionalString(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): string | undefined {
  return readString(flags, name);
}

export function readOptionalInteger(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): number | undefined {
  const value = readString(flags, name);
  return value === undefined ? undefined : parseInteger(value, name);
}

export function requireInteger(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): number {
  return parseInteger(requireString(flags, name), name);
}

export function parseInteger(value: string, name: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Option --${name} must be an integer`);
  }

  return parsed;
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printHelp(options: {
  readonly executable: string;
  readonly globalOptions?: readonly string[];
  readonly commands: Readonly<Record<string, HelpCommandSpec>>;
}): void {
  const commandEntries = Object.entries(options.commands);
  const globalOptions =
    options.globalOptions === undefined || options.globalOptions.length === 0
      ? ""
      : `
Global options:
${options.globalOptions.join("\n")}
`;

  console.log(`Usage: ${options.executable} <command> [options]
${globalOptions}
Commands:
${commandEntries.length === 0 ? "  (none yet)" : commandEntries.map(([name, command]) => `  ${name.padEnd(29)} ${command.description}`).join("\n")}
`);
}

export function printCliError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`${error.name}: ${error.message}`);
  } else {
    console.error(String(error));
  }
}
