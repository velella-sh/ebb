import assert from "node:assert/strict";
import { test } from "node:test";
import { asOf } from "../../src/index.js";
import type { RegistryV2Rule } from "../../src/registry.js";

test("extended support check reports status and extendedSupportUntil across date boundaries", () => {
  const normalSupportDate = "2024-06-30";
  const extendedSupportDate = "2025-06-30";

  const customRules: RegistryV2Rule[] = [
    {
      id: "pkg.test.end-of-support",
      ecosystem: "npm",
      purl: "pkg:npm/test-ext-pkg",
      vers: "vers:npm/>=1.0.0|<2.0.0",
      event: "scheduled-end-of-life",
      deadline: normalSupportDate,
      title: "Test package normal support ends 2024-06-30",
      summary: "Normal support ends on 2024-06-30.",
      severity: "high",
      sources: [
        {
          title: "Vendor Support Page",
          url: "https://example.com/support",
          accessedAt: "2026-11-27",
        },
      ],
      provenance: {
        observedAt: "2023-01-01",
        reviewedAt: "2026-11-27",
        reviewer: "arminazimi",
        reviewers: ["arminazimi"],
        method: "manual",
      },
    },
    {
      id: "pkg.test.extended-support",
      ecosystem: "npm",
      purl: "pkg:npm/test-ext-pkg",
      vers: "vers:npm/>=1.0.0|<2.0.0",
      event: "end-of-extended-support",
      deadline: extendedSupportDate,
      title: "Test package extended support ends 2025-06-30",
      summary: "Extended commercial support ends on 2025-06-30.",
      severity: "medium",
      sources: [
        {
          title: "Vendor Commercial Support",
          url: "https://example.com/commercial-support",
          accessedAt: "2026-11-27",
        },
      ],
      provenance: {
        observedAt: "2023-01-01",
        reviewedAt: "2026-11-27",
        reviewer: "arminazimi",
        reviewers: ["arminazimi"],
        method: "manual",
      },
    },
  ];

  // 1. Before normal support ends (e.g. 2024-01-01)
  const beforeClient = asOf("2024-01-01", { rules: customRules });
  const beforeRes = beforeClient.check("pkg:npm/test-ext-pkg", "1.5.0");
  assert.equal(beforeRes.status, "scheduled");
  assert.equal(beforeRes.extendedSupportUntil, extendedSupportDate);
  assert.equal(beforeRes.matches.length, 2);

  // 2. Between normal support and extended support (e.g. 2024-10-01)
  const betweenClient = asOf("2024-10-01", { rules: customRules });
  const betweenRes = betweenClient.check("pkg:npm/test-ext-pkg", "1.5.0");
  assert.equal(betweenRes.status, "unsupported", "Status between dates must remain unsupported (end-of-support)");
  assert.equal(betweenRes.extendedSupportUntil, extendedSupportDate);
  assert.equal(betweenRes.matches.length, 2);

  // 3. After extended support ends (e.g. 2025-10-01)
  const afterClient = asOf("2025-10-01", { rules: customRules });
  const afterRes = afterClient.check("pkg:npm/test-ext-pkg", "1.5.0");
  assert.equal(afterRes.status, "end-of-life", "Status after extended date must report end-of-life");
  assert.equal(afterRes.extendedSupportUntil, extendedSupportDate);
  assert.equal(afterRes.matches.length, 2);
});
