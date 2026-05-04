package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/saero-ai/xcaffold/pkg/schema"
)

func main() {
	outPath := flag.String("out", "xcaffold-schema.json", "output path for JSON Schema")
	flag.Parse()

	if err := run(*outPath); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run(outPath string) error {
	data, err := Emit(schema.Registry)
	if err != nil {
		return fmt.Errorf("emit schema: %w", err)
	}

	return os.WriteFile(outPath, data, 0644)
}
