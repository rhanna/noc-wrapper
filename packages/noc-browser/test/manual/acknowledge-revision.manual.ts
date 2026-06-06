import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config as loadDotenv } from "dotenv";
import {
  NocBrowser,
  type NocRevisionActivityRaw,
  type NocRevisionDayRaw,
} from "../../src/index.js";

interface RevisionSectionSummary {
  readonly header: string;
  readonly rows: readonly NocRevisionActivityRaw[];
}

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

for (const path of [".env.test.local", ".env.test", ".env"]) {
  loadDotenv({ path, override: false, quiet: true });
}

await main();

async function main(): Promise<void> {
  assert.equal(
    process.env.NOC_ACK_REVISION,
    "interactive",
    "Set NOC_ACK_REVISION=interactive to run this destructive manual test.",
  );
  assert.ok(process.env.NOC_USERNAME, "NOC_USERNAME is required");
  assert.ok(process.env.NOC_PASSWORD, "NOC_PASSWORD is required");

  const browser = new NocBrowser({
    baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
  });

  await browser.authenticate(process.env.NOC_USERNAME, process.env.NOC_PASSWORD);

  const revision = await browser.getRevision();
  const changedDays = revision.days.filter((day) => getRevisionSections(day).length > 0);
  const firstChangedDay = changedDays[0];
  const firstSection = firstChangedDay ? getRevisionSections(firstChangedDay)[0] : undefined;
  const firstActivity = firstSection?.rows[0];

  assert.match(revision.currentUrl, /HumanResourceMyRevision\.aspx/);
  assert.equal(revision.revisionAckRequired, true);
  assert.ok(changedDays.length > 0, "Expected at least one changed revision day");
  assert.ok(firstChangedDay?.date, "Expected first changed day to have a date");
  assert.ok(firstSection, "Expected at least one revision section");
  assert.ok(firstSection.rows.length > 0, "Expected section rows");
  assert.ok(firstActivity, "Expected first activity row");
  assert.ok(Object.keys(firstActivity).length > 0, "Expected activity fields");

  printRevisionSummary(revision.currentUrl, changedDays);

  const answer = await promptForConfirm();

  assert.equal(
    answer,
    "confirm",
    'Revision acknowledgement aborted; expected exact input "confirm".',
  );

  const confirmResult = await browser.confirmRevision();

  assert.equal(confirmResult.confirmed, true);
  assert.equal(confirmResult.revisionAckRequired, false);
  assert.equal(await browser.hasRevisionAckRequired(), false);
  console.log("\nRevision acknowledgement confirmed and cleared.");
}

async function promptForConfirm(): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    return (await rl.question('\nType "confirm" to acknowledge this live revision: ')).trim();
  } finally {
    rl.close();
  }
}

function printRevisionSummary(currentUrl: string, changedDays: readonly NocRevisionDayRaw[]): void {
  console.log("\nLive My Revision change detected");
  console.log(`URL: ${currentUrl}`);
  console.log(`Changed days: ${changedDays.length}`);

  changedDays.forEach((day, dayIndex) => {
    const sections = getRevisionSections(day);

    console.log(`\nDay ${dayIndex + 1}: ${day.date}`);
    console.log(`Sections: ${sections.length}`);

    if (day.notes.length > 0) {
      console.log("Day notes:");
      day.notes.forEach((note, noteIndex) => {
        console.log(`  ${noteIndex + 1}. ${note}`);
      });
    }

    sections.forEach((section) => {
      console.log(`\n  ${section.header || "(unsectioned)"} rows: ${section.rows.length}`);
      section.rows.forEach((activity, activityIndex) => {
        printActivity(activity, activityIndex);
      });
    });
  });
}

function printActivity(activity: NocRevisionActivityRaw, activityIndex: number): void {
  console.log(`\n    Activity ${activityIndex + 1}`);
  console.log(indent(JSON.stringify(activity, null, 2), "      "));
}

function getRevisionSections(day: NocRevisionDayRaw): readonly RevisionSectionSummary[] {
  const sections: RevisionSectionSummary[] = [];

  for (const [header, value] of Object.entries(day)) {
    if (header !== "date" && header !== "notes" && isActivityRows(value)) {
      sections.push({ header, rows: value });
    }
  }

  return sections;
}

function isActivityRows(value: unknown): value is readonly NocRevisionActivityRaw[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((row) => typeof row === "object" && row !== null && !Array.isArray(row))
  );
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}
