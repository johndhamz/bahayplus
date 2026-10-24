/**
 * SAMPLE DATA — for isolated design previews under /preview only.
 * Never import from portal routes or modules (enforced by ESLint). Every render must show <SampleDataNotice/>.
 */
export const SAMPLE_MARKER = "sample" as const;

export const sampleHousehold = {
  name: "Dela Cruz Household (sample)",
  properties: 2,
  members: 4,
  pets: 1,
  vehicles: 1,
};

export const sampleUpcoming = [
  { id: "s1", title: "Aircon cleaning — Sala unit", when: "Sat, 9:00 AM", kind: "Booking" },
  { id: "s2", title: "Bantay anti-rabies booster", when: "Tue", kind: "Pet" },
  { id: "s3", title: "LTO registration renewal", when: "Nov 15", kind: "Vehicle" },
];

export const sampleBills = [
  { id: "b1", biller: "Electricity (sample)", dueOn: "2026-11-05", amountCentavos: 482_350, status: "unpaid" },
  { id: "b2", biller: "Water (sample)", dueOn: "2026-10-28", amountCentavos: 61_200, status: "overdue" },
  { id: "b3", biller: "Internet (sample)", dueOn: "2026-11-12", amountCentavos: 169_900, status: "paid" },
];

export const sampleBookings = [
  {
    id: "BK-1042",
    customer: "Sample Customer A",
    service: "Plumbing repair",
    city: "Quezon City",
    scheduled: "Oct 26, 9:00 AM",
    status: "confirmed",
    totalCentavos: 250_000,
  },
  {
    id: "BK-1043",
    customer: "Sample Customer B",
    service: "Aircon cleaning",
    city: "Makati",
    scheduled: "Oct 26, 1:30 PM",
    status: "pending",
    totalCentavos: 180_000,
  },
  {
    id: "BK-1044",
    customer: "Sample Customer C",
    service: "Electrical inspection",
    city: "Pasig",
    scheduled: "Oct 27, 10:00 AM",
    status: "in_progress",
    totalCentavos: 120_000,
  },
  {
    id: "BK-1045",
    customer: "Sample Customer D",
    service: "Plumbing repair",
    city: "Taguig",
    scheduled: "Oct 28, 3:00 PM",
    status: "cancelled",
    totalCentavos: 95_000,
  },
];

export const sampleActivity = [
  { id: "a1", text: "Quotation Q-311 accepted by a customer", when: "10 min ago" },
  { id: "a2", text: "Worker assigned to BK-1042", when: "1 hr ago" },
  { id: "a3", text: "New review received (5★)", when: "Yesterday" },
];

export const sampleProviders = [
  {
    id: "p1",
    name: "Sample Plumbing Co.",
    verification: { status: "verified" as const, items: ["DTI registration", "Mayor's permit"] },
    rating: { averageTenths: 47, count: 32 },
    categories: ["Plumbing", "Drainage"],
    serviceArea: "Quezon City",
  },
  {
    id: "p2",
    name: "Sample Electric Services",
    verification: { status: "pending" as const },
    rating: null,
    categories: ["Electrical"],
    serviceArea: "Pasig",
  },
];
