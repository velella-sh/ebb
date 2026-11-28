package ebb

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"
)

var (
	// ErrUnsupportedScheme identifies a VERS comparison this reader cannot evaluate.
	ErrUnsupportedScheme = errors.New("unsupported VERS scheme")
	// ErrInvalidVersion identifies an input version the applicable scheme cannot compare.
	ErrInvalidVersion = errors.New("invalid version")
	// ErrInvalidRange identifies a malformed VERS range or constraint.
	ErrInvalidRange = errors.New("invalid VERS range")
	versScheme      = regexp.MustCompile(`^[a-z][a-z0-9.+-]*$`)
)

type orderedVersion interface {
	compare(orderedVersion) int
}

type constraint struct {
	op      string
	version orderedVersion
}

func (c constraint) bound() int {
	switch c.op {
	case ">", ">=":
		return 1
	case "<", "<=":
		return -1
	default:
		return 0
	}
}

// VersContains evaluates an Ebb VERS range using SemVer (semver, npm and
// golang) or PEP 440 (pep440 and its upstream name pypi).
// A false result with a nil error means a comparable version outside the range.
func VersContains(value, version string) (bool, error) {
	scheme, body, ok := strings.Cut(strings.TrimSpace(value), "/")
	if !ok || !strings.HasPrefix(strings.ToLower(scheme), "vers:") {
		return false, fmt.Errorf("%w: expected vers:<scheme>/<constraints>", ErrInvalidRange)
	}
	scheme = strings.ToLower(scheme[5:])
	if !versScheme.MatchString(scheme) {
		return false, fmt.Errorf("%w: invalid scheme name", ErrInvalidRange)
	}
	var parse func(string) (orderedVersion, error)
	switch scheme {
	case "semver", "npm", "golang":
		parse = parseSemver
	case "pep440", "pypi":
		parse = parsePEP440
	default:
		return false, fmt.Errorf("%w: %s", ErrUnsupportedScheme, scheme)
	}
	needle, err := parse(strings.TrimSpace(version))
	if err != nil {
		return false, err
	}
	body = strings.TrimSpace(body)
	if body == "*" {
		return true, nil
	}
	constraints, err := parseConstraints(body, parse)
	if err != nil {
		return false, err
	}
	return containsVersion(constraints, needle), nil
}

func parseConstraints(body string, parse func(string) (orderedVersion, error)) ([]constraint, error) {
	var constraints []constraint
	for text := range strings.SplitSeq(body, "|") {
		text = strings.TrimSpace(text)
		op := "="
		for _, candidate := range []string{">=", "<=", "!=", ">", "<", "="} {
			if rest, found := strings.CutPrefix(text, candidate); found {
				op, text = candidate, strings.TrimSpace(rest)
				break
			}
		}
		if text == "" || strings.ContainsAny(text, "<>=*") {
			return nil, fmt.Errorf("%w: missing or malformed constraint", ErrInvalidRange)
		}
		version, err := url.PathUnescape(text)
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrInvalidRange, err)
		}
		key, err := parse(version)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidRange, err)
		}
		constraints = append(constraints, constraint{op, key})
	}
	slices.SortFunc(constraints, func(a, b constraint) int { return a.version.compare(b.version) })
	lastBound, previous := 0, ""
	for i, c := range constraints {
		if i > 0 && c.version.compare(constraints[i-1].version) == 0 {
			return nil, fmt.Errorf("%w: duplicate version in range", ErrInvalidRange)
		}
		if c.op == "!=" {
			continue
		}
		bound := c.bound()
		if bound != 0 {
			if bound == lastBound || (bound < 0 && previous == "=") {
				return nil, fmt.Errorf("%w: invalid bound sequence", ErrInvalidRange)
			}
			lastBound = bound
		}
		previous = c.op
	}
	return constraints, nil
}

func containsVersion(constraints []constraint, needle orderedVersion) bool {
	// Lower/upper bounds open and close intervals. A leading upper bound
	// starts inside, and a range of only exclusions starts inside.
	inside := true
	for _, c := range constraints {
		if bound := c.bound(); bound != 0 {
			inside = bound < 0
			break
		}
		if c.op == "=" {
			inside = false
		}
	}
	for _, c := range constraints {
		switch order := needle.compare(c.version); {
		case order < 0:
			return inside
		case order == 0:
			return c.op == "=" || c.op == "<=" || c.op == ">="
		}
		if bound := c.bound(); bound != 0 {
			inside = bound > 0
		}
	}
	return inside
}
