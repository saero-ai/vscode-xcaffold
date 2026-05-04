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
			"type": "string",
			"enum": []string{"xcaffold/v1", "workflow/v1"}, // simplistic for now
		},
		"kind": map[string]interface{}{
			"const": ks.Kind,
		},
		"version": map[string]interface{}{
			"const": ks.Version,
		},
	}

	required := []string{"kind"} // api-version is often omitted in local manifests

	for _, f := range ks.Fields {
		if f.YAMLKey == "kind" || f.YAMLKey == "version" {
			continue
		}

		prop := map[string]interface{}{
			"description": f.Description,
		}

		switch {
		case f.XCFType == "string":
			prop["type"] = "string"
		case f.XCFType == "boolean":
			prop["type"] = "boolean"
		case f.XCFType == "int" || f.XCFType == "integer":
			prop["type"] = "integer"
		case f.XCFType == "map":
			prop["type"] = "object"
			prop["additionalProperties"] = true
		case strings.HasPrefix(f.XCFType, "[]"):
			// Support FlexStringSlice: can be a string OR an array of strings
			prop["oneOf"] = []interface{}{
				map[string]interface{}{"type": "string"},
				map[string]interface{}{
					"type":  "array",
					"items": map[string]interface{}{"type": "string"},
				},
			}
		default:
			// Fallback for complex types like HookConfig
			prop["type"] = "object"
			prop["additionalProperties"] = true
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
		"type":                 "object",
		"properties":           properties,
		"required":             required,
		"additionalProperties": false,
	}
}
