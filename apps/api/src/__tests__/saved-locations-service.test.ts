import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { savedLocations, user } from "../db/schema.js";
import * as savedLocationsService from "../services/saved-locations.service.js";

const TEST_USER_ID = "test-user-svc-locations";

vi.mock("../services/geocoding.service.js", () => ({
  reverseGeocode: vi.fn(),
}));

const { reverseGeocode } = await import("../services/geocoding.service.js");
const reverseMock = vi.mocked(reverseGeocode);

beforeAll(async () => {
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test-svc-locations@test.reissulla.local",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, TEST_USER_ID));
});

beforeEach(async () => {
  await db
    .delete(savedLocations)
    .where(eq(savedLocations.userId, TEST_USER_ID));
  reverseMock.mockReset();
});

describe("savedLocationsService.createLocation", () => {
  it("stamps the locality from the reverse-geocode response into region", async () => {
    reverseMock.mockResolvedValueOnce({
      data: {
        placeId: "x",
        name: "Rautatientori",
        displayName: "Helsinki Central",
        address: {
          city: "Helsinki",
          county: "Uusimaa",
          country: "Finland",
        },
        latitude: 60.17,
        longitude: 24.94,
      },
      cached: false,
    });

    const row = await savedLocationsService.createLocation({
      userId: TEST_USER_ID,
      name: "Home",
      latitude: 60.17,
      longitude: 24.94,
      category: "home",
    });

    expect(row.region).toBe("Helsinki");
    expect(row.category).toBe("home");
  });

  it("falls back to county when no city is available", async () => {
    reverseMock.mockResolvedValueOnce({
      data: {
        placeId: "x",
        name: "Wilderness",
        displayName: "Lapin maakunta",
        address: { county: "Lappi", country: "Finland" },
        latitude: 67.5,
        longitude: 26.5,
      },
      cached: false,
    });

    const row = await savedLocationsService.createLocation({
      userId: TEST_USER_ID,
      name: "Wilderness",
      latitude: 67.5,
      longitude: 26.5,
    });

    expect(row.region).toBe("Lappi");
  });

  it("leaves region null when reverse-geocode fails (best-effort enrichment)", async () => {
    reverseMock.mockRejectedValueOnce(new Error("Network error"));

    const row = await savedLocationsService.createLocation({
      userId: TEST_USER_ID,
      name: "Mystery",
      latitude: 60.17,
      longitude: 24.94,
    });

    expect(row.region).toBeNull();
  });

  it("rejects unknown category values", async () => {
    reverseMock.mockResolvedValueOnce({
      data: {
        placeId: "x",
        name: "x",
        displayName: "x",
        address: { city: "Helsinki" },
        latitude: 60.17,
        longitude: 24.94,
      },
      cached: false,
    });

    await expect(
      savedLocationsService.createLocation({
        userId: TEST_USER_ID,
        name: "Test",
        latitude: 60.17,
        longitude: 24.94,
        category: "office" as savedLocationsService.SavedLocationCategory,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CATEGORY" });
  });

  it("translates the partial-unique-index conflict to CATEGORY_ALREADY_SET", async () => {
    reverseMock.mockResolvedValue({
      data: {
        placeId: "x",
        name: "x",
        displayName: "x",
        address: { city: "Helsinki" },
        latitude: 60.17,
        longitude: 24.94,
      },
      cached: false,
    });

    await savedLocationsService.createLocation({
      userId: TEST_USER_ID,
      name: "Home",
      latitude: 60.17,
      longitude: 24.94,
      category: "home",
    });

    await expect(
      savedLocationsService.createLocation({
        userId: TEST_USER_ID,
        name: "Other home",
        latitude: 60.2,
        longitude: 24.96,
        category: "home",
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_ALREADY_SET" });
  });

  it("allows multiple non-home/work categories without conflict", async () => {
    reverseMock.mockResolvedValue({
      data: {
        placeId: "x",
        name: "x",
        displayName: "x",
        address: { city: "Helsinki" },
        latitude: 60.17,
        longitude: 24.94,
      },
      cached: false,
    });

    await savedLocationsService.createLocation({
      userId: TEST_USER_ID,
      name: "Cottage A",
      latitude: 60.17,
      longitude: 24.94,
      category: "cottage",
    });
    await savedLocationsService.createLocation({
      userId: TEST_USER_ID,
      name: "Cottage B",
      latitude: 60.2,
      longitude: 24.96,
      category: "cottage",
    });

    const rows = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userId, TEST_USER_ID));
    expect(rows).toHaveLength(2);
  });
});

describe("savedLocationsService.updateLocation", () => {
  beforeEach(() => {
    reverseMock.mockResolvedValue({
      data: {
        placeId: "x",
        name: "x",
        displayName: "x",
        address: { city: "Helsinki" },
        latitude: 60.17,
        longitude: 24.94,
      },
      cached: false,
    });
  });

  it("translates a category conflict on update", async () => {
    const home = await savedLocationsService.createLocation({
      userId: TEST_USER_ID,
      name: "Home",
      latitude: 60.17,
      longitude: 24.94,
      category: "home",
    });
    const other = await savedLocationsService.createLocation({
      userId: TEST_USER_ID,
      name: "Spare",
      latitude: 60.2,
      longitude: 24.96,
      category: "other",
    });

    await expect(
      savedLocationsService.updateLocation({
        userId: TEST_USER_ID,
        id: other.id,
        category: "home",
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_ALREADY_SET" });

    // Sanity: the home row is untouched.
    const stillHome = await db
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.id, home.id));
    expect(stillHome[0]?.category).toBe("home");
  });
});
