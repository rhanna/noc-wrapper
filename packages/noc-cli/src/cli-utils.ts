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

export type OutputFormat = "json" | "table" | "csv";

export function parseOutputFormat(value: string, source: string): OutputFormat {
  if (value === "json" || value === "table" || value === "csv") {
    return value;
  }

  throw new Error(`${source} must be json, table, or csv`);
}

export function printFormatted(value: unknown, format: OutputFormat): void {
  if (format === "json") {
    printJson(value);
    return;
  }

  if (format === "csv") {
    console.log(formatCsv(value));
    return;
  }

  console.log(formatTable(value));
}

export function formatCsv(value: unknown): string {
  const table = toOutputTable(value);

  if (table.columns.length === 0) {
    return "";
  }

  return [table.columns, ...table.rows]
    .map((row) => row.map(formatCsvCell).join(","))
    .join("\n");
}

export function formatTable(value: unknown): string {
  const table = toOutputTable(value);

  if (table.columns.length === 0) {
    return "";
  }

  const rows = [table.columns, ...table.rows];
  const widths = table.columns.map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex]?.length ?? 0)),
  );
  const renderRow = (row: readonly string[]) =>
    row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();
  const separator = widths.map((width) => "-".repeat(width)).join("  ");

  return [renderRow(table.columns), separator, ...table.rows.map(renderRow)].join("\n");
}

interface OutputTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

function toOutputTable(value: unknown): OutputTable {
  const rows = toOutputRows(unwrapOutputValue(value));
  const columns = readColumns(rows);

  return {
    columns,
    rows: rows.map((row) => columns.map((column) => formatCell(row[column]))),
  };
}

function unwrapOutputValue(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const entries = Object.entries(value);

  if (entries.length !== 1) {
    return value;
  }

  const nested = entries[0]?.[1];

  if (Array.isArray(nested) || isPlainObject(nested)) {
    return nested;
  }

  return value;
}

function toOutputRows(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      isPlainObject(item) ? item : { value: item, index: index + 1 },
    );
  }

  if (isPlainObject(value)) {
    return [value];
  }

  return [{ value }];
}

function readColumns(rows: readonly Record<string, unknown>[]): readonly string[] {
  const columns: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const column of Object.keys(row)) {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    }
  }

  return columns;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
