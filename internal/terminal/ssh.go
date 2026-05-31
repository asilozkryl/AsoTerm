package terminal

import (
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHOpts, bir SSH bağlantısı için seçenekler.
type SSHOpts struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	User       string `json:"user"`
	Password   string `json:"password"`
	KeyPath    string `json:"keyPath"`
	Passphrase string `json:"passphrase"`
}

// sshConn, SSH üzerinden bir interaktif shell taşımasıdır (Conn arayüzü).
type sshConn struct {
	client *ssh.Client
	sess   *ssh.Session
	stdin  io.WriteCloser
	stdout io.Reader
}

func (c *sshConn) Read(p []byte) (int, error)  { return c.stdout.Read(p) }
func (c *sshConn) Write(p []byte) (int, error) { return c.stdin.Write(p) }
func (c *sshConn) Resize(cols, rows int) error { return c.sess.WindowChange(rows, cols) }
func (c *sshConn) Wait() error                 { return c.sess.Wait() }

func (c *sshConn) Close() error {
	_ = c.sess.Close()
	return c.client.Close()
}

func sshAuthMethods(opts SSHOpts) ([]ssh.AuthMethod, error) {
	var methods []ssh.AuthMethod
	if opts.KeyPath != "" {
		key, err := os.ReadFile(opts.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("özel anahtar okunamadı: %w", err)
		}
		var signer ssh.Signer
		if opts.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(key, []byte(opts.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(key)
		}
		if err != nil {
			return nil, fmt.Errorf("özel anahtar ayrıştırılamadı: %w", err)
		}
		methods = append(methods, ssh.PublicKeys(signer))
	}
	if opts.Password != "" {
		methods = append(methods, ssh.Password(opts.Password))
	}
	if len(methods) == 0 {
		return nil, fmt.Errorf("kimlik doğrulama yöntemi yok (parola veya anahtar gerekli)")
	}
	return methods, nil
}

// CreateSSH, uzak bir host'a SSH ile bağlanır, interaktif bir shell açar ve
// oturum ID'sini döndürür. Çağrı bloklar (bağlantı kurulana kadar).
func (m *Manager) CreateSSH(opts SSHOpts) (string, error) {
	if opts.Port == 0 {
		opts.Port = 22
	}
	if opts.Host == "" || opts.User == "" {
		return "", fmt.Errorf("host ve kullanıcı gerekli")
	}

	auths, err := sshAuthMethods(opts)
	if err != nil {
		return "", err
	}

	config := &ssh.ClientConfig{
		User:            opts.User,
		Auth:            auths,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // v1: host anahtarı doğrulanmaz
		Timeout:         15 * time.Second,
	}

	addr := net.JoinHostPort(opts.Host, strconv.Itoa(opts.Port))
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return "", fmt.Errorf("SSH bağlanılamadı (%s): %w", addr, err)
	}

	sess, err := client.NewSession()
	if err != nil {
		_ = client.Close()
		return "", err
	}

	modes := ssh.TerminalModes{ssh.ECHO: 1, ssh.TTY_OP_ISPEED: 14400, ssh.TTY_OP_OSPEED: 14400}
	if err := sess.RequestPty("xterm-256color", 30, 80, modes); err != nil {
		_ = sess.Close()
		_ = client.Close()
		return "", fmt.Errorf("PTY istenemedi: %w", err)
	}

	stdin, err := sess.StdinPipe()
	if err != nil {
		_ = sess.Close()
		_ = client.Close()
		return "", err
	}
	stdout, err := sess.StdoutPipe()
	if err != nil {
		_ = sess.Close()
		_ = client.Close()
		return "", err
	}
	sess.Stderr = stderrToStdout{} // stderr genelde PTY'da stdout'a karışır; yine de yut

	if err := sess.Shell(); err != nil {
		_ = sess.Close()
		_ = client.Close()
		return "", fmt.Errorf("uzak shell başlatılamadı: %w", err)
	}

	return m.register(&sshConn{client: client, sess: sess, stdin: stdin, stdout: stdout}), nil
}

// stderrToStdout, uzak stderr'i yutar (PTY oturumlarında çıktı zaten stdout'tan gelir).
type stderrToStdout struct{}

func (stderrToStdout) Write(p []byte) (int, error) { return len(p), nil }
