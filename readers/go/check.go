package ebb

import (
	"bytes"
	"cmp"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"
)

// Status describes the coverage result for the requested version.
type Status string

const (
	// Affected means one or more lifecycle rules matched.
	Affected Status = "affected"
	// NotAffected means the supplied data knows the component but no rule matched.
	NotAffected Status = "not-affected"
	// Unknown means the supplied data has no package-level rule for this component.
	Unknown Status = "unknown"
)

// Evidence is an authoritative source attached to a registry rule.
type Evidence struct {
	Title      string `json:"title"`
	URL        string `json:"url"`
	AccessedAt string `json:"accessedAt"`
	ArchiveURL string `json:"archiveUrl,omitempty"`
	ArchivedAt string `json:"archivedAt,omitempty"`
	Pointer    string `json:"pointer,omitempty"`
}

// Rule is the lifecycle claim and evidence relevant to a matched version.
type Rule struct {
	ID             string     `json:"id"`
	PURL           string     `json:"purl"`
	VERS           string     `json:"vers"`
	Event          string     `json:"event"`
	Title          string     `json:"title"`
	Summary        string     `json:"summary"`
	Severity       string     `json:"severity"`
	Deadline       string     `json:"deadline,omitempty"`
	Confidence     string     `json:"confidence,omitempty"`
	ConfidenceNote string     `json:"confidenceNote,omitempty"`
	Sources        []Evidence `json:"sources"`
}

// Result preserves the matching events and separate optional planning estimates.
type Result struct {
	PURL            string       `json:"purl"`
	Version         string       `json:"version"`
	Status          Status       `json:"status"`
	Event           string       `json:"event,omitempty"`
	Matches         []Rule       `json:"matches"`
	Predictions     []Prediction `json:"predictions,omitempty"`
	PredictionNotes []string     `json:"predictionNotes,omitempty"`
}

// Checker evaluates a supplied data snapshot. It can be reused across components.
type Checker struct {
	rules       map[string][]Rule
	predictions map[string][]Prediction
}

// Option supplies local data to Check or NewChecker.
type Option func(*Checker) error

// WithRegistry adds registry envelopes returned by LoadRegistry.
func WithRegistry(registries ...*Registry) Option {
	return func(c *Checker) error {
		for _, registry := range registries {
			if err := c.addRegistry(registry); err != nil {
				return err
			}
		}
		return nil
	}
}

// WithBundle adds the registry files from a bundle returned by LoadBundle.
func WithBundle(bundle *Bundle) Option {
	return func(c *Checker) error {
		if bundle == nil || bundle.registries == nil {
			return fmt.Errorf("expected a verified Ebb bundle from LoadBundle")
		}
		for _, verified := range bundle.registries {
			raw := bundle.Files[verified.path]
			if sha256.Sum256(raw) != verified.hash {
				return fmt.Errorf("%w: bundle registry %s changed after verification", ErrDigestMismatch, verified.path)
			}
			registry, err := LoadRegistry(bytes.NewReader(raw))
			if err != nil {
				return fmt.Errorf("load %s: %w", verified.path, err)
			}
			if err := c.addRegistry(registry); err != nil {
				return fmt.Errorf("index %s: %w", verified.path, err)
			}
		}
		return nil
	}
}

// Check evaluates one component using the caller's data. It uses the explicitly
// supplied version or, when empty, the PURL's version. Unknown is a coverage
// result and does not establish that a component is supported.
func Check(purl, version string, opts ...Option) (Result, error) {
	checker, err := NewChecker(opts...)
	if err != nil {
		return Result{}, err
	}
	return checker.Check(purl, version)
}

// NewChecker indexes caller-supplied registries and optional predictions.
func NewChecker(opts ...Option) (*Checker, error) {
	c := &Checker{rules: make(map[string][]Rule), predictions: make(map[string][]Prediction)}
	for _, apply := range opts {
		if apply == nil {
			return nil, fmt.Errorf("nil Ebb check option")
		}
		if err := apply(c); err != nil {
			return nil, err
		}
	}
	return c, nil
}

