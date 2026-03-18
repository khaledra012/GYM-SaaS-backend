import { StaffValidation } from "./staff.schema";

describe("StaffValidation", () => {
  it("accepts valid create payload", () => {
    const result = StaffValidation.createStaff.safeParse({
      body: {
        name: "Ahmed",
        email: "ahmed@example.com",
        phone: "01012345678",
        password: "123456",
        role: "manager",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects owner role in create payload", () => {
    const result = StaffValidation.createStaff.safeParse({
      body: {
        name: "Owner User",
        email: "owner@example.com",
        password: "123456",
        role: "owner",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty update payload", () => {
    const result = StaffValidation.updateStaff.safeParse({
      params: { id: 3 },
      body: {},
    });

    expect(result.success).toBe(false);
  });
});

