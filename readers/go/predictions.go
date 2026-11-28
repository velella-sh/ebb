package ebb

import (
	"fmt"
	"slices"
	"strings"
	"time"
)

// Prediction is caller-supplied planning data in the shape of Ebb's draft
// prediction profile. It is separate from published registry rules and never
// changes their lifecycle verdict.
type Prediction struct {
	PURL         string               `json:"purl"`
	Line         string               `json:"line"`
	LineVERS     string               `json:"lineVers"`
	PredictedEnd PredictedEnd         `json:"predictedEnd"`
	Confidence   string               `json:"confidence"`
	Method       string               `json:"method"`
	Evidence     []PredictionEvidence `json:"evidence"`
	ModelVersion string               `json:"modelVersion"`
	DataVersion  string               `json:"dataVersion"`
}

// PredictedEnd holds the estimated date, its range and its display precision.
type PredictedEnd struct {
	Date      string `json:"date"`
	Low       string `json:"low"`
	High      string `json:"high"`
	Precision string `json:"precision"`
}

// PredictionEvidence identifies an input used to estimate the date.
type PredictionEvidence struct {
	Kind          string `json:"kind"`
	URL           string `json:"url"`
	AccessedAt    string `json:"accessedAt"`
	Line          string `json:"line,omitempty"`
	FirstReleased string `json:"firstReleased,omitempty"`
	End           string `json:"end,omitempty"`
}

// WithPredictions attaches caller-supplied planning estimates. Check reports
// them independently when their release line matches and no matching rule
// supplies a dated end of life.
func WithPredictions(predictions ...Prediction) Option {
	return func(c *Checker) error {
		for _, p := range predictions {
			identity, err := PURLIdentity(p.PURL)
			if err != nil {
				return fmt.Errorf("prediction %q: %w", p.Line, err)
			}
			if err := validatePrediction(p); err != nil {
				return fmt.Errorf("prediction %q: %w", p.Line, err)
			}
			p.Evidence = slices.Clone(p.Evidence)
			c.predictions[identity] = append(c.predictions[identity], p)
		}
		return nil
	}
}

func validatePrediction(p Prediction) error {
	d := p.PredictedEnd
	if !calendarDay(d.Low) || !calendarDay(d.Date) || !calendarDay(d.High) ||
		d.Date < d.Low || d.Date > d.High || (d.Precision != "day" && d.Precision != "month") {
		return fmt.Errorf("expected ordered UTC dates and day or month precision")
	}
	if !slices.Contains([]string{"high", "medium", "low"}, p.Confidence) ||
		(p.Method != "policy" && p.Method != "cadence") {
		return fmt.Errorf("expected a prediction confidence and method")
	}
	if strings.TrimSpace(p.Line) == "" || strings.TrimSpace(p.LineVERS) == "" ||
		!minimumVersion.MatchString(p.ModelVersion) || strings.Contains(p.ModelVersion, "-") {
		return fmt.Errorf("expected a release line, VERS and model version")
	}
	if _, err := time.Parse("2006.01.02", p.DataVersion); err != nil {
		return fmt.Errorf("invalid prediction data version")
	}
	if len(p.Evidence) == 0 {
		return fmt.Errorf("missing prediction evidence")
	}
	for _, e := range p.Evidence {
		switch e.Kind {
		case "policy":
		case "schedule", "history":
			if strings.TrimSpace(e.Line) == "" || !monthOrDay(e.FirstReleased) {
				return fmt.Errorf("expected a release line and date for prediction history")
			}
		default:
			return fmt.Errorf("unsupported prediction evidence kind %q", e.Kind)
		}
		if !httpsURL(e.URL) || !calendarDay(e.AccessedAt) || (e.End != "" && !monthOrDay(e.End)) {
			return fmt.Errorf("invalid prediction evidence")
		}
	}
	return nil
}

func monthOrDay(value string) bool {
	if len(value) == len("2006-01") {
		_, err := time.Parse("2006-01", value)
		return err == nil
	}
	return calendarDay(value)
}
