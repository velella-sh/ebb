package ebb

import (
	"fmt"
	"strings"
	"unicode/utf8"

	packageurl "github.com/package-url/packageurl-go"
)

// PURLIdentity parses a package URL and returns its canonical type, namespace
// and name. Version, qualifiers and subpath are deliberately omitted.
func PURLIdentity(value string) (string, error) {
	identity, _, err := purlParts(value)
	return identity, err
}

func purlParts(value string) (identity, version string, err error) {
	if !utf8.ValidString(value) {
		return "", "", fmt.Errorf("invalid PURL: expected UTF-8")
	}
	parsed, err := packageurl.FromString(value)
	if err != nil {
		return "", "", fmt.Errorf("invalid PURL: %w", err)
	}
	if !utf8.ValidString(parsed.Namespace) || !utf8.ValidString(parsed.Name) {
		return "", "", fmt.Errorf("invalid PURL: expected UTF-8 identity")
	}
	if parsed.Type == packageurl.TypeNPM {
		parsed.Namespace = strings.ToLower(parsed.Namespace)
		parsed.Name = strings.ToLower(parsed.Name)
	}
	version = parsed.Version
	parsed.Version, parsed.Qualifiers, parsed.Subpath = "", nil, ""
	return parsed.String(), version, nil
}
