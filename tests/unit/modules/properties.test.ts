import { describe, expect, it } from "vitest";
import { formatPhilippineAddress, localityLabel } from "@bahayplus/modules/properties";
import { describeActivity } from "@bahayplus/modules/households";
import { CreatePropertyInput, UpdatePropertyInput } from "@bahayplus/validation/properties/property";

const HH = "20000000-0000-4000-8000-000000000001";

describe("Philippine address formatting", () => {
  it("orders street, barangay, city, province and postal code", () => {
    expect(
      formatPhilippineAddress({
        addressLine: "12 Sampaguita St.",
        barangay: "Malaya",
        cityMunicipality: "Quezon City",
        province: "Metro Manila",
        postalCode: "1101",
      }),
    ).toBe("12 Sampaguita St., Brgy. Malaya, Quezon City, Metro Manila 1101");
  });

  it("does not double-prefix barangay and skips empty parts", () => {
    expect(
      formatPhilippineAddress({ barangay: "Barangay San Isidro", cityMunicipality: "Antipolo", province: "Rizal" }),
    ).toBe("Barangay San Isidro, Antipolo, Rizal");
    expect(formatPhilippineAddress({ barangay: "Brgy. Poblacion", cityMunicipality: "Makati" })).toBe(
      "Brgy. Poblacion, Makati",
    );
    expect(formatPhilippineAddress({})).toBe("");
  });

  it("avoids repeating the city when province equals city", () => {
    expect(formatPhilippineAddress({ cityMunicipality: "Cebu City", province: "Cebu City", postalCode: "6000" })).toBe(
      "Cebu City, 6000",
    );
  });

  it("supports multi-line output and a short locality", () => {
    expect(
      formatPhilippineAddress(
        { addressLine: "Unit 5", cityMunicipality: "Taguig", province: "Metro Manila" },
        { multiline: true },
      ),
    ).toBe("Unit 5\nTaguig\nMetro Manila");
    expect(localityLabel({ cityMunicipality: "Taguig", province: "Metro Manila" })).toBe("Taguig, Metro Manila");
  });
});

describe("property contract", () => {
  const valid = {
    householdId: HH,
    name: "Home",
    propertyType: "house",
    cityMunicipality: "Pasig",
    province: "Metro Manila",
  };

  it("accepts a minimal property and normalises optional fields", () => {
    const parsed = CreatePropertyInput.parse(valid);
    expect(parsed).toMatchObject({
      addressLine: "",
      barangay: "",
      postalCode: null,
      latitude: null,
      longitude: null,
      notes: "",
    });
  });

  it("validates postal codes and required locality", () => {
    expect(CreatePropertyInput.safeParse({ ...valid, postalCode: "123" }).success).toBe(false);
    expect(CreatePropertyInput.safeParse({ ...valid, postalCode: "1600" }).success).toBe(true);
    expect(CreatePropertyInput.safeParse({ ...valid, cityMunicipality: " " }).success).toBe(false);
    expect(CreatePropertyInput.safeParse({ ...valid, propertyType: "castle" }).success).toBe(false);
  });

  it("requires both coordinates or neither, within the Philippines", () => {
    expect(CreatePropertyInput.safeParse({ ...valid, latitude: "14.55", longitude: "" }).success).toBe(false);
    expect(CreatePropertyInput.safeParse({ ...valid, latitude: "51.5", longitude: "-0.12" }).success).toBe(false);
    const ok = CreatePropertyInput.parse({ ...valid, latitude: "14.5547123", longitude: "121.0244" });
    expect(ok.latitude).toBe(14.554712);
    expect(ok.longitude).toBe(121.0244);
  });

  it("update input carries the active flag", () => {
    const parsed = UpdatePropertyInput.parse({ ...valid, householdId: undefined, propertyId: HH, isActive: false });
    expect(parsed.isActive).toBe(false);
  });
});

describe("activity descriptions", () => {
  it("renders known kinds and degrades for unknown ones", () => {
    expect(describeActivity("member.joined", { member: "Jose", role: "manager" })).toBe("Jose joined as Manager");
    expect(describeActivity("property.archived", { name: "Condo" })).toBe("Archived property “Condo”");
    expect(describeActivity("invitation.sent", { email: "a@b.ph", role: "guest" })).toBe("Invited a@b.ph as Guest");
    expect(describeActivity("something.new", {})).toBe("Household updated");
  });
});
