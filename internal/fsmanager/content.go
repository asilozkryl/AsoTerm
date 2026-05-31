package fsmanager

import (
	"fmt"
	"io"
	"os"
)

const maxTextRead = 4 << 20 // 4 MB üzeri metin dosyaları editörde kesilir

// FileContent, editör bloğuna gönderilen metin dosyası içeriğini temsil eder.
type FileContent struct {
	Path      string `json:"path"`
	Content   string `json:"content"`
	Truncated bool   `json:"truncated"`
}

// ReadText, bir metin dosyasını (en çok maxTextRead bayt) okur.
func (m *Manager) ReadText(path string) (FileContent, error) {
	f, err := os.Open(path)
	if err != nil {
		return FileContent{}, fmt.Errorf("dosya açılamadı: %w", err)
	}
	defer f.Close()

	limited := io.LimitReader(f, maxTextRead+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return FileContent{}, err
	}
	truncated := false
	if len(data) > maxTextRead {
		data = data[:maxTextRead]
		truncated = true
	}
	return FileContent{Path: path, Content: string(data), Truncated: truncated}, nil
}

// WriteText, editör içeriğini dosyaya kaydeder (mevcut dosyanın iznini korur).
func (m *Manager) WriteText(path, content string) error {
	mode := os.FileMode(0o644)
	if info, err := os.Stat(path); err == nil {
		mode = info.Mode()
	}
	return os.WriteFile(path, []byte(content), mode)
}
