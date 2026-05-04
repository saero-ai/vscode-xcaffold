package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMain_CLI(t *testing.T) {
	tmpDir := t.TempDir()
	outPath := filepath.Join(tmpDir, "schema.json")

	// Set args
	os.Args = []string{"gen-json-schema", "-out", outPath}

	// In Task 2, we implement main() to call Emit() and write to -out.
	// Since main() calls os.Exit on error, we test the logic via run() helper.
	err := run(outPath)
	if err != nil {
		t.Fatalf("run failed: %v", err)
	}

	if _, err := os.Stat(outPath); os.IsNotExist(err) {
		t.Fatalf("output file not created: %v", err)
	}
}
