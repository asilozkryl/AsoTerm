// Package fsmanager, çift panelli dosya yöneticisi için dosya sistemi
// listeleme ve işlem (kopyala/taşı/sil vb.) fonksiyonlarını sağlar.
// Tüm yollar mutlak (absolute) beklenir.
package fsmanager

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

// Manager, dosya sistemi işlemlerini Wails'e bağlanabilir metotlar olarak sunar.
type Manager struct{}

// NewManager yeni bir dosya yöneticisi oluşturur.
func NewManager() *Manager { return &Manager{} }

// Entry, bir dosya veya klasör girdisini temsil eder (frontend'e JSON olarak gider).
type Entry struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModUnix int64  `json:"modUnix"`
	Mode    string `json:"mode"`
}

// Home, kullanıcının ev dizinini döndürür.
func (m *Manager) Home() (string, error) {
	return os.UserHomeDir()
}

// Separator, platforma özgü yol ayıracını döndürür ("\\" veya "/").
func (m *Manager) Separator() string {
	return string(os.PathSeparator)
}

// Drives, Windows'ta mevcut sürücü harflerini ("C:\\" vb.) döndürür.
// Diğer platformlarda kök dizin ("/") döner.
func (m *Manager) Drives() []string {
	if runtime.GOOS != "windows" {
		return []string{"/"}
	}
	var drives []string
	for c := 'A'; c <= 'Z'; c++ {
		root := string(c) + ":\\"
		if _, err := os.Stat(root); err == nil {
			drives = append(drives, root)
		}
	}
	return drives
}

// Parent, verilen yolun üst dizinini döndürür. Kök ise aynı yolu döndürür.
func (m *Manager) Parent(path string) string {
	cleaned := filepath.Clean(path)
	parent := filepath.Dir(cleaned)
	if parent == cleaned {
		return cleaned
	}
	return parent
}

// ListDir, verilen dizindeki girdileri (önce klasörler, sonra dosyalar; ada göre
// büyük/küçük harf duyarsız sıralı) döndürür.
func (m *Manager) ListDir(path string) ([]Entry, error) {
	if path == "" {
		var err error
		path, err = os.UserHomeDir()
		if err != nil {
			return nil, err
		}
	}
	dirEntries, err := os.ReadDir(path)
	if err != nil {
		return nil, fmt.Errorf("dizin okunamadı: %w", err)
	}

	entries := make([]Entry, 0, len(dirEntries))
	for _, de := range dirEntries {
		info, infoErr := de.Info()
		if infoErr != nil {
			continue // okunamayan girdiyi atla (ör. izin yok)
		}
		entries = append(entries, Entry{
			Name:    de.Name(),
			Path:    filepath.Join(path, de.Name()),
			IsDir:   de.IsDir(),
			Size:    info.Size(),
			ModUnix: info.ModTime().Unix(),
			Mode:    info.Mode().String(),
		})
	}

	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir // klasörler önce
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	return entries, nil
}

// ListDirsOnly, ağaç görünümü için yalnızca alt klasörleri döndürür.
func (m *Manager) ListDirsOnly(path string) ([]Entry, error) {
	all, err := m.ListDir(path)
	if err != nil {
		return nil, err
	}
	dirs := make([]Entry, 0, len(all))
	for _, e := range all {
		if e.IsDir {
			dirs = append(dirs, e)
		}
	}
	return dirs, nil
}
