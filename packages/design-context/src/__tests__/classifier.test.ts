import { describe, expect, it } from "bun:test";
import { classifyTask } from "../classifier.js";

describe("classifyTask", () => {
  it("classifies a dashboard description", () => {
    expect(classifyTask("Create a dashboard with analytics metrics")).toBe("dashboard");
  });

  it("classifies a landing hero description", () => {
    expect(classifyTask("Design a hero section for the landing page")).toBe("landing-hero");
  });

  it("classifies a login form", () => {
    expect(classifyTask("Build a login page with email and password")).toBe("form-auth");
  });

  it("classifies a pricing page", () => {
    expect(classifyTask("Create a pricing page with subscription tiers")).toBe("pricing");
  });

  it("classifies a settings page", () => {
    expect(classifyTask("Design the settings preferences page")).toBe("settings");
  });

  it("classifies a data table", () => {
    expect(classifyTask("Build a data table with sortable columns")).toBe("data-table");
  });

  it("classifies navigation", () => {
    expect(classifyTask("Create a navbar with logo and links")).toBe("navigation");
  });

  it("classifies a modal dialog", () => {
    expect(classifyTask("Design a confirmation dialog modal")).toBe("modal-dialog");
  });

  it("classifies cards", () => {
    expect(classifyTask("Create a card grid layout for products")).toBe("card-component");
  });

  it("classifies profile page", () => {
    expect(classifyTask("Design the user profile page")).toBe("profile-page");
  });

  it("classifies onboarding", () => {
    expect(classifyTask("Create an onboarding wizard flow")).toBe("onboarding");
  });

  it("classifies empty state", () => {
    expect(classifyTask("Design an empty state for when there is no data")).toBe("empty-state");
  });

  it("defaults to landing-hero for unknown descriptions", () => {
    expect(classifyTask("something completely unrelated")).toBe("landing-hero");
  });
});
