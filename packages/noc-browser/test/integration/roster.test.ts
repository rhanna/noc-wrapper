import { describe, expect, it } from "vitest";
import { NocBrowser } from "../../src/index.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";
const CURRENT_USER_PERMISSION_FIELDS = [
  "AllowViewOtherHrRoster",
  "HistoryVisible",
  "ShowActualTimes",
  "AllowUserAddCustomNotes",
  "CanViewStation",
  "CanViewCrewOnBoard",
] as const;
const CREW_ON_BOARD_FIELD_LABELS = [
  "EmpNoLabel",
  "NameLabel",
  "PhoneLabel",
  "EmailLabel",
  "RankLabel",
  "SpecialRolesLabel",
  "SeniorityLabel",
] as const;

describe("Roster integration", () => {
  it.runIf(process.env.NOC_USERNAME && process.env.NOC_PASSWORD)(
    "validates current user, human resources, roster, accumulated values, and crew details contracts",
    async () => {
      const browser = new NocBrowser({
        baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
      });

      const authResult = await browser.authenticate(
        process.env.NOC_USERNAME ?? "",
        process.env.NOC_PASSWORD ?? "",
      );

      if (authResult.revisionAckRequired) {
        expect(authResult.revisionAckDetails?.confirmButtonPresent).toBe(true);
        return;
      }

      const currentUser = await browser.getCurrentUserInfo();
      const currentUserContract = expectCurrentUserContract(currentUser);
      const rosterDate = getCurrentUserRosterDate(currentUser);
      const month = rosterDate.getUTCMonth() + 1;
      const year = rosterDate.getUTCFullYear();

      const humanResources = await browser.getHumanResources();
      expectHumanResourcesContract(humanResources, currentUserContract.hrId);

      const roster = await browser.getRoster({
        month,
        year,
        hrId: currentUserContract.hrId,
      });
      const activityId = expectRosterContract(roster, {
        month,
        year,
        hrId: currentUserContract.hrId,
      });

      const monthlyAccumulatedValues = await browser.getRosterMonthlyAccumulatedValues({
        month,
        year,
        hrId: currentUserContract.hrId,
      });
      expectMonthlyAccumulatedValuesContract(monthlyAccumulatedValues);

      if (activityId !== undefined) {
        const crewDetails = await browser.getCrewOnBoardDetails(activityId);
        expectCrewOnBoardDetailsContract(crewDetails);
      }
    },
  );
});

interface CurrentUserContract {
  readonly hrId: number;
}

interface RosterRequestContract {
  readonly month: number;
  readonly year: number;
  readonly hrId: number;
}

function expectCurrentUserContract(currentUser: unknown): CurrentUserContract {
  const root = expectObject(currentUser, "current user response");
  const info = expectObject(root.Info, "current user Info");
  const currentUserInfo = expectObject(info.CurrentUser, "Info.CurrentUser");

  const hrId = expectPositiveInteger(currentUserInfo.Id, "Info.CurrentUser.Id");
  expectNonEmptyString(currentUserInfo.DisplayName, "Info.CurrentUser.DisplayName");
  expectStringOrNull(currentUserInfo.FirstName, "Info.CurrentUser.FirstName");
  expectStringOrNull(currentUserInfo.LastName, "Info.CurrentUser.LastName");
  expectStringOrNull(currentUserInfo.Status, "Info.CurrentUser.Status");

  for (const field of CURRENT_USER_PERMISSION_FIELDS) {
    if (field in info) {
      expectBoolean(info[field], `Info.${field}`);
    }
  }

  return { hrId };
}

function expectHumanResourcesContract(humanResources: unknown, currentUserHrId: number): void {
  const root = expectObject(humanResources, "human resources response");
  const resources = expectArray(root.HumanResources, "HumanResources");
  expect(resources.length, "HumanResources should include crew members").toBeGreaterThan(0);

  for (const [index, resource] of resources.slice(0, 25).entries()) {
    const crewMember = expectObject(resource, `HumanResources[${index}]`);
    expectPositiveInteger(crewMember.Id, `HumanResources[${index}].Id`);
    expectNonEmptyString(crewMember.DisplayName, `HumanResources[${index}].DisplayName`);
    expectStringOrNull(crewMember.FirstName, `HumanResources[${index}].FirstName`);
    expectStringOrNull(crewMember.LastName, `HumanResources[${index}].LastName`);
    expectStringOrNull(crewMember.Status, `HumanResources[${index}].Status`);
  }

  expect(
    resources.some(
      (resource) =>
        typeof resource === "object" &&
        resource !== null &&
        !Array.isArray(resource) &&
        (resource as Record<string, unknown>).Id === currentUserHrId,
    ),
    "HumanResources should contain the authenticated current user",
  ).toBe(true);
}

