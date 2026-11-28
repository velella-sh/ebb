---
title: Predicted dates (draft profile)
description: Proposed treatment of optional planning estimates, ranges and confidence.
layout: doc
permalink: /spec/1.0/predictions/
---

This optional profile is a proposal under review. The [implementation candidate](https://github.com/velella-sh/ebb/pull/1082) describes a separate prediction object. The current rule v2 schema has `deadline` for the event date and no prediction field. [Rule object](https://velella.sh/ebb/spec/1.0/rule/)

### ELF-PREDICT-01

A consumer that displays an estimate under this proposed profile MUST label it as predicted, and MUST show its range and the estimate's confidence with that label. A proposed example reads “Predicted April 2028 (26 March to 23 April 2028, low confidence).” This display does not assert a vendor-announced date.

### ELF-PREDICT-02

A consumer MUST exclude predictions from lifecycle matching and verdicts. When authoritative evidence supplies the date, the producer MUST withdraw the competing estimate for the covered versions and publish the date through the reviewed rule process. The announced date belongs to the rule and can be shown without the prediction label.

## Two confidence vocabularies

A rule can carry `confidence` as `confirmed`, `likely` or `tentative`, with a `confidenceNote` explaining the claim. In the candidate prediction object, `high`, `medium` and `low` qualify the estimate instead. The candidate records the component and release-line range, the estimated date and bounds, evidence, and model and data versions. Vendor policy and observations from earlier releases can both support an estimate. A consumer can read that evidence without reproducing the model.
