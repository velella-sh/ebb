---
title: "Extended support"
description: "How Ebb models and reports commercial and extended security maintenance windows separately from standard community support."
layout: doc
permalink: /extended-support/
---

# Extended support

Many major platforms, operating systems, and frameworks provide extended or commercial support long after standard community support ends. Examples include:

- **Ubuntu Pro ESM and Legacy:** Extended Security Maintenance and Legacy add-on coverage for Ubuntu LTS releases.
- **Red Hat Enterprise Linux (RHEL) ELS:** Extended Life Cycle Support for enterprise Linux lines.
- **Debian ELTS:** Extended Long Term Support provided by Freexian for legacy Debian releases.
- **Spring Boot Commercial Support:** Enterprise support provided by Broadcom/VMware beyond standard OSS maintenance.

Ebb models extended support separately from standard community support so security teams and developers can distinguish between releases covered under community maintenance versus those requiring paid or commercial entitlement contracts.

---

## The `end-of-extended-support` lifecycle event

Registry rules represent extended support milestones using the `end-of-extended-support` event. Each rule carries:

- `event`: `"end-of-extended-support"`
- `deadline`: Date (`YYYY-MM-DD`) when the extended support window closes.
- `sources`: Authoritative vendor documentation specifying the extended support commitment.

```json
{
  "id": "container.ubuntu.extended-support-20.04",
  "ecosystem": "container",
  "purl": "pkg:docker/library/ubuntu",
  "vers": "vers:semver/>=20.0.0|<20.10.0",
  "event": "end-of-extended-support",
  "title": "Ubuntu image release line 20.04 reaches extended support end-of-life on 2035-05-31",
  "summary": "Ubuntu 20.04 LTS receives Extended Security Maintenance through May 2030 and Legacy add-on coverage through May 2035 via Ubuntu Pro.",
  "severity": "medium",
  "replacement": "An ubuntu image on a supported release line",
  "deadline": "2035-05-31",
  "sources": [
    {
      "title": "Ubuntu release cycle",
      "url": "https://ubuntu.com/about/release-cycle",
      "accessedAt": "2026-11-27"
    }
  ]
}
```

---

## Status determination rules

When a component has both standard and extended support rules, Ebb evaluates the overall `status` according to these rules:

1. **Before standard support ends:**
   The package is actively supported in open-source/community channels. Status is `"ok"` (or `"scheduled"` if an announced sunset date exists).
2. **Between standard support end and `extendedSupportUntil`:**
   Free standard community maintenance has ended, but commercial or extended security maintenance is active. Status is `"unsupported"`, and the result populates `extendedSupportUntil`.
3. **On or after `extendedSupportUntil`:**
   Both standard and extended support periods have expired. Status advances to `"end-of-life"`.

---

## The `extendedSupportUntil` result field

Calls to `check(purl, version, asOf?)` expose extended support through `result.extendedSupportUntil`:

```json
{
  "schemaVersion": 1,
  "status": "unsupported",
  "matches": [
    {
      "ruleId": "java.maven.spring-boot.legacy-2x.end-of-support",
      "event": "unsupported",
      "date": null
    },
    {
      "ruleId": "java.maven.spring-boot.extended-support-2.7",
      "event": "scheduled",
      "date": "2029-06-30",
      "daysLeft": 946
    }
  ],
  "version": "2.7.18",
  "asOf": "2026-11-27",
  "extendedSupportUntil": "2029-06-30"
}
```

---

## CLI and MCP representation

### Command Line Interface

When checking a package that carries extended support, the Ebb CLI highlights the extended support date and evidence source:

```text
✖ pkg:maven/org.springframework.boot/spring-boot@2.7.18: unsupported
  Extended support until 2029-06-30 (Spring Boot support policy)
  Rule: java.maven.spring-boot.legacy-2x.end-of-support
  Event: unsupported
  Replacement: Spring Boot 4.1.x
  ...
```

### Model Context Protocol (MCP)

In MCP tool responses (such as `check_package`), `extendedSupportUntil` is preserved directly on both `structuredContent` and the serialized JSON output, enabling AI agents and automated workflows to recognize extended support windows.

---

## Covered products

| Ecosystem | Product | Coverage | Evidence Source |
| :--- | :--- | :--- | :--- |
| `container` | Ubuntu 14.04, 16.04, 18.04, 20.04, 22.04, 24.04 | Ubuntu Pro ESM & Legacy add-on | Canonical Ubuntu release cycle |
| `container` | Red Hat Enterprise Linux (RHEL 7) | Extended Life Phase / ELS | Red Hat Enterprise Linux Life Cycle |
| `container` | Debian 10 (Buster), 11 (Bullseye) | Extended Long Term Support (ELTS) | Freexian Debian LTS/ELTS schedule |
| `java` | Spring Boot 1.5 through 3.5 | Commercial enterprise support | Broadcom Spring Boot support policy |
