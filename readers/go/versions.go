package ebb

import (
	"cmp"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

var (
	semverCore           = regexp.MustCompile(`^([0-9]+)\.([0-9]+)\.([0-9]+)(.*)$`)
	semverShort          = regexp.MustCompile(`^([0-9]+)(?:\.([0-9]+))?(-[0-9A-Za-z.-]+)?$`)
	semverIdentifierList = regexp.MustCompile(`^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$`)
	pep440Version        = regexp.MustCompile(
		`(?i)^v?(?:([0-9]+)!)?([0-9]+(?:\.[0-9]+)*)(?:[-_.]?(alpha|a|beta|b|preview|pre|c|rc)[-_.]?([0-9]+)?)?` +
			`(?:(-([0-9]+)|[-_.]?(?:post|rev|r)[-_.]?([0-9]+)?))?([-_.]?dev[-_.]?([0-9]+)?)?(?:\+([a-z0-9]+(?:[-_.][a-z0-9]+)*))?$`,
	)
)

type semverKey struct {
	core       [3]string
	prerelease []string
}

func parseSemver(value string) (orderedVersion, error) {
	bad := func() (orderedVersion, error) { return nil, fmt.Errorf("%w: SemVer %q", ErrInvalidVersion, value) }
	if len(value) > 256 {
		return bad()
	}
	text, build, hasBuild := strings.Cut(strings.TrimLeft(strings.TrimSpace(value), "v= "), "+")
	if hasBuild && !semverIdentifierList.MatchString(build) {
		return bad()
	}
	var major, minor, patch, tail string
	if full := semverCore.FindStringSubmatch(text); full != nil {
		major, minor, patch, tail = full[1], full[2], full[3], full[4]
	} else if short := semverShort.FindStringSubmatch(text); short != nil {
		major, minor, patch, tail = short[1], short[2], "0", short[3]
	} else {
		return bad()
	}
	result := semverKey{core: [3]string{decimal(major), decimal(minor), decimal(patch)}}
	if tail != "" {
		prerelease, hasHyphen := strings.CutPrefix(tail, "-")
		if !semverIdentifierList.MatchString(prerelease) ||
			(!hasHyphen && (prerelease[0] < 'A' || (prerelease[0] > 'Z' && prerelease[0] < 'a') || prerelease[0] > 'z')) {
			return bad()
		}
		result.prerelease = strings.Split(prerelease, ".")
	}
	return result, nil
}

func (a semverKey) compare(other orderedVersion) int {
	b := other.(semverKey)
	if order := slices.CompareFunc(a.core[:], b.core[:], compareDecimal); order != 0 {
		return order
	}
	if len(a.prerelease) == 0 || len(b.prerelease) == 0 {
		return cmp.Compare(len(b.prerelease), len(a.prerelease))
	}
	return slices.CompareFunc(a.prerelease, b.prerelease, func(a, b string) int {
		return compareIdentifier(a, b, -1)
	})
}

type pep440Key struct {
	epoch, preNumber, post, dev string
	release, local              []string
	pre                         int
}

func parsePEP440(value string) (orderedVersion, error) {
	part := pep440Version.FindStringSubmatch(strings.TrimSpace(value))
	if part == nil {
		return nil, fmt.Errorf("%w: PEP 440 %q", ErrInvalidVersion, value)
	}
	key := pep440Key{
		epoch: decimal(part[1]), release: strings.Split(part[2], "."), preNumber: decimal(part[4]), pre: 3,
	}
	// PEP 440 orders a dev-only release before the first prerelease stage.
	switch strings.ToLower(part[3]) {
	case "a", "alpha":
		key.pre = 0
	case "b", "beta":
		key.pre = 1
	case "c", "rc", "pre", "preview":
		key.pre = 2
	case "":
		if part[5] == "" && part[8] != "" {
			key.pre = -1
		}
	}
	if part[5] != "" {
		key.post = decimal(part[6] + part[7])
	}
	if part[8] != "" {
		key.dev = decimal(part[9])
	}
	if part[10] != "" {
		key.local = strings.FieldsFunc(strings.ToLower(part[10]), func(r rune) bool { return r == '.' || r == '-' || r == '_' })
	}
	return key, nil
}

func (a pep440Key) compare(other orderedVersion) int {
	b := other.(pep440Key)
	if order := compareDecimal(a.epoch, b.epoch); order != 0 {
		return order
	}
	for i := 0; i < max(len(a.release), len(b.release)); i++ {
		x, y := "0", "0"
		if i < len(a.release) {
			x = a.release[i]
		}
		if i < len(b.release) {
			y = b.release[i]
		}
		if order := compareDecimal(x, y); order != 0 {
			return order
		}
	}
	if order := cmp.Compare(a.pre, b.pre); order != 0 {
		return order
	}
	if order := compareDecimal(a.preNumber, b.preNumber); order != 0 {
		return order
	}
	if order := compareOptionalDecimal(a.post, b.post, -1); order != 0 {
		return order
	}
	if order := compareOptionalDecimal(a.dev, b.dev, 1); order != 0 {
		return order
	}
	return slices.CompareFunc(a.local, b.local, func(a, b string) int { return compareIdentifier(a, b, 1) })
}

func decimal(value string) string {
	value = strings.TrimLeft(value, "0")
	if value == "" {
		return "0"
	}
	return value
}

func compareDecimal(a, b string) int {
	a, b = decimal(a), decimal(b)
	if order := cmp.Compare(len(a), len(b)); order != 0 {
		return order
	}
	return cmp.Compare(a, b)
}

func compareOptionalDecimal(a, b string, absentOrder int) int {
	switch {
	case a == "" && b == "":
		return 0
	case a == "":
		return absentOrder
	case b == "":
		return -absentOrder
	default:
		return compareDecimal(a, b)
	}
}

func compareIdentifier(a, b string, numericOrder int) int {
	numeric := func(value string) bool {
		return strings.Trim(value, "0123456789") == ""
	}
	aNum, bNum := numeric(a), numeric(b)
	switch {
	case aNum && bNum:
		return compareDecimal(a, b)
	case aNum:
		return numericOrder
	case bNum:
		return -numericOrder
	default:
		return cmp.Compare(a, b)
	}
}
