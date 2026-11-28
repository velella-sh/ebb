package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExampleMatchesItsDocumentedCycloneDXOutput(t *testing.T) {
	root := filepath.Join("..", "..", "..", "..")
	readme, err := os.ReadFile("README.md")
	if err != nil {
		t.Fatal(err)
	}
	var stdout, stderr bytes.Buffer
	args := []string{
		"-registry", filepath.Join(root, "registry", "npm.json"),
		"-registry", filepath.Join(root, "registry", "python.json"),
		filepath.Join(root, "examples", "cyclonedx", "bom.json"),
	}
	if err := run(args, &stdout, &stderr); err != nil {
		t.Fatalf("%v: %s", err, &stderr)
	}
	transcript := stdout.String()
	if stderr.Len() != 0 || strings.Count(transcript, "pkg:") != 3 ||
		!strings.Contains(transcript, "pkg:pypi/django@2.2.0 end-of-life 2022-04-11") ||
		!strings.Contains(string(readme), "```text\n"+transcript+"```") {
		t.Fatalf("unexpected fixture output:\n%s\n%s", transcript, &stderr)
	}
}