function expectRosterContract(roster: unknown, request: RosterRequestContract): number | undefined {
  const root = expectObject(roster, "roster response");
  expectNonEmptyString(root.Username, "Roster Username");
  expect(root.HrId, "Roster HrId should echo the requested hrId").toBe(request.hrId);
  expectIsoDateString(root.Date, "Roster Date");

  const rosterDate = new Date(root.Date as string);
  expect(rosterDate.getUTCMonth() + 1, "Roster Date should match the requested month").toBe(
    request.month,
  );
  expect(rosterDate.getUTCFullYear(), "Roster Date should match the requested year").toBe(
    request.year,
  );

  const rosterBody = expectObject(root.Roster, "Roster");
  const days = expectObject(rosterBody.Days, "Roster.Days");
  expectArray(rosterBody.RosterNotes, "Roster.RosterNotes");

  const dayEntries = Object.entries(days);
  expect(dayEntries.length, "Roster.Days should include one entry per day in the month").toBe(
    daysInUtcMonth(request.month, request.year),
  );

  let activityId: number | undefined;

  for (const [index, [dayKey, day]] of dayEntries.entries()) {
    expectIsoDateString(dayKey, `Roster.Days key ${dayKey}`);
    const parsedDay = new Date(dayKey);
    expect(parsedDay.getUTCMonth() + 1, `${dayKey} should be in requested month`).toBe(
      request.month,
    );
    expect(parsedDay.getUTCFullYear(), `${dayKey} should be in requested year`).toBe(request.year);

    const dayObject = expectRosterDayContract(day, index);
    activityId ??= findFirstActivityId(dayObject);
  }

  return activityId;
}

function expectRosterDayContract(day: unknown, index: number): Record<string, unknown> {
  const dayObject = expectObject(day, `Roster.Days[${index}]`);
  const header = expectObject(dayObject.Header, `Roster.Days[${index}].Header`);
  const details = expectObject(dayObject.Details, `Roster.Days[${index}].Details`);

  expectPositiveInteger(header.DayNumber, `Roster.Days[${index}].Header.DayNumber`);
  expectStringOrNull(header.DayColor, `Roster.Days[${index}].Header.DayColor`);
  expectStringOrNull(header.Color, `Roster.Days[${index}].Header.Color`);
  expectBoolean(header.IsCurrentDay, `Roster.Days[${index}].Header.IsCurrentDay`);
  expectInfoBlock(header.ArrInfo, `Roster.Days[${index}].Header.ArrInfo`);
  expectInfoBlock(header.DepInfo, `Roster.Days[${index}].Header.DepInfo`);
  expectInfoBlock(header.HotelInfo, `Roster.Days[${index}].Header.HotelInfo`);

  expectArray(details.History, `Roster.Days[${index}].Details.History`);
  expectArray(details.Labels, `Roster.Days[${index}].Details.Labels`);
  const activities = expectArray(
    details.ActivityDetails,
    `Roster.Days[${index}].Details.ActivityDetails`,
  );
  expectArray(dayObject.Notes, `Roster.Days[${index}].Notes`);

  for (const [activityIndex, activity] of activities.slice(0, 3).entries()) {
    expectRosterActivityContract(activity, index, activityIndex);
  }

  return dayObject;
}

function expectRosterActivityContract(
  activity: unknown,
  dayIndex: number,
  activityIndex: number,
): void {
  const activityObject = expectObject(
    activity,
    `Roster.Days[${dayIndex}].Details.ActivityDetails[${activityIndex}]`,
  );

  expectPositiveInteger(
    activityObject.Id,
    `Roster.Days[${dayIndex}].Details.ActivityDetails[${activityIndex}].Id`,
  );
  expectStringOrNull(
    activityObject.Activity,
    `Roster.Days[${dayIndex}].Details.ActivityDetails[${activityIndex}].Activity`,
  );
  expectStringOrNull(
    activityObject.Dep,
    `Roster.Days[${dayIndex}].Details.ActivityDetails[${activityIndex}].Dep`,
  );
  expectStringOrNull(
    activityObject.Arr,
    `Roster.Days[${dayIndex}].Details.ActivityDetails[${activityIndex}].Arr`,
  );
  expectStringOrNull(
    activityObject.State,
    `Roster.Days[${dayIndex}].Details.ActivityDetails[${activityIndex}].State`,
  );
}

