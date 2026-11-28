package ebb

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUpstreamVERSContainmentVectors(t *testing.T) {
	files, err := filepath.Glob("../../tests/vers/fixtures/*.json")
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		var fixture struct {
			Tests []struct {
				Kind    string `json:"test_type"`
				Input   json.RawMessage
				Output  json.RawMessage `json:"expected_output"`
				Failure bool            `json:"expected_failure"`
			}
		}
		if err := json.Unmarshal(data, &fixture); err != nil {
			t.Fatal(err)
		}
		for _, vector := range fixture.Tests {
			if vector.Kind != "containment" {
				continue
			}
			var input struct {
				Vers    string
				Version string
			}
			if err := json.Unmarshal(vector.Input, &input); err != nil {
				t.Fatal(err)
			}
			scheme, _, _ := strings.Cut(strings.TrimPrefix(input.Vers, "vers:"), "/")
			switch scheme {
			case "npm", "semver", "golang", "pep440", "pypi":
			default:
				continue
			}
			count++
			t.Run(filepath.Base(file)+"/"+input.Vers+"/"+input.Version, func(t *testing.T) {
				actual, err := VersContains(input.Vers, input.Version)
				if vector.Failure {
					if err == nil {
						t.Fatal("expected the range or version to be rejected")
					}
					return
				}
				var want bool
				if e := json.Unmarshal(vector.Output, &want); e != nil {
					t.Fatal(e)
				}
				if err != nil || actual != want {
					t.Errorf("got %v, %v; want %v", actual, err, want)
				}
			})
		}
	}
	if count < 11 {
		t.Fatalf("expected the supported upstream containment vectors, ran %d", count)
	}
}

func TestVERSContainment(t *testing.T) {
	for _, tc := range []struct {
		rangeText, version string
		want               bool
	}{
		{"vers:semver/>=1.2.3-alpha.2|<1.2.3", "1.2.3-alpha.10+vendor", true},
		{"vers:semver/>=1.2.3-alpha.2|<1.2.3", "1.2.3-alpha.1", false},
		{"vers:semver/1.2.3", "v1.2.3+build.6", true},
		{"vers:golang/>=1.25.0|<1.26.0", "1.25.4", true},
		{"vers:golang/>=1.25.0|<1.26.0", "1.26.0", false},
		{"vers:golang/1.24.0", "v1.24", true},
		{"vers:npm/>=1.0.0|!=1.1.0|<2.0.0", "1.1.0", false},
		{"vers:npm/<=1.0.0|>=2.0.0", "2.1.0", true},
		{"vers:npm/!=1.0.0|!=2.0.0", "2.1.0", true},
		{"vers:pep440/>=1%211.0.dev1|<1%211.0rc1", "1!1.0a1", true},
		{"vers:pep440/2.0rc0", "v2.0preview", true},
		{"vers:pep440/2.0.post1", "2.0-1", true},
		{"vers:pep440/>1.0+abc|<1.0+11", "1.0+002", true},
		{"vers:pep440/>1.0.post1.dev1|<1.0.post1", "1.0.post1.dev2", true},
		{"vers:pep440/1.0", "1.0.0", true},
	} {
		t.Run(tc.rangeText+"/"+tc.version, func(t *testing.T) {
			actual, err := VersContains(tc.rangeText, tc.version)
			if err != nil || actual != tc.want {
				t.Errorf("got %v, %v; want %v", actual, err, tc.want)
			}
		})
	}
}

func TestVERSInputErrors(t *testing.T) {
	for _, tc := range []struct {
		rangeText, version string
		err                error
	}{
		{"vers:maven/*", "1.0", ErrUnsupportedScheme},
		{"vers:npm/*", "not-a-version", ErrInvalidVersion},
		{"vers:pep440/>=1.0", "not-a-version", ErrInvalidVersion},
		{"vers:npm/>1.0.0|>=2.0.0", "1.5.0", ErrInvalidRange},
		{"vers:npm/1.0.0|<2.0.0", "1.5.0", ErrInvalidRange},
		{"vers:pypi/1.0|1.0.0", "1.0", ErrInvalidRange},
		{"vers:golang/1.0%2G0", "1.0.0", ErrInvalidRange},
		{"vers:npm/", "1.0.0", ErrInvalidRange},
	} {
		actual, err := VersContains(tc.rangeText, tc.version)
		if actual || !errors.Is(err, tc.err) {
			t.Errorf("VersContains(%q, %q) = %v, %v; want %v", tc.rangeText, tc.version, actual, err, tc.err)
		}
	}
}
