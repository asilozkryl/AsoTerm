package fsmanager

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCopyDoesNotOverwriteExistingFile(t *testing.T) {
	root := t.TempDir()
	srcDir := filepath.Join(root, "src")
	dstDir := filepath.Join(root, "dst")
	if err := os.MkdirAll(srcDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		t.Fatal(err)
	}

	srcFile := filepath.Join(srcDir, "note.txt")
	existing := filepath.Join(dstDir, "note.txt")
	if err := os.WriteFile(srcFile, []byte("yeni"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(existing, []byte("korunmalı"), 0o644); err != nil {
		t.Fatal(err)
	}

	m := NewManager()
	if err := m.Copy(srcFile, dstDir); err != nil {
		t.Fatalf("Copy: %v", err)
	}

	gotExisting, err := os.ReadFile(existing)
	if err != nil {
		t.Fatal(err)
	}
	if string(gotExisting) != "korunmalı" {
		t.Fatalf("mevcut dosya üzerine yazıldı: %q", gotExisting)
	}

	entries, err := os.ReadDir(dstDir)
	if err != nil {
		t.Fatal(err)
	}
	var copyName string
	for _, e := range entries {
		if e.Name() != "note.txt" {
			copyName = e.Name()
		}
	}
	if copyName == "" || !strings.Contains(copyName, "kopya") {
		t.Fatalf("çakışmasız kopya oluşmadı, girdiler: %v", names(entries))
	}
	copied, err := os.ReadFile(filepath.Join(dstDir, copyName))
	if err != nil {
		t.Fatal(err)
	}
	if string(copied) != "yeni" {
		t.Fatalf("kopya içerik hatalı: %q", copied)
	}
}

func TestMoveRefusesExistingDestination(t *testing.T) {
	root := t.TempDir()
	srcDir := filepath.Join(root, "src")
	dstDir := filepath.Join(root, "dst")
	if err := os.MkdirAll(srcDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		t.Fatal(err)
	}

	srcFile := filepath.Join(srcDir, "note.txt")
	existing := filepath.Join(dstDir, "note.txt")
	if err := os.WriteFile(srcFile, []byte("kaynak"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(existing, []byte("hedef"), 0o644); err != nil {
		t.Fatal(err)
	}

	m := NewManager()
	if err := m.Move(srcFile, dstDir); err == nil {
		t.Fatal("Move çakışmada hata döndürmedi")
	}

	got, err := os.ReadFile(existing)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "hedef" {
		t.Fatalf("hedef dosya değişti: %q", got)
	}
	if _, err := os.Stat(srcFile); err != nil {
		t.Fatalf("kaynak silinmiş edilmemeli: %v", err)
	}
}

func names(entries []os.DirEntry) []string {
	out := make([]string, len(entries))
	for i, e := range entries {
		out[i] = e.Name()
	}
	return out
}
