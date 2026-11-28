package ebb

import (
	"bytes"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
)

const (
	registryFixture = "../../examples/registry.v2.example.json"
	fixtureFileSHA  = "ef69878fa6d757fd53be9a988ec8c5fffca37c0c5f55f6d35196b0a0d2eea63c"
	fixtureSetSHA   = "46e6b723b163b36dd9cc0085eba6693151db05a2763d99fa67598a977df89fd0"
)

func TestLoadRegistry(t *testing.T) {
	f, err := os.Open(registryFixture)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	registry, err := LoadRegistry(f)
	if err != nil {
		t.Fatal(err)
	}
	if registry.Ecosystem != "npm" || len(registry.Rules) != 2 {
		t.Fatalf("unexpected registry %s (%d rules)", registry.Ecosystem, len(registry.Rules))
	}
}

func fixtureBundle(t *testing.T, schemaVersion string) []byte {
	t.Helper()
	registry, err := os.ReadFile(registryFixture)
	if err != nil {
		t.Fatal(err)
	}
	// The bytes and digests correspond to this existing registry after the
	// producer's canonical JSON normalization, including before compacting it.
	var sequence string
	if schemaVersion == "ebb.data-bundle.v2" {
		sequence = `"sequence": 1,`
	}
	return fmt.Appendf(nil, `{
  "manifest": {
    "schemaVersion": %q,
    %s
    "version": "2026.11.28",
    "createdAt": "2026-11-28T00:00:00Z",
    "minimumEbbVersion": "0.2.0",
    "contentDigest": "sha256:%s",
    "files": [{
      "path": "registry/npm.json", "kind": "registry",
      "ecosystem": "npm", "schemaVersion": "ebb.registry.v2", "rules": 2,
      "maxReviewAgeDays": 365, "bytes": 1858, "sha256": %q
    }]
  },
  "files": {"registry/npm.json": %s}
}`, schemaVersion, sequence, fixtureSetSHA, fixtureFileSHA, registry)
}

func TestLoadBundleVerifiesTransportAndContent(t *testing.T) {
	for _, profile := range []string{"ebb.data-bundle.v1", "ebb.data-bundle.v2"} {
		t.Run(profile, func(t *testing.T) {
			raw := fixtureBundle(t, profile)
			trusted := fmt.Sprintf("sha256:%x", sha256.Sum256(raw))
			bundle, err := LoadBundle(bytes.NewReader(raw), trusted)
			if err != nil {
				t.Fatal(err)
			}
			if bundle.SchemaVersion != profile || bundle.Version != "2026.11.28" ||
				bundle.ContentDigest != "sha256:"+fixtureSetSHA || len(bundle.Files) != 1 {
				t.Fatalf("unexpected bundle %s %s %s", bundle.SchemaVersion, bundle.Version, bundle.ContentDigest)
			}

			modified := bytes.Replace(raw, []byte("request"), []byte("tampered"), 1)
			if bytes.Equal(raw, modified) {
				t.Fatal("fixture was not modified")
			}
			for name, digest := range map[string]string{
				"transport": trusted,
				"inner":     fmt.Sprintf("%x", sha256.Sum256(modified)),
			} {
				t.Run(name, func(t *testing.T) {
					result, err := LoadBundle(bytes.NewReader(modified), digest)
					if result != nil || !errors.Is(err, ErrDigestMismatch) || (name == "inner" && !strings.Contains(err.Error(), "file registry/npm.json")) {
						t.Fatalf("tampered input: got %v, %v", result, err)
					}
				})
			}
			badAddress := bytes.Replace(raw, []byte(fixtureSetSHA), []byte(strings.Repeat("0", 64)), 1)
			result, err := LoadBundle(bytes.NewReader(badAddress), fmt.Sprintf("%x", sha256.Sum256(badAddress)))
			if result != nil || !errors.Is(err, ErrDigestMismatch) || !strings.Contains(err.Error(), "content address") {
				t.Fatalf("changed content digest: got %v, %v", result, err)
			}
		})
	}
}

func TestLoadRejectsMalformedAndOversizedDocuments(t *testing.T) {
	for _, text := range []string{
		`{"schemaVersion":"ebb.registry.v2","ecosystem":"npm","ecosystem":"debian","rules":[]}`,
		`{"schemaVersion":"ebb.registry.v2","ecosystem":"npm","Rules":[]}`,
		`{"schemaVersion":"ebb.registry.v2","ecosystem":"npm","rules":null}`,
		`{"schemaVersion":"ebb.registry.v2","ecosystem":"npm","rules":[false]}`,
		`{"schemaVersion":"ebb.registry.v2","ecosystem":"npm","rules":[]} {}`,
	} {
		if result, err := LoadRegistry(strings.NewReader(text)); result != nil || err == nil {
			t.Fatalf("accepted malformed registry %s", text)
		}
	}
	stream := io.LimitReader(repeatByte{' '}, maxDocumentBytes+1)
	if result, err := LoadRegistry(stream); result != nil || err == nil || !strings.Contains(err.Error(), "16 MiB") {
		t.Fatalf("expected rejected oversized reader, got %v, %v", result, err)
	}
	if _, err := LoadBundle(strings.NewReader("{}"), "malformed"); err == nil {
		t.Fatal("bundle accepted missing expected SHA-256")
	}
	fixture := fixtureBundle(t, "ebb.data-bundle.v2")
	alias := append([]byte(`{"Files":{},`), fixture[1:]...)
	if result, err := LoadBundle(bytes.NewReader(alias), fmt.Sprintf("%x", sha256.Sum256(alias))); result != nil || err == nil {
		t.Fatalf("bundle accepted a case-insensitive files alias: %v, %v", result, err)
	}
}

type repeatByte struct{ char byte }

func (r repeatByte) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = r.char
	}
	return len(p), nil
}

func TestCanonicalBundleJSON(t *testing.T) {
	input := []byte(`{ "": 1e2, "\ud800\udc00": ["<>&", "\u2028", "\u0001", "\\u2028", -0] }`)
	object, err := decodeDocument(input)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := appendCanonical(nil, object)
	want := "{\"𐀀\":[\"<>&\",\"\u2028\",\"\\u0001\",\"\\\\u2028\",0],\"\":100}"
	if err != nil || string(raw) != want {
		t.Fatalf("canonical JSON = %q, %v; want %q", raw, err, want)
	}
}
