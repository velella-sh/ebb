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
	if !utf8.ValidString(value) {
		return "", fmt.Errorf("invalid PURL: expected UTF-8")
	}
	parsed, err := packageurl.FromString(value)
	if err != nil {
		return "", fmt.Errorf("invalid PURL: %w", err)
	}
	if !utf8.ValidString(parsed.Namespace) || !utf8.ValidString(parsed.Name) {
		return "", fmt.Errorf("invalid PURL: expected UTF-8 identity")
	}
	if parsed.Type == packageurl.TypeNPM {
		parsed.Namespace = strings.ToLower(parsed.Namespace)
		parsed.Name = strings.ToLower(parsed.Name)
	}
	parsed.Version, parsed.Qualifiers, parsed.Subpath = "", nil, ""
	return parsed.String(), nil
}
