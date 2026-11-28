package ebb

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	packageurl "github.com/package-url/packageurl-go"
)

func TestPURLIdentity(t *testing.T) {
	for input, expected := range map[string]string{
		"pkg:npm/left-pad@1.3.0?repository_url=https%3A%2F%2Fregistry.npmjs.org#src": "pkg:npm/left-pad",
		"pkg:npm/%40Angular/Core@21.0.0":                                             "pkg:npm/%40angular/core",
		"pkg:PyPI/Django_package@5.2.0":                                              "pkg:pypi/django-package",
		"pkg:generic/My_Product@1.2":                                                 "pkg:generic/My_Product",
	} {
		actual, err := PURLIdentity(input)
		if err != nil || actual != expected {
			t.Errorf("PURLIdentity(%q) = %q, %v, want %q", input, actual, err, expected)
		}
	}
}

type purlComponents struct {
	Type       string
	Namespace  string
	Name       string
	Version    string
	Qualifiers map[string]string
	Subpath    string
}

type purlVector struct {
	Description string
	Kind        string `json:"test_type"`
	Input       json.RawMessage
	Output      json.RawMessage `json:"expected_output"`
	Failure     bool            `json:"expected_failure"`
}

func TestUpstreamPURLIdentityVectors(t *testing.T) {
	dir := filepath.Join("..", "..", "tests", "purl", "fixtures")
	files := []string{"spec/specification-test.json", "types/generic-test.json", "types/npm-test.json", "types/golang-test.json", "types/pypi-test.json", "types/github-test.json"}
	for _, file := range files {
		t.Run(file, func(t *testing.T) {
			body, err := os.ReadFile(filepath.Join(dir, file))
			if err != nil {
				t.Fatal(err)
			}
			var fixture struct{ Tests []purlVector }
			if err := json.Unmarshal(body, &fixture); err != nil {
				t.Fatal(err)
			}
			if len(fixture.Tests) == 0 {
				t.Fatal("empty fixture")
			}
			for _, vector := range fixture.Tests {
				t.Run(vector.Kind+"/"+vector.Description, func(t *testing.T) {
					checkPURLVector(t, vector)
				})
			}
		})
	}
}

func checkPURLVector(t *testing.T, vector purlVector) {
	t.Helper()
	var input, want string
	switch vector.Kind {
	case "parse", "validate":
		if err := json.Unmarshal(vector.Input, &input); err != nil {
			t.Fatal(err)
		}
	case "build":
		var components purlComponents
		if err := json.Unmarshal(vector.Input, &components); err != nil {
			t.Fatal(err)
		}
		p := packageurl.NewPackageURL(components.Type, components.Namespace, components.Name, components.Version,
			packageurl.QualifiersFromMap(components.Qualifiers), components.Subpath)
		if err := p.Normalize(); err != nil {
			if vector.Failure {
				return
			}
			t.Fatal(err)
		}
		input = p.String()
	default:
		t.Fatalf("unexpected PURL fixture operation %q", vector.Kind)
	}
	got, err := PURLIdentity(input)
	if vector.Failure {
		if err == nil {
			t.Fatalf("accepted invalid PURL %q as %q", input, got)
		}
		return
	}
	if err != nil {
		t.Fatal(err)
	}
	if vector.Kind == "parse" {
		var expected purlComponents
		if err := json.Unmarshal(vector.Output, &expected); err != nil {
			t.Fatal(err)
		}
		want = packageurl.PackageURL{Type: expected.Type, Namespace: expected.Namespace, Name: expected.Name}.String()
	} else {
		var full string
		if err := json.Unmarshal(vector.Output, &full); err != nil {
			t.Fatal(err)
		}
		p, err := packageurl.FromString(full)
		if err != nil {
			t.Fatal(err)
		}
		want = packageurl.PackageURL{Type: p.Type, Namespace: p.Namespace, Name: p.Name}.String()
	}
	if got != want {
		t.Errorf("PURLIdentity(%q) = %q; want %q", input, got, want)
	}
}
