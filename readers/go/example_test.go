package ebb_test

import (
	"fmt"
	"os"

	ebb "github.com/velella-sh/ebb/readers/go"
)

func ExampleCheck() {
	f, err := os.Open("../../registry/go.json")
	if err != nil {
		fmt.Println(err)
		return
	}
	defer f.Close()
	data, err := ebb.LoadRegistry(f)
	if err != nil {
		fmt.Println(err)
		return
	}
	result, err := ebb.Check("pkg:generic/golang", "1.25.4", ebb.WithRegistry(data))
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println(result.Status, result.Event, result.Matches[0].Deadline)
	// Output: affected end-of-support 2026-08-19
}
