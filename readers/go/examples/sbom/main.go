package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	ebb "github.com/velella-sh/ebb/readers/go"
)

type component struct {
	PURL       string      `json:"purl"`
	Version    string      `json:"version"`
	Components []component `json:"components"`
}

type cyclonedx struct {
	Format      string `json:"bomFormat"`
	SpecVersion string `json:"specVersion"`
	Metadata    struct {
		Component *component `json:"component"`
	} `json:"metadata"`
	Components []component `json:"components"`
}

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("ebb-cyclonedx", flag.ContinueOnError)
	flags.SetOutput(stderr)
	bundle := flags.String("bundle", "", "local Ebb bundle JSON")
	sha := flags.String("sha256", "", "trusted SHA-256 for -bundle")
	var registries []string
	flags.Func("registry", "local Ebb registry v2 JSON (repeatable)", func(path string) error {
		if path == "" {
			return errors.New("registry path is required")
		}
		registries = append(registries, path)
		return nil
	})
	if err := flags.Parse(args); err != nil {
		return err
	}
	hasBundle, hasRegistry := *bundle != "", len(registries) != 0
	if flags.NArg() != 1 || hasBundle == hasRegistry || hasBundle != (*sha != "") {
		return errors.New("usage: ebb-cyclonedx [-registry PATH ... | -bundle PATH -sha256 DIGEST] BOM.json")
	}

	checker, err := newChecker(*bundle, *sha, registries)
	if err != nil {
		return err
	}
	f, err := os.Open(flags.Arg(0))
	if err != nil {
		return err
	}
	defer f.Close()
	return scan(f, stdout, stderr, checker)
}

func newChecker(bundle, sha string, registries []string) (*ebb.Checker, error) {
	if bundle != "" {
		f, err := os.Open(bundle)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		data, err := ebb.LoadBundle(f, sha)
		if err != nil {
			return nil, err
		}
		return ebb.NewChecker(ebb.WithBundle(data))
	}
	var datasets []*ebb.Registry
	for _, path := range registries {
		f, err := os.Open(path)
		if err != nil {
			return nil, err
		}
		registry, err := ebb.LoadRegistry(f)
		f.Close()
		if err != nil {
			return nil, fmt.Errorf("load %s: %w", path, err)
		}
		datasets = append(datasets, registry)
	}
	return ebb.NewChecker(ebb.WithRegistry(datasets...))
}

func scan(input io.Reader, stdout, stderr io.Writer, checker *ebb.Checker) error {
	const maxBOM = 16 << 20
	payload, err := io.ReadAll(io.LimitReader(input, maxBOM+1))
	if err != nil {
		return err
	}
	if len(payload) > maxBOM {
		return errors.New("CycloneDX document exceeds 16 MiB")
	}
	var bom cyclonedx
	if err := json.Unmarshal(payload, &bom); err != nil {
		return fmt.Errorf("decode CycloneDX JSON: %w", err)
	}
	if bom.Format != "CycloneDX" {
		return errors.New("expected a CycloneDX JSON document")
	}
	switch bom.SpecVersion {
	case "1.2", "1.3", "1.4", "1.5", "1.6", "1.7":
	default:
		return fmt.Errorf("unsupported CycloneDX JSON version %q", bom.SpecVersion)
	}
	failed := false
	var check func(component) error
	check = func(c component) error {
		if strings.TrimSpace(c.PURL) != "" {
			result, err := checker.Check(c.PURL, c.Version)
			if err != nil {
				failed = true
				fmt.Fprintf(stderr, "Could not evaluate %q: %v\n", c.PURL, err)
			}
			for _, rule := range result.Matches {
				if err := printFinding(stdout, result, rule); err != nil {
					return err
				}
			}
		}
		for _, child := range c.Components {
			if err := check(child); err != nil {
				return err
			}
		}
		return nil
	}
	if bom.Metadata.Component != nil {
		if err := check(*bom.Metadata.Component); err != nil {
			return err
		}
	}
	for _, c := range bom.Components {
		if err := check(c); err != nil {
			return err
		}
	}
	if failed {
		return errors.New("one or more CycloneDX components could not be evaluated")
	}
	return nil
}

func printFinding(out io.Writer, result ebb.Result, rule ebb.Rule) error {
	date := rule.Deadline
	if date != "" {
		date = " " + date
	}
	if _, err := fmt.Fprintf(out, "%s@%s %s%s\n", result.PURL, result.Version, rule.Event, date); err != nil {
		return err
	}
	for _, source := range rule.Sources {
		if _, err := fmt.Fprintf(out, "  %s (accessed %s)\n", source.URL, source.AccessedAt); err != nil {
			return err
		}
	}
	return nil
}
