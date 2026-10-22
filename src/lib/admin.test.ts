import { describe, expect, it } from "vitest";
import { isSuperAdminEmail } from "./admin";

describe("isSuperAdminEmail", () => {
  const admin = "abdullaarimbra1027@gmail.com";
  it("matches the admin email regardless of case", () => {
    expect(isSuperAdminEmail("AbdullaArimbra1027@Gmail.com", admin)).toBe(true);
  });
  it("rejects any other email", () => {
    expect(isSuperAdminEmail("student@gmail.com", admin)).toBe(false);
  });
  it("matches any email in a comma-separated admin list", () => {
    const multi = "admin1@example.com, abdullaarimbra1027@gmail.com, other@example.com";
    expect(isSuperAdminEmail("AbdullaArimbra1027@Gmail.com", multi)).toBe(true);
    expect(isSuperAdminEmail("admin1@example.com", multi)).toBe(true);
    expect(isSuperAdminEmail("other@example.com", multi)).toBe(true);
    expect(isSuperAdminEmail("stranger@example.com", multi)).toBe(false);
  });
  it("rejects everyone when the admin email is not configured", () => {
    expect(isSuperAdminEmail(admin, undefined)).toBe(false);
  });
});
