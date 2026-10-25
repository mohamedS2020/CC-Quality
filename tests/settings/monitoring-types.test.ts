/**
 * @jest-environment node
 *
 * Monitoring type options: a non-versioned setting (like call types) that
 * starts from the default list and, once saved, keeps the admin's order.
 */
import { prisma } from "@/lib/db/client";
import {
  DEFAULT_MONITORING_TYPES,
  getMonitoringTypes,
  setMonitoringTypes,
} from "@/lib/settings/settings";

const KEY = "monitoring_types";
let saved: unknown;

beforeAll(async () => {
  saved = (await prisma.setting.findUnique({ where: { key: KEY } }))?.value;
  await prisma.setting.deleteMany({ where: { key: KEY } });
});

afterAll(async () => {
  await prisma.setting.deleteMany({ where: { key: KEY } });
  if (saved !== undefined) {
    await prisma.setting.create({ data: { key: KEY, value: saved as string[] } });
  }
  await prisma.$disconnect();
});

describe("monitoring types setting", () => {
  it("falls back to the default list until saved", async () => {
    expect(await getMonitoringTypes()).toEqual(DEFAULT_MONITORING_TYPES);
  });

  it("keeps the saved order, trimmed and de-duplicated", async () => {
    await setMonitoringTypes(["TL", " Agent Level ", "", "TL", "Staff"]);
    expect(await getMonitoringTypes()).toEqual(["TL", "Agent Level", "Staff"]);
  });

  it("respects an emptied list instead of restoring the defaults", async () => {
    await setMonitoringTypes([]);
    expect(await getMonitoringTypes()).toEqual([]);
  });
});
