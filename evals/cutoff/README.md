# Cutoff question set

The question set uses Ebb's signed [2026.11.11 release](https://github.com/velella-sh/ebb/releases/tag/data-v2026.11.11) and a reference date of 11 November 2026 UTC. Each option has a concrete package or release version, a lifecycle label and the matching signed rule IDs. The evidence map records each ID's event, date when known and original source URLs.

The questions ask for a deployment or dependency decision. Each prompt supplies one or two options and an abstention. The question set contains 150 questions, 157 options and 133 distinct cited rules across 20 ecosystems. Seven questions compare two choices. These counts describe the corpus. They are independent of any model's answers.

| Ecosystem | Questions |
| --- | ---: |
| Android | 7 |
| CI images | 5 |
| Container | 21 |
| Dart | 3 |
| Database | 21 |
| Deno and Bun | 3 |
| .NET | 6 |
| Elixir and Erlang | 4 |
| GitHub Actions | 16 |
| Go | 6 |
| Java | 6 |
| Kubernetes | 10 |
| Node.js | 8 |
| npm | 7 |
| PHP | 5 |
| Python | 6 |
| Ruby | 6 |
| Rust | 2 |
| Shell | 5 |
| Swift and Apple developer tools | 3 |

The key contains 128 end-of-life options, 8 deprecated options and 21 fine options. End-of-life includes matching unsupported or removed events under the stated scope. Fine requires recorded, dated support-ending evidence after the reference day. Ongoing support, patch availability and general suitability can change independently of this lifecycle label.

The key is derived with Ebb's scoped `check()` on matching signed rules for each ecosystem. Package-level npm and PyPI rules can include usage guidance. Runtime, image and toolchain prompts use rule matches without usage selectors. Android and Apple questions specify the relevant store submission scope where the evidence requires it. Draw conclusions about the named choices and deployment scopes.

## Reproduce the offline replay

```bash
npm ci
npm run build
node dist/evals/cutoff/run.js
node dist/evals/cutoff/run.js --prompts
```

The first command after the build scores the 20 labelled synthetic response fixtures and prints the raw input, selected option or abstention, and expected judgement for each row. The second prints both neutral prompt arms in order. Only the with-Ebb arm adds the pinned lifecycle events, dates and original URLs. Outputs use a fixed order and contain no run timestamp.

To rederive all 150 answer keys from authenticated release files, use the pinned SHA-256 already stored in the question-set header and the published 0.2.0 reader for the historical format. The current signature checks still verify both the bundle and its signed release log.

```bash
release_dir=$(mktemp -d)
verifier_dir=$(mktemp -d)
gh release download data-v2026.11.11 --repo velella-sh/ebb --dir "$release_dir" \
  --pattern 'ebb-data-2026.11.11.json*' --pattern 'release-log.jsonl*'
npm install --prefix "$verifier_dir" --no-audit --no-fund @velella/ebb@0.2.0
node dist/evals/cutoff/run.js \
  --bundle "$release_dir/ebb-data-2026.11.11.json" \
  --signature "$release_dir/ebb-data-2026.11.11.json.sigstore.json" \
  --historical-verifier "$verifier_dir/node_modules/@velella/ebb"
```

A comparison of measured model answers requires recorded raw outputs from matched model runs. The scorer audit against those outputs is tracked separately. See [#698](https://github.com/velella-sh/ebb/issues/698) and [#743](https://github.com/velella-sh/ebb/issues/743).
