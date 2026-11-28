package ebb

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"slices"
	"strings"
	"time"
)

const maxDocumentBytes = 16 << 20

var (
	// ErrDigestMismatch means the transport, a file, or the content digest did not verify.
	ErrDigestMismatch = errors.New("Ebb digest mismatch")
	registryPath      = regexp.MustCompile(`^registry/[a-z0-9][a-z0-9-]*\.json$`)
	ecosystemName     = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)
	releaseVersion    = regexp.MustCompile(`^[0-9]{4}\.[0-9]{2}\.[0-9]{2}(\.[1-9][0-9]*)?$`)
	minimumVersion    = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$`)
)

// Registry is an Ebb v2 registry envelope. Rules are preserved as JSON for
// the caller's rule validation and matching.
type Registry struct {
	SchemaVersion string            `json:"schemaVersion"`
	Ecosystem     string            `json:"ecosystem"`
	Rules         []json.RawMessage `json:"rules"`
}

// Bundle is a verified Ebb data bundle. Files contains the JSON listed in
// the manifest, keyed by relative bundle path.
type Bundle struct {
	SchemaVersion string
	Version       string
	ContentDigest string
	Files         map[string]json.RawMessage
}

type bundleEntry struct {
	Path          string `json:"path"`
	Kind          string `json:"kind"`
	Ecosystem     string `json:"ecosystem"`
	SchemaVersion string `json:"schemaVersion"`
	Rules         *int   `json:"rules"`
	SHA256        string `json:"sha256"`
	Bytes         int    `json:"bytes"`
}

type bundleWire struct {
	Manifest struct {
		SchemaVersion     string            `json:"schemaVersion"`
		Sequence          int64             `json:"sequence"`
		Version           string            `json:"version"`
		CreatedAt         string            `json:"createdAt"`
		MinimumEbbVersion string            `json:"minimumEbbVersion"`
		ContentDigest     string            `json:"contentDigest"`
		Files             []bundleEntry     `json:"files"`
		Digests           map[string]string `json:"digests"`
		DigestList        []string          `json:"digestList"`
	} `json:"manifest"`
	Files map[string]json.RawMessage `json:"files"`
}

// LoadRegistry reads a v2 registry from r, with a maximum size of 16 MiB.
func LoadRegistry(r io.Reader) (*Registry, error) {
	raw, err := readDocument(r)
	if err != nil {
		return nil, err
	}
	document, err := decodeDocument(raw)
	if err != nil {
		return nil, err
	}
	return loadRegistry(raw, document)
}

func loadRegistry(raw []byte, document map[string]any) (*Registry, error) {
	if !onlyFields(document, "schemaVersion", "ecosystem", "freshness", "rules") {
		return nil, errors.New("unexpected Ebb registry field")
	}
	var registry Registry
	if err := json.Unmarshal(raw, &registry); err != nil {
		return nil, fmt.Errorf("decode Ebb registry: %w", err)
	}
	if registry.SchemaVersion != "ebb.registry.v2" || !ecosystemName.MatchString(registry.Ecosystem) || registry.Rules == nil {
		return nil, errors.New("expected Ebb registry v2 with an ecosystem and rules array")
	}
	for _, rule := range registry.Rules {
		if len(rule) == 0 || rule[0] != '{' {
			return nil, errors.New("Ebb registry rules must be JSON objects")
		}
	}
	return &registry, nil
}

// LoadBundle reads a v1 or v2 bundle from r, with a maximum size of 16 MiB.
// expectedSHA256 is the trusted SHA-256 of its exact bytes (with an optional
// "sha256:" prefix). Obtain it through authenticated release verification.
// The reader also checks the files and content address in the manifest.
func LoadBundle(r io.Reader, expectedSHA256 string) (*Bundle, error) {
	expected, err := hex.DecodeString(strings.TrimPrefix(expectedSHA256, "sha256:"))
	if err != nil || len(expected) != sha256.Size {
		return nil, errors.New("expected a trusted SHA-256 digest for the Ebb bundle")
	}
	raw, err := readDocument(r)
	if err != nil {
		return nil, err
	}
	actual := sha256.Sum256(raw)
	if !bytes.Equal(expected, actual[:]) {
		return nil, fmt.Errorf("%w: transport SHA-256", ErrDigestMismatch)
	}
	document, err := decodeDocument(raw)
	if err != nil {
		return nil, err
	}
	manifestJSON, ok := document["manifest"].(map[string]any)
	if !ok || len(document) != 2 {
		return nil, errors.New("expected the Ebb bundle manifest and files")
	}
	allowed := []string{"schemaVersion", "version", "createdAt", "minimumEbbVersion", "contentDigest", "files"}
	if manifestJSON["schemaVersion"] == "ebb.data-bundle.v2" {
		allowed = append(allowed, "sequence", "ecosystem", "digests", "digestList")
	}
	if !onlyFields(manifestJSON, allowed...) {
		return nil, errors.New("unexpected Ebb bundle manifest field")
	}
	entries, ok := manifestJSON["files"].([]any)
	if !ok {
		return nil, errors.New("expected the Ebb bundle manifest entries")
	}
	for _, entry := range entries {
		fields, ok := entry.(map[string]any)
		if !ok || !onlyFields(fields, "path", "kind", "ecosystem", "schemaVersion", "rules", "maxReviewAgeDays", "sha256", "bytes") {
			return nil, errors.New("unexpected Ebb bundle manifest entry field")
		}
	}

	var bundle bundleWire
	if err := json.Unmarshal(raw, &bundle); err != nil {
		return nil, fmt.Errorf("decode Ebb bundle: %w", err)
	}
	manifest := bundle.Manifest
	if manifest.SchemaVersion != "ebb.data-bundle.v1" && manifest.SchemaVersion != "ebb.data-bundle.v2" {
		return nil, fmt.Errorf("unsupported Ebb bundle format %q", manifest.SchemaVersion)
	}
	if manifest.SchemaVersion == "ebb.data-bundle.v2" && manifest.Sequence < 1 {
		return nil, errors.New("Ebb bundle v2 needs a positive sequence")
	}
	if !releaseVersion.MatchString(manifest.Version) {
		return nil, errors.New("invalid Ebb bundle release version")
	}
	if _, err := time.Parse("2006.01.02", manifest.Version[:10]); err != nil {
		return nil, fmt.Errorf("invalid Ebb bundle release date: %w", err)
	}
	if _, err := time.Parse("2006-01-02T15:04:05Z", manifest.CreatedAt); err != nil {
		return nil, fmt.Errorf("invalid Ebb bundle creation date: %w", err)
	}
	if !minimumVersion.MatchString(manifest.MinimumEbbVersion) {
		return nil, errors.New("invalid Ebb bundle minimum reader version")
	}

	decodedFiles, ok := document["files"].(map[string]any)
	if !ok || len(manifest.Files) == 0 || len(manifest.Files) != len(decodedFiles) {
		return nil, errors.New("Ebb bundle file set differs from manifest")
	}
	lines := make([]string, 0, len(manifest.Files))
	seen := make(map[string]bool, len(manifest.Files))
	for _, entry := range manifest.Files {
		file, ok := decodedFiles[entry.Path].(map[string]any)
		if !ok || !registryPath.MatchString(entry.Path) || seen[entry.Path] {
			return nil, fmt.Errorf("missing, invalid or duplicate Ebb bundle file %q", entry.Path)
		}
		seen[entry.Path] = true
		canonical, err := appendCanonical(nil, file)
		if err != nil {
			return nil, fmt.Errorf("canonicalize %s: %w", entry.Path, err)
		}
		checksum := sha256.Sum256(canonical)
		if hex.EncodeToString(checksum[:]) != entry.SHA256 || len(canonical) != entry.Bytes {
			return nil, fmt.Errorf("%w: file %s", ErrDigestMismatch, entry.Path)
		}
		if manifest.Digests != nil && manifest.Digests[entry.Path] != entry.SHA256 {
			return nil, fmt.Errorf("%w: digest index for %s", ErrDigestMismatch, entry.Path)
		}
		if err := verifyFileKind(entry, bundle.Files[entry.Path], file); err != nil {
			return nil, fmt.Errorf("%s: %w", entry.Path, err)
		}
		lines = append(lines, entry.Path+" "+entry.SHA256)
	}
	slices.Sort(lines)
	if (manifest.Digests != nil && len(manifest.Digests) != len(lines)) ||
		(manifest.DigestList != nil && !slices.Equal(manifest.DigestList, lines)) {
		return nil, fmt.Errorf("%w: manifest digest index", ErrDigestMismatch)
	}
	content := sha256.Sum256([]byte(strings.Join(lines, "\n") + "\n"))
	if "sha256:"+hex.EncodeToString(content[:]) != manifest.ContentDigest {
		return nil, fmt.Errorf("%w: bundle content address", ErrDigestMismatch)
	}
	return &Bundle{
		SchemaVersion: manifest.SchemaVersion,
		Version:       manifest.Version,
		ContentDigest: manifest.ContentDigest,
		Files:         bundle.Files,
	}, nil
}

func verifyFileKind(entry bundleEntry, raw []byte, document map[string]any) error {
	switch entry.Kind {
	case "registry":
		registry, err := loadRegistry(raw, document)
		if err != nil {
			return err
		}
		if entry.Rules == nil || len(registry.Rules) != *entry.Rules ||
			registry.Ecosystem != entry.Ecosystem || registry.SchemaVersion != entry.SchemaVersion {
			return errors.New("registry does not agree with manifest")
		}
	case "sha-map":
		// The directory is verified; this reader need not interpret auxiliary maps.
	default:
		return fmt.Errorf("unsupported bundle file kind %q", entry.Kind)
	}
	return nil
}

func onlyFields(document map[string]any, names ...string) bool {
	// encoding/json matches struct field names case-insensitively. The wire
	// format uses exact field names, and aliases could replace verified data.
	for name := range document {
		if !slices.Contains(names, name) {
			return false
		}
	}
	return true
}

func readDocument(r io.Reader) ([]byte, error) {
	if r == nil {
		return nil, errors.New("Ebb document reader is nil")
	}
	raw, err := io.ReadAll(io.LimitReader(r, maxDocumentBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read Ebb document: %w", err)
	}
	if len(raw) > maxDocumentBytes {
		return nil, errors.New("Ebb document exceeds 16 MiB")
	}
	return raw, nil
}
