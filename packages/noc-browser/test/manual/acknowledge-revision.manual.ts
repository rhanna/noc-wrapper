import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config as loadDotenv } from "dotenv";
import { NocBrowser, type NocRevisionActivity, type NocRevisionDay } from "../../src/index.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

for (const path of [".env.test.local", ".env.test", ".env"]) {
  loadDotenv({ path, override: false, quiet: true });
}

await main();

async function main(): Promise<void> {
  assert.equal(
    process.env.NOC_ACK_REVISION,
    "interactive",
    'Set NOC_ACK_REVISION=interactive to run this destructive manual test.',
  );
  assert.ok(process.env.NOC_USERNAME, "NOC_USERNAME is required");
  assert.ok(process.env.NOC_PASSWORD, "NOC_PASSWORD is required");

  const browser = new NocBrowser({
    baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
  });

  await browser.authenticate(process.env.NOC_USERNAME, process.env.NOC_PASSWORD);

  const revision = await browser.getRevision();
  const changedDays = revision.days.filter((day) => day.activities.length > 0);
  const firstChangedDay = changedDays[0];
  const firstActivity = firstChangedDay?.activities[0];

  assert.match(revision.currentUrl, /HumanResourceMyRevision\.aspx/);
  assert.equal(revision.revisionAckRequired, true);
  assert.ok(changedDays.length > 0, "Expected at least one changed revision day");
  assert.ok(firstChangedDay?.date, "Expected first changed day to have a date");
  assert.ok(firstChangedDay.revision.length > 0, "Expected revision rows");
  assert.ok(firstChangedDay.current.length > 0, "Expected current rows");
  assert.ok(firstActivity && firstActivity.headers.length > 0, "Expected activity headers");
  assert.ok(firstActivity.values.length > 0, "Expected activity values");
  assert.ok(Object.keys(firstActivity.fields).length > 0, "Expected activity fields");

  printRevisionSummary(revision.currentUrl, changedDays);

  const answer = await promptForConfirm();

  assert.equal(answer, "confirm", 'Revision acknowledgement aborted; expected exact input "confirm".');

  const confirmResult = await browser.confirmRevision();

  assert.equal(confirmResult.confirmed, true);
  assert.equal(confirmResult.revisionAckRequired, false);
  assert.equal(await browser.hasRevisionAckRequired(), false);
  console.log("\nRevision acknowledgement confirmed and cleared.");
}

async function promptForConfirm(): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    return (
      await rl.question('\nType "confirm" to acknowledge this live revision: ')
    ).trim();
  } finally {
    rl.close();
  }
}

function printRevisionSummary(
  currentUrl: string,
  changedDays: readonly NocRevisionDay[],
): void {
  console.log("\nLive My Revision change detected");
  console.log(`URL: ${currentUrl}`);
  console.log(`Changed days: ${changedDays.length}`);

  changedDays.forEach((day, dayIndex) => {
    console.log(`\nDay ${dayIndex + 1}: ${day.date}`);
    console.log(`Revision rows: ${day.revision.length}`);
    console.log(`Current rows: ${day.current.length}`);

    if (day.notes.length > 0) {
      console.log("Day notes:");
      day.notes.forEach((note, noteIndex) => {
        console.log(`  ${noteIndex + 1}. ${note}`);
      });
    }

    day.activities.forEach((activity, activityIndex) => {
      printActivity(activity, activityIndex);
    });
  });
}

function printActivity(activity: NocRevisionActivity, activityIndex: number): void {
  console.log(`\n  Activity ${activityIndex + 1}`);
  console.log(`  Section: ${activity.section ?? "(unknown)"}`);
  console.log(`  Section header: ${activity.sectionHeader ?? "(none)"}`);
  console.log(`  Headers: ${JSON.stringify(activity.headers)}`);
  console.log(`  Values: ${JSON.stringify(activity.values)}`);
  console.log("  Fields:");
  console.log(indent(JSON.stringify(activity.fields, null, 2), "    "));

  if (activity.notes.length > 0) {
    console.log("  Notes:");
    activity.notes.forEach((note, noteIndex) => {
      console.log(`    ${noteIndex + 1}. ${note}`);
    });
  }
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}
