import { describe, it, expect } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

describe("Frontend smoke tests", () => {
  const srcDir = path.join(__dirname, "..", "src");

  it("src directory exists", () => {
    expect(fs.existsSync(srcDir)).toBe(true);
  });

  it("app layout exists", () => {
    const layoutPath = path.join(srcDir, "app", "layout.tsx");
    expect(fs.existsSync(layoutPath)).toBe(true);
  });

  it("main page exists", () => {
    const pagePath = path.join(srcDir, "app", "page.tsx");
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("login page exists", () => {
    const loginPath = path.join(srcDir, "app", "login", "page.tsx");
    expect(fs.existsSync(loginPath)).toBe(true);
  });

  it("documents page exists", () => {
    const docsPath = path.join(srcDir, "app", "documents", "page.tsx");
    expect(fs.existsSync(docsPath)).toBe(true);
  });

  it("search page exists", () => {
    const searchPath = path.join(srcDir, "app", "search", "page.tsx");
    expect(fs.existsSync(searchPath)).toBe(true);
  });

  it("package.json has required dependencies", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")
    );
    expect(pkg.dependencies).toHaveProperty("next");
    expect(pkg.dependencies).toHaveProperty("react");
  });
});
