package ebb

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
)

func openRegistry(t *testing.T, path string) *Registry {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	registry, err := LoadRegistry(f)
	if err != nil {
		t.Fatal(err)
	}
	return registry
}

func TestCheckCoverageAndEvidence(t *testing.T) {
	registry := openRegistry(t, "../../registry/go.json")
	for _, tc := range []struct {
		purl, version, identity string
		want                    Status
	}{
		{"pkg:generic/golang@1.25.4#src", "", "pkg:generic/golang", Affected},
		{"pkg:generic/golang@1.25.4", "1.26.0", "pkg:generic/golang", NotAffected},
		{"pkg:npm/ebb-spec-unknown-example", "1.0.0", "pkg:npm/ebb-spec-unknown-example", Unknown},
	} {
		result, err := Check(tc.purl, tc.version, WithRegistry(registry))
		if err != nil || result.Status != tc.want || result.PURL != tc.identity {
			t.Fatalf("Check(%s, %s) = %+v, %v", tc.purl, tc.version, result, err)
		}
		if tc.want != Affected {
			if len(result.Matches) != 0 || result.Event != "" {
				t.Fatalf("unexpected claim in %s", tc.want)
			}
			continue
		}
		match := result.Matches[0]
		if result.Event != "end-of-support" || match.ID != "go.runtime.end-of-support-1.25" ||
			match.Deadline != "2026-08-19" || len(match.Sources) == 0 || match.Sources[0].AccessedAt == "" {
			t.Fatalf("failed to preserve Go rule or evidence: %+v", match)
		}
	}
	if _, err := Check("pkg:generic/golang", "nonsense", WithRegistry(registry)); !errors.Is(err, ErrInvalidVersion) {
		t.Fatalf("invalid Go version must remain distinguishable from NotAffected: %v", err)
	}
	if _, err := Check("pkg:generic/golang", "", WithRegistry(registry)); !errors.Is(err, ErrInvalidVersion) {
		t.Fatalf("version is required when the PURL omits it: %v", err)
	}
}

func TestCheckSkipsSymbolOnlyRulesAndRejectsUnsupportedComparisons(t *testing.T) {
	rules := openRegistry(t, "../../registry/python.json")
	var symbol json.RawMessage
	for _, rule := range rules.Rules {
		if bytes.Contains(rule, []byte("python.symbol.datetime.utcnow")) {
			symbol = rule
			break
		}
	}
	if symbol == nil {
		t.Fatal("missing Python symbol fixture")
	}
	rules.Rules = []json.RawMessage{symbol}
	res, err := Check("pkg:generic/python", "3.12.0", WithRegistry(rules))
	if err != nil || res.Status != Unknown || len(res.Matches) != 0 {
		t.Fatalf("symbol-only rule leaked into package coverage: %+v, %v", res, err)
	}

	goRegistry := openRegistry(t, "../../registry/go.json")
	goRegistry.Rules[0] = bytes.Replace(goRegistry.Rules[0], []byte("vers:golang/"), []byte("vers:maven/"), 1)
	if _, err := Check("pkg:generic/golang", "1.25.4", WithRegistry(goRegistry)); !errors.Is(err, ErrUnsupportedScheme) {
		t.Fatalf("unsupported scheme must remain distinguishable from NotAffected: %v", err)
	}
	goRegistry.Rules[0] = bytes.Replace(goRegistry.Rules[0], []byte("2026-08-19"), []byte("2026-02-30"), 1)
	if _, err := NewChecker(WithRegistry(goRegistry)); err == nil || !strings.Contains(err.Error(), "calendar day") {
		t.Fatalf("impossible deadline was accepted: %v", err)
	}
}

func TestCheckKeepsPlanningEstimatesSeparate(t *testing.T) {
	python := openRegistry(t, "../../registry/python.json")
	p := Prediction{
		PURL: "pkg:npm/ebb-test-product", Line: "2.x", LineVERS: "vers:npm/>=2.0.0|<3.0.0",
		PredictedEnd: PredictedEnd{Date: "2027-06-10", Low: "2027-06-01", High: "2027-06-30", Precision: "month"},
		Confidence:   "low", Method: "cadence", ModelVersion: "0.1.0", DataVersion: "2026.11.11",
		Evidence: []PredictionEvidence{{Kind: "policy", URL: "https://example.test/policy", AccessedAt: "2026-11-11"}},
	}
	result, err := Check(p.PURL, "2.2.0", WithPredictions(p))
	if err != nil || result.Status != Unknown || len(result.Matches) != 0 || len(result.Predictions) != 1 ||
		result.Predictions[0].PredictedEnd != p.PredictedEnd || result.Predictions[0].Confidence != "low" {
		t.Fatalf("estimate must be returned independently of coverage: %+v, %v", result, err)
	}
	p.PURL = "pkg:pypi/django"
	p.LineVERS = "vers:pypi/>=2.2|<2.3"
	result, err = Check(p.PURL, "2.2.0", WithRegistry(python), WithPredictions(p))
	if err != nil || result.Status != Affected || result.Event != "end-of-life" || len(result.Predictions) != 0 {
		t.Fatalf("published end-of-life date must supersede competing estimate: %+v, %v", result, err)
	}
	p.LineVERS = "vers:maven/*"
	result, err = Check(p.PURL, "99.1.0", WithRegistry(python), WithPredictions(p))
	if err != nil || result.Status != NotAffected || len(result.PredictionNotes) != 1 {
		t.Fatalf("unsupported estimate comparison must not change known coverage: %+v, %v", result, err)
	}
}

func TestCheckFromVerifiedBundle(t *testing.T) {
	body := fixtureBundle(t, "ebb.data-bundle.v2")
	bundle, err := LoadBundle(bytes.NewReader(body), fmt.Sprintf("%x", sha256.Sum256(body)))
	if err != nil {
		t.Fatal(err)
	}
	checker, err := NewChecker(WithBundle(bundle))
	if err != nil {
		t.Fatal(err)
	}
	result, err := checker.Check("pkg:npm/request", "2.88.2")
	if err != nil || result.Status != Affected || result.Event != "deprecated" {
		t.Fatalf("bundle rule unavailable: %+v (%v)", result, err)
	}
	if _, err := NewChecker(WithBundle(&Bundle{})); err == nil {
		t.Fatal("accepted a bundle that was not loaded with digest verification")
	}
	bundle.Files["registry/npm.json"] = []byte(`{"schemaVersion":"ebb.registry.v2","ecosystem":"npm","rules":[]}`)
	if _, err := NewChecker(WithBundle(bundle)); !errors.Is(err, ErrDigestMismatch) {
		t.Fatalf("accepted a bundle registry changed after verification: %v", err)
	}
}

func TestCheckPreservesStoredEventAndOrdersMatches(t *testing.T) {
	data := openRegistry(t, "../../registry/nodejs.json")
	checker, err := NewChecker(WithRegistry(data))
	if err != nil {
		t.Fatal(err)
	}
	result, err := checker.Check("pkg:generic/nodejs", "22.12.0")
	if err != nil || result.Status != Affected || result.Event != "scheduled-end-of-life" ||
		result.Matches[0].Deadline != "2027-04-30" {
		t.Fatalf("stored event and deadline changed: %+v, %v", result, err)
	}
	if compareRules(Rule{Event: "removed"}, Rule{Event: "deprecated", Deadline: "2026-01-01"}) >= 0 ||
		compareRules(Rule{Event: "removed", Deadline: "2026-01-01"}, Rule{Event: "removed"}) >= 0 {
		t.Fatal("incorrect event or deadline precedence")
	}
}
