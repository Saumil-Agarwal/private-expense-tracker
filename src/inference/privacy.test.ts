import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("inference privacy boundary", () => {
  it("contains no hosted model endpoint", () => {
    const source = files(join(process.cwd(), "src", "inference")).filter((path) => !path.endsWith("privacy.test.ts")).map((path) => readFileSync(path, "utf8")).join("\n");
    expect(source).not.toMatch(/api\.openai|api\.anthropic|generativelanguage|ai-gateway|huggingface\.co\/api\/inference/i);
  });

  it("does not upload receipt blobs", () => {
    const source = files(join(process.cwd(), "src", "inference")).filter((path) => !path.endsWith("privacy.test.ts")).map((path) => readFileSync(path, "utf8")).join("\n");
    expect(source).not.toMatch(/formdata|multipart\/form-data|uploadReceipt/i);
  });
});