function expectMonthlyAccumulatedValuesContract(monthlyAccumulatedValues: unknown): void {
  const root = expectObject(monthlyAccumulatedValues, "monthly accumulated values response");
  const values = expectArray(root.AccumulatedValues, "AccumulatedValues");
  expect(values.length, "AccumulatedValues should include rows").toBeGreaterThan(0);

  for (const [index, value] of values.entries()) {
    const valueObject = expectObject(value, `AccumulatedValues[${index}]`);
    expectNonEmptyString(valueObject.Label, `AccumulatedValues[${index}].Label`);
    expectString(valueObject.Value, `AccumulatedValues[${index}].Value`);
  }
}

function expectCrewOnBoardDetailsContract(crewDetails: unknown): void {
  const root = expectObject(crewDetails, "crew-on-board details response");
  const fields = expectObject(root.Fields, "CrewOnBoard Fields");
  const crewList = expectArray(root.CrewOnBoardList, "CrewOnBoardList");

  for (const field of CREW_ON_BOARD_FIELD_LABELS) {
    expectNonEmptyString(fields[field], `Fields.${field}`);
  }

  for (const [index, crewMember] of crewList.slice(0, 10).entries()) {
    const crewMemberObject = expectObject(crewMember, `CrewOnBoardList[${index}]`);
    expectString(crewMemberObject.EmpNo, `CrewOnBoardList[${index}].EmpNo`);
    expectString(crewMemberObject.Name, `CrewOnBoardList[${index}].Name`);
    expectString(crewMemberObject.Phone, `CrewOnBoardList[${index}].Phone`);
    expectString(crewMemberObject.Email, `CrewOnBoardList[${index}].Email`);
    expectString(crewMemberObject.Brq, `CrewOnBoardList[${index}].Brq`);
    expectNumber(crewMemberObject.Seniority, `CrewOnBoardList[${index}].Seniority`);
    expectArray(crewMemberObject.SpecialRoles, `CrewOnBoardList[${index}].SpecialRoles`);
    expectString(crewMemberObject.Image, `CrewOnBoardList[${index}].Image`);
  }
}

function getCurrentUserRosterDate(currentUser: Record<string, unknown>): Date {
  const value = currentUser.date ?? currentUser.Date;
  const date = typeof value === "string" ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function findFirstActivityId(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const activityId = findFirstActivityId(item);

      if (activityId !== undefined) {
        return activityId;
      }
    }

    return undefined;
  }

  const object = value as Record<string, unknown>;

  if (typeof object.Id === "number" && Number.isInteger(object.Id) && object.Id > 0) {
    return object.Id;
  }

  for (const child of Object.values(object)) {
    const activityId = findFirstActivityId(child);

    if (activityId !== undefined) {
      return activityId;
    }
  }

  return undefined;
}

function expectInfoBlock(value: unknown, label: string): void {
  const infoBlock = expectObject(value, label);
  expectStringOrNull(infoBlock.Info, `${label}.Info`);
  expectStringOrNull(infoBlock.Details, `${label}.Details`);
  expectStringOrNull(infoBlock.Color, `${label}.Color`);
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  expect(value, `${label} should be an object`).toBeTypeOf("object");
  expect(value, `${label} should not be null`).not.toBeNull();
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, label: string): unknown[] {
  expect(Array.isArray(value), `${label} should be an array`).toBe(true);
  return value as unknown[];
}

function expectPositiveInteger(value: unknown, label: string): number {
  expect(value, `${label} should be a number`).toBeTypeOf("number");
  expect(Number.isInteger(value), `${label} should be an integer`).toBe(true);
  expect(value as number, `${label} should be positive`).toBeGreaterThan(0);
  return value as number;
}

function expectNumber(value: unknown, label: string): number {
  expect(value, `${label} should be a number`).toBeTypeOf("number");
  return value as number;
}

function expectBoolean(value: unknown, label: string): boolean {
  expect(value, `${label} should be a boolean`).toBeTypeOf("boolean");
  return value as boolean;
}

function expectString(value: unknown, label: string): string {
  expect(value, `${label} should be a string`).toBeTypeOf("string");
  return value as string;
}

function expectNonEmptyString(value: unknown, label: string): string {
  const stringValue = expectString(value, label);
  expect(stringValue.trim().length, `${label} should not be empty`).toBeGreaterThan(0);
  return stringValue;
}

function expectStringOrNull(value: unknown, label: string): string | null {
  if (value === null) {
    return value;
  }

  return expectString(value, label);
}

function expectIsoDateString(value: unknown, label: string): string {
  const dateString = expectNonEmptyString(value, label);
  expect(Number.isNaN(new Date(dateString).getTime()), `${label} should parse as a date`).toBe(
    false,
  );
  return dateString;
}

function daysInUtcMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
