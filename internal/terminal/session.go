package terminal

import (
	"sync"

	"github.com/aymanbagabas/go-pty"
)

// Conn, bir terminal oturumunun altındaki taşıma katmanıdır (yerel PTY veya SSH).
type Conn interface {
	Read(p []byte) (int, error)
	Write(p []byte) (int, error)
	Resize(cols, rows int) error
	Wait() error
	Close() error
}

// Session, tek bir terminal oturumunu (yerel shell veya uzak SSH) temsil eder.
type Session struct {
	ID   string
	conn Conn

	closed bool
	mu     sync.Mutex
}

// Write, kullanıcı girdisini oturuma yazar.
func (s *Session) Write(data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	_, err := s.conn.Write(data)
	return err
}

// Resize, oturum pencere boyutunu (sütun x satır) günceller.
func (s *Session) Resize(cols, rows int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || cols <= 0 || rows <= 0 {
		return nil
	}
	return s.conn.Resize(cols, rows)
}

// Close, oturumu sonlandırır. Birden fazla çağrıya karşı güvenlidir.
func (s *Session) Close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	s.mu.Unlock()
	return s.conn.Close()
}

// --- Yerel PTY taşıması (go-pty) ---

type localConn struct {
	pty pty.Pty
	cmd *pty.Cmd
}

func (c *localConn) Read(p []byte) (int, error)  { return c.pty.Read(p) }
func (c *localConn) Write(p []byte) (int, error) { return c.pty.Write(p) }
func (c *localConn) Resize(cols, rows int) error { return c.pty.Resize(cols, rows) }
func (c *localConn) Wait() error                 { return c.cmd.Wait() }

func (c *localConn) Close() error {
	if c.cmd != nil && c.cmd.Process != nil {
		_ = c.cmd.Process.Kill()
	}
	return c.pty.Close()
}
