package main

import (
	"encoding/json"
	"testing"

	"github.com/saero-ai/xcaffold/pkg/schema"
)

func TestEmit_BasicKind(t *testing.T) {
	registry := map[string]schema.KindSchema{
		"agent": {
			Kind: "agent",
			Fields: []schema.Field{
				{
					YAMLKey:  "name",
					Optional: false,
				},
			},
		},
	}

	data, err := Emit(registry)
	if err != nil {
		t.Fatalf("Emit failed: %v", err)
	}

	var root map[string]interface{}
	if err := json.Unmarshal(data, &root); err != nil {
		t.Fatalf("Invalid JSON: %v", err)
	}

	// Basic validation of emitted JSON Schema structure
	if root["$schema"] != "http://json-schema.org/draft-07/schema#" {
		t.Errorf("Expected draft-07 schema, got %v", root["$schema"])
	}

	oneOf, ok := root["oneOf"].([]interface{})
	if !ok || len(oneOf) == 0 {
		t.Fatalf("Expected oneOf array for kinds, got %v", root["oneOf"])
	}
}
