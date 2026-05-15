package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/xeipuuv/gojsonschema"
	"gopkg.in/yaml.v3"
)

func TestIntegration_GoldenManifest(t *testing.T) {
	schemaPath := "../../schemas/xcaffold-schema.json"
	goldenPath := filepath.Join("testdata", "agent.xcaf")

	// 1. Read and parse golden manifest (frontmatter + body)
	content, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("Failed to read golden manifest: %v", err)
	}

	// Simple frontmatter parser
	parts := strings.Split(string(content), "---")
	if len(parts) < 3 {
		t.Fatalf("Unexpected golden manifest format (need 3 parts separated by ---)")
	}

	yamlPart := parts[1]
	bodyPart := strings.TrimSpace(strings.Join(parts[2:], "---"))

	var manifest map[string]interface{}
	if err := yaml.Unmarshal([]byte(yamlPart), &manifest); err != nil {
		t.Fatalf("Failed to parse YAML part: %v", err)
	}
	manifest["body"] = bodyPart

	// 2. Load schema
	schemaLoader := gojsonschema.NewReferenceLoader("file://" + filepath.ToSlash(filepath.Clean(schemaPath)))
	
	// 3. Load document (convert map to JSON first)
	manifestJSON, _ := json.Marshal(manifest)
	documentLoader := gojsonschema.NewStringLoader(string(manifestJSON))

	// 4. Validate
	result, err := gojsonschema.Validate(schemaLoader, documentLoader)
	if err != nil {
		t.Fatalf("Validation failed with error: %v", err)
	}

	if !result.Valid() {
		fmt.Printf("Schema validation errors for %s:\n", goldenPath)
		for _, desc := range result.Errors() {
			fmt.Printf("- %s\n", desc)
		}
		t.Errorf("Manifest is not valid against schema")
	}
}
