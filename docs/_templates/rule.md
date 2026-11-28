---
title: "{title}"
description: "{summary}"
layout: record
agent:
  edit: false
record:
  summary: summary
  status: status
  facts:
    - field: id
      label: Rule ID
    - field: purl
      label: Package URL
    - field: vers
      label: Affected versions (VERS)
    - field: deadline
      label: Lifecycle date
    - field: precision
      label: Date precision
    - field: announced
      label: Announced on
    - field: dataVersion
      label: Signed data version
    - field: apiUrl
      label: Rule JSON
      kind: url
    - field: observedAt
      label: Evidence observed on
      group: Provenance
    - field: reviewedAt
      label: Reviewed on
      group: Provenance
    - field: reviewers
      label: Reviewers
      kind: list
      group: Provenance
    - field: method
      label: Method
      group: Provenance
    - field: importer
      label: Importer
      group: Provenance
    - field: replacement
      label: Guidance
      group: Replacement
    - field: replacements
      label: Targets
      kind: list
      group: Replacement
    - field: requires
      label: Runtime requirements
      kind: list
      group: Replacement
---

## Evidence

:evidence[status]
