// Package terminal, ConPTY/PTY tabanlı çoklu terminal oturumlarını yönetir.
// Her oturum gerçek bir shell sürecidir; çıktı bir Sink üzerinden (WebSocket)
// frontend'e (xterm.js) akıtılır.
package terminal

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"sync"

	"github.com/aymanbagabas/go-pty"
)

// Sink, terminal olaylarının yayınlanacağı hedefi temsil eder (ör. WebSocket hub).
type Sink interface {
	OnData(id, b64 string)
	OnExit(id string)
}

// Manager, açık tüm terminal oturumlarını tutar ve çıktıyı Sink'e yayınlar.
type Manager struct {
	mu       sync.Mutex
	sink     Sink
	sessions map[string]*Session
	counter  int
}

// NewManager yeni bir terminal yöneticisi oluşturur.
func NewManager() *Manager {
	return &Manager{sessions: make(map[string]*Session)}
}

// SetSink, terminal çıktısının yayınlanacağı hedefi ayarlar.
func (m *Manager) SetSink(s Sink) {
	m.mu.Lock()
	m.sink = s
	m.mu.Unlock()
}

func (m *Manager) currentSink() Sink {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sink
}

// ShellInfo, kullanılabilir bir shell'i (görünen ad + yol) temsil eder.
type ShellInfo struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// AvailableShells, sistemde bulunan shell'leri döndürür (ayarlar paneli için).
func (m *Manager) AvailableShells() []ShellInfo {
	var candidates []ShellInfo
	if runtime.GOOS == "windows" {
		for _, c := range []ShellInfo{
			{"PowerShell 7", "pwsh.exe"},
			{"Windows PowerShell", "powershell.exe"},
			{"Komut İstemi", "cmd.exe"},
		} {
			if p, err := exec.LookPath(c.Path); err == nil {
				candidates = append(candidates, ShellInfo{c.Name, p})
			}
		}
	} else {
		for _, c := range []ShellInfo{
			{"bash", "bash"}, {"zsh", "zsh"}, {"fish", "fish"}, {"sh", "sh"},
		} {
			if p, err := exec.LookPath(c.Path); err == nil {
				candidates = append(candidates, ShellInfo{c.Name, p})
			}
		}
	}
	return candidates
}

// DefaultShell, platforma uygun varsayılan shell yolunu döndürür.
func (m *Manager) DefaultShell() string {
	if runtime.GOOS == "windows" {
		for _, name := range []string{"pwsh.exe", "powershell.exe", "cmd.exe"} {
			if p, err := exec.LookPath(name); err == nil {
				return p
			}
		}
		return "cmd.exe"
	}
	if sh := os.Getenv("SHELL"); sh != "" {
		return sh
	}
	return "/bin/bash"
}

// Create yeni bir PTY oturumu başlatır ve oturum ID'sini döndürür.
func (m *Manager) Create(shell, cwd string) (string, error) {
	if shell == "" {
		shell = m.DefaultShell()
	}

	ptmx, err := pty.New()
	if err != nil {
		return "", fmt.Errorf("pty oluşturulamadı: %w", err)
	}

	cmd := ptmx.Command(shell)
	if cwd != "" {
		if info, statErr := os.Stat(cwd); statErr == nil && info.IsDir() {
			cmd.Dir = cwd
		}
	}
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	if err := cmd.Start(); err != nil {
		_ = ptmx.Close()
		return "", fmt.Errorf("shell başlatılamadı (%s): %w", shell, err)
	}

	return m.register(&localConn{pty: ptmx, cmd: cmd}), nil
}

// register, bir Conn için yeni bir oturum kaydeder, okuma/bekleme döngülerini
// başlatır ve oturum ID'sini döndürür.
func (m *Manager) register(conn Conn) string {
	m.mu.Lock()
	m.counter++
	id := fmt.Sprintf("term-%d", m.counter)
	s := &Session{ID: id, conn: conn}
	m.sessions[id] = s
	m.mu.Unlock()

	go m.readLoop(s)
	go m.waitLoop(s)
	return id
}

// readLoop, PTY çıktısını okur ve Sink.OnData ile base64 olarak yayınlar.
func (m *Manager) readLoop(s *Session) {
	buf := make([]byte, 4096)
	for {
		n, err := s.conn.Read(buf)
		if n > 0 {
			if sink := m.currentSink(); sink != nil {
				sink.OnData(s.ID, base64.StdEncoding.EncodeToString(buf[:n]))
			}
		}
		if err != nil {
			return
		}
	}
}

// waitLoop, süreç sonlanınca temizlik yapar ve Sink.OnExit'i çağırır.
func (m *Manager) waitLoop(s *Session) {
	_ = s.conn.Wait()

	m.mu.Lock()
	delete(m.sessions, s.ID)
	m.mu.Unlock()

	_ = s.Close()
	if sink := m.currentSink(); sink != nil {
		sink.OnExit(s.ID)
	}
}

// Write, kullanıcı girdisini ilgili oturuma iletir.
func (m *Manager) Write(id, data string) error {
	s := m.get(id)
	if s == nil {
		return nil
	}
	return s.Write([]byte(data))
}

// Resize, oturumun PTY boyutunu günceller.
func (m *Manager) Resize(id string, cols, rows int) error {
	s := m.get(id)
	if s == nil {
		return nil
	}
	return s.Resize(cols, rows)
}

// Close, bir oturumu kapatır.
func (m *Manager) Close(id string) error {
	s := m.get(id)
	if s == nil {
		return nil
	}
	return s.Close()
}

// CloseAll, tüm oturumları kapatır.
func (m *Manager) CloseAll() {
	m.mu.Lock()
	all := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		all = append(all, s)
	}
	m.mu.Unlock()
	for _, s := range all {
		_ = s.Close()
	}
}

func (m *Manager) get(id string) *Session {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sessions[id]
}
