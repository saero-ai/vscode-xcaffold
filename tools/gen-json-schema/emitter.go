package main

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/saero-ai/xcaffold/pkg/schema"
)

// Emit converts the xcaffold schema registry into a JSON Schema byte slice.
func Emit(registry map[string]schema.KindSchema) ([]byte, error) {
	root := map[string]interface{}{
		"$schema": "http://json-schema.org/draft-07/schema#",
		"title":   "xcaffold Manifest",
		"type":    "object",
	}

	var oneOf []interface{}
	kinds := make([]string, 0, len(registry))
	for k := range registry {
		kinds = append(kinds, k)
	}
	sort.Strings(kinds)

	for _, k := range kinds {
		ks := registry[k]
		oneOf = append(oneOf, emitKind(ks))
	}

	root["oneOf"] = oneOf
	return json.MarshalIndent(root, "", "  ")
}

func emitKind(ks schema.KindSchema) map[string]interface{} {
	properties := map[string]interface{}{
		"api-version": map[string]interface{}{
			"const": "xcaffold/v1",
		},
		"kind": map[string]interface{}{
			"const": ks.Kind,
		},
	}

	required := []string{"api-version", "kind"}

	for _, f := range ks.Fields {
		prop := map[string]interface{}{
			"description": f.Description,
		}

		switch f.XCFType {
		case "string":
			prop["type"] = "string"
		case "boolean":
			prop["type"] = "boolean"
		case "integer":
			prop["type"] = "integer"
		case "map":
			prop["type"] = "object"
		default:
			if strings.HasPrefix(f.XCFType, "[]") {
				prop["type"] = "array"
				prop["items"] = map[string]interface{}{"type": "string"} // simplistic fallback
			} else {
				prop["type"] = "string"
			}
		}

		if len(f.Enum) > 0 {
			prop["enum"] = f.Enum
		}
		if f.Pattern != "" {
			prop["pattern"] = f.Pattern
		}

		properties[f.YAMLKey] = prop
		if !f.Optional {
			required = append(required, f.YAMLKey)
		}
	}

	if ks.Format == "frontmatter+body" {
		properties["body"] = map[string]interface{}{
			"type":        "string",
			"description": "Resource body content (Markdown)",
		}
	}

	return map[string]interface{}{
		"type":       "object",
		"properties": properties,
		"required":   required,
	}
}
