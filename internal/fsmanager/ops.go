package fsmanager

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Copy, src (dosya veya klasör) öğesini dstDir hedef dizinine, taban adını
// koruyarak kopyalar. Klasörler özyinelemeli kopyalanır.
func (m *Manager) Copy(src, dstDir string) error {
	info, err := os.Stat(src)
	if err != nil {
		return fmt.Errorf("kaynak bulunamadı: %w", err)
	}
	dst := filepath.Join(dstDir, filepath.Base(src))
	if err := ensureDifferent(src, dst); err != nil {
		return err
	}
	if info.IsDir() {
		if isSubPath(src, dstDir) {
			return fmt.Errorf("klasör kendi alt dizinine kopyalanamaz")
		}
		return copyDir(src, dst)
	}
	return copyFile(src, dst, info.Mode())
}

// Move, src öğesini dstDir hedef dizinine taşır (mümkünse rename, değilse
// kopyala-ve-sil yöntemiyle — farklı sürücüler arası için).
func (m *Manager) Move(src, dstDir string) error {
	info, err := os.Stat(src)
	if err != nil {
		return fmt.Errorf("kaynak bulunamadı: %w", err)
	}
	dst := filepath.Join(dstDir, filepath.Base(src))
	if err := ensureDifferent(src, dst); err != nil {
		return err
	}
	if info.IsDir() && isSubPath(src, dstDir) {
		return fmt.Errorf("klasör kendi alt dizinine taşınamaz")
	}
	if err := os.Rename(src, dst); err == nil {
		return nil
	}
	// Farklı sürücü: kopyala sonra sil.
	if info.IsDir() {
		if err := copyDir(src, dst); err != nil {
			return err
		}
	} else {
		if err := copyFile(src, dst, info.Mode()); err != nil {
			return err
		}
	}
	return os.RemoveAll(src)
}

// Rename, bir öğeyi aynı dizin içinde yeniden adlandırır.
func (m *Manager) Rename(path, newName string) error {
	newName = strings.TrimSpace(newName)
	if newName == "" || strings.ContainsAny(newName, `/\`) {
		return fmt.Errorf("geçersiz ad")
	}
	dst := filepath.Join(filepath.Dir(path), newName)
	if _, err := os.Stat(dst); err == nil {
		return fmt.Errorf("bu ada sahip bir öğe zaten var")
	}
	return os.Rename(path, dst)
}

// Delete, bir dosya veya klasörü (özyinelemeli) kalıcı olarak siler.
func (m *Manager) Delete(path string) error {
	return os.RemoveAll(path)
}

// Mkdir, parentDir içinde yeni bir klasör oluşturur.
func (m *Manager) Mkdir(parentDir, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || strings.ContainsAny(name, `/\`) {
		return fmt.Errorf("geçersiz klasör adı")
	}
	return os.Mkdir(filepath.Join(parentDir, name), 0o755)
}

// NewFile, parentDir içinde yeni, boş bir dosya oluşturur.
func (m *Manager) NewFile(parentDir, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || strings.ContainsAny(name, `/\`) {
		return fmt.Errorf("geçersiz dosya adı")
	}
	target := filepath.Join(parentDir, name)
	if _, err := os.Stat(target); err == nil {
		return fmt.Errorf("dosya zaten var")
	}
	f, err := os.Create(target)
	if err != nil {
		return err
	}
	return f.Close()
}

// --- yardımcılar ---

func ensureDifferent(src, dst string) error {
	if filepath.Clean(src) == filepath.Clean(dst) {
		return fmt.Errorf("kaynak ve hedef aynı")
	}
	return nil
}

// isSubPath, dir'in base'in altında (veya base'in kendisi) olup olmadığını döndürür.
func isSubPath(base, dir string) bool {
	rel, err := filepath.Rel(filepath.Clean(base), filepath.Clean(dir))
	if err != nil {
		return false
	}
	return rel == "." || (!strings.HasPrefix(rel, ".."+string(os.PathSeparator)) && rel != "..")
}

func copyFile(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_RDWR|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func copyDir(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dst, info.Mode()); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		s := filepath.Join(src, e.Name())
		d := filepath.Join(dst, e.Name())
		if e.IsDir() {
			if err := copyDir(s, d); err != nil {
				return err
			}
		} else {
			fi, err := e.Info()
			if err != nil {
				return err
			}
			if err := copyFile(s, d, fi.Mode()); err != nil {
				return err
			}
		}
	}
	return nil
}