// Check evaluates a package version against this snapshot. It preserves stored
// events and calendar dates, including future dates and dates that have passed.
func (c *Checker) Check(purl, version string) (Result, error) {
	identity, embedded, err := purlParts(purl)
	if err != nil {
		return Result{}, err
	}
	version = strings.TrimSpace(version)
	if version == "" {
		version = strings.TrimSpace(embedded)
	}
	if version == "" {
		return Result{}, fmt.Errorf("%w: package version is missing", ErrInvalidVersion)
	}

	out := Result{PURL: identity, Version: version, Status: Unknown, Matches: []Rule{}}
	rules := c.rules[identity]
	if len(rules) != 0 {
		out.Status = NotAffected
	}
	datedEnd := false
	for _, rule := range rules {
		matched, err := VersContains(rule.VERS, version)
		if err != nil {
			return Result{}, fmt.Errorf("rule %s: %w", rule.ID, err)
		}
		if matched {
			rule.Sources = slices.Clone(rule.Sources)
			out.Matches = append(out.Matches, rule)
			datedEnd = datedEnd || (rule.Deadline != "" && (rule.Event == "end-of-life" || rule.Event == "scheduled-end-of-life"))
		}
	}
	if len(out.Matches) != 0 {
		slices.SortStableFunc(out.Matches, compareRules)
		out.Status, out.Event = Affected, out.Matches[0].Event
	}
	if !datedEnd {
		for _, prediction := range c.predictions[identity] {
			matched, err := VersContains(prediction.LineVERS, version)
			if err != nil {
				out.PredictionNotes = append(out.PredictionNotes, fmt.Sprintf("%s: %v", prediction.Line, err))
			} else if matched {
				prediction.Evidence = slices.Clone(prediction.Evidence)
				out.Predictions = append(out.Predictions, prediction)
			}
		}
	}
	return out, nil
}

var eventRank = map[string]int{
	"end-of-life": 1, "removed": 2, "end-of-support": 3, "deprecated": 4,
	"scheduled-end-of-life": 5, "end-of-active-support": 6, "end-of-extended-support": 7,
}

func compareRules(a, b Rule) int {
	if order := cmp.Compare(eventRank[a.Event], eventRank[b.Event]); order != 0 {
		return order
	}
	switch {
	case a.Deadline == "" && b.Deadline != "":
		return 1
	case a.Deadline != "" && b.Deadline == "":
		return -1
	default:
		return cmp.Compare(a.Deadline, b.Deadline)
	}
}

func (c *Checker) addRegistry(registry *Registry) error {
	if registry == nil || registry.SchemaVersion != "ebb.registry.v2" || registry.Rules == nil {
		return fmt.Errorf("expected an Ebb registry v2 from LoadRegistry")
	}
	for _, raw := range registry.Rules {
		var record struct {
			Rule
			Usage []struct{ Kind string } `json:"usage"`
		}
		if err := json.Unmarshal(raw, &record); err != nil {
			return fmt.Errorf("decode Ebb rule: %w", err)
		}
		packageRule := record.Usage == nil
		for _, usage := range record.Usage {
			switch usage.Kind {
			case "call", "import", "config-key":
				packageRule = true
			case "symbol":
			default:
				return fmt.Errorf("rule %q has unknown usage kind %q", record.ID, usage.Kind)
			}
		}
		if !packageRule {
			continue
		}
		identity, err := PURLIdentity(record.PURL)
		if err != nil {
			return fmt.Errorf("rule %q: %w", record.ID, err)
		}
		if err := validateRule(record.Rule); err != nil {
			return fmt.Errorf("rule %q: %w", record.ID, err)
		}
		c.rules[identity] = append(c.rules[identity], record.Rule)
	}
	return nil
}

func validateRule(r Rule) error {
	if r.ID == "" || r.VERS == "" || eventRank[r.Event] == 0 {
		return fmt.Errorf("missing ID or VERS, or an unsupported lifecycle event")
	}
	if strings.TrimSpace(r.Title) == "" || strings.TrimSpace(r.Summary) == "" ||
		!slices.Contains([]string{"info", "low", "medium", "high", "critical"}, r.Severity) {
		return fmt.Errorf("missing rule title, summary or severity")
	}
	needsDate := r.Event == "scheduled-end-of-life" || r.Event == "end-of-active-support"
	if (r.Deadline != "" || needsDate) && !calendarDay(r.Deadline) {
		return fmt.Errorf("expected a UTC calendar day for the deadline")
	}
	if !slices.Contains([]string{"", "confirmed", "likely", "tentative"}, r.Confidence) {
		return fmt.Errorf("unsupported rule confidence %q", r.Confidence)
	}
	if len(r.Sources) == 0 {
		return fmt.Errorf("missing authoritative evidence")
	}
	for _, evidence := range r.Sources {
		if strings.TrimSpace(evidence.Title) == "" || !httpsURL(evidence.URL) || !calendarDay(evidence.AccessedAt) {
			return fmt.Errorf("malformed authoritative evidence")
		}
	}
	return nil
}

func calendarDay(day string) bool {
	_, err := time.Parse(time.DateOnly, day)
	return err == nil
}

func httpsURL(text string) bool {
	u, err := url.Parse(text)
	return err == nil && u.Scheme == "https" && u.Hostname() != "" && u.User == nil
}
