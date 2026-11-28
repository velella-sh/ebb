package ebb

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"slices"
	"strconv"
	"unicode/utf16"
	"unicode/utf8"
)

func decodeDocument(raw []byte) (map[string]any, error) {
	if !utf8.Valid(raw) {
		return nil, errors.New("Ebb JSON must be UTF-8")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	value, err := decodeJSONValue(decoder, 0)
	if err != nil {
		return nil, fmt.Errorf("decode Ebb JSON: %w", err)
	}
	if _, err := decoder.Token(); err != io.EOF {
		return nil, errors.New("unexpected data after Ebb JSON document")
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, errors.New("expected an Ebb JSON object")
	}
	return object, nil
}

func decodeJSONValue(decoder *json.Decoder, depth int) (any, error) {
	if depth >= 128 {
		return nil, errors.New("Ebb JSON is nested too deeply")
	}
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	switch token {
	case json.Delim('{'):
		fields := make(map[string]any)
		for decoder.More() {
			key, err := decoder.Token()
			if err != nil {
				return nil, err
			}
			name, ok := key.(string)
			if !ok {
				return nil, errors.New("expected a JSON object key")
			}
			if _, duplicate := fields[name]; duplicate {
				return nil, fmt.Errorf("duplicate JSON key %q", name)
			}
			fields[name], err = decodeJSONValue(decoder, depth+1)
			if err != nil {
				return nil, err
			}
		}
		_, err := decoder.Token()
		return fields, err
	case json.Delim('['):
		var items []any
		for decoder.More() {
			item, err := decodeJSONValue(decoder, depth+1)
			if err != nil {
				return nil, err
			}
			items = append(items, item)
		}
		_, err := decoder.Token()
		return items, err
	default:
		return token, nil
	}
}

// appendCanonical follows the producer's canonical JSON: UTF-16 key order,
// unchanged array order, safe integers, and ordinary JSON escaping.
func appendCanonical(dst []byte, value any) ([]byte, error) {
	switch data := value.(type) {
	case nil:
		return append(dst, "null"...), nil
	case bool:
		return strconv.AppendBool(dst, data), nil
	case string:
		return appendJSONString(dst, data), nil
	case json.Number:
		number, err := data.Float64()
		if err != nil || math.Abs(number) > (1<<53)-1 || number != math.Trunc(number) {
			return nil, fmt.Errorf("canonical JSON requires a safe integer, found %s", data)
		}
		return strconv.AppendInt(dst, int64(number), 10), nil
	case []any:
		dst = append(dst, '[')
		for i, item := range data {
			if i > 0 {
				dst = append(dst, ',')
			}
			var err error
			dst, err = appendCanonical(dst, item)
			if err != nil {
				return nil, err
			}
		}
		return append(dst, ']'), nil
	case map[string]any:
		type key struct {
			value string
			order []uint16
		}
		keys := make([]key, 0, len(data))
		for field := range data {
			keys = append(keys, key{field, utf16.Encode([]rune(field))})
		}
		slices.SortFunc(keys, func(a, b key) int { return slices.Compare(a.order, b.order) })
		dst = append(dst, '{')
		for i, field := range keys {
			if i > 0 {
				dst = append(dst, ',')
			}
			dst = append(appendJSONString(dst, field.value), ':')
			var err error
			dst, err = appendCanonical(dst, data[field.value])
			if err != nil {
				return nil, err
			}
		}
		return append(dst, '}'), nil
	default:
		return nil, fmt.Errorf("unsupported canonical JSON value %T", value)
	}
}

func appendJSONString(dst []byte, value string) []byte {
	const hex = "0123456789abcdef"
	dst = append(dst, '"')
	for i := 0; i < len(value); i++ {
		c := value[i]
		switch c {
		case '"', '\\':
			dst = append(dst, '\\', c)
		case '\b':
			dst = append(dst, '\\', 'b')
		case '\f':
			dst = append(dst, '\\', 'f')
		case '\n':
			dst = append(dst, '\\', 'n')
		case '\r':
			dst = append(dst, '\\', 'r')
		case '\t':
			dst = append(dst, '\\', 't')
		default:
			if c < 0x20 {
				dst = append(dst, '\\', 'u', '0', '0', hex[c>>4], hex[c&0xf])
			} else {
				dst = append(dst, c)
			}
		}
	}
	return append(dst, '"')
}
