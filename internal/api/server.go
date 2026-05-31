// Package api, Electron renderer'ının konuştuğu yerel HTTP + WebSocket sunucusunu
// sağlar. Tüm istekler bir oturum token'ı ile korunur; sunucu yalnız 127.0.0.1'e bağlanır.
package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"AsoTerm/internal/fsmanager"
	"AsoTerm/internal/terminal"
)

// Server, dosya ve terminal yöneticilerini HTTP/WS üzerinden sunar.
type Server struct {
	fs    *fsmanager.Manager
	term  *terminal.Manager
	token string
	hub   *Hub
}

// NewServer yeni bir API sunucusu oluşturur.
func NewServer(fs *fsmanager.Manager, term *terminal.Manager, token string) *Server {
	s := &Server{fs: fs, term: term, token: token}
	s.hub = newHub(term)
	term.SetSink(s.hub)
	return s
}

// Handler, kök http.Handler'ı (token + CORS sarmalı) döndürür.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Dosya sistemi — okuma
	mux.HandleFunc("GET /api/fs/list", s.handleList)
	mux.HandleFunc("GET /api/fs/dirs", s.handleDirs)
	mux.HandleFunc("GET /api/fs/home", s.handleHome)
	mux.HandleFunc("GET /api/fs/drives", s.handleDrives)
	mux.HandleFunc("GET /api/fs/parent", s.handleParent)
	mux.HandleFunc("GET /api/fs/read", s.handleRead)
	mux.HandleFunc("GET /api/file", s.handleFile)

	// Dosya sistemi — yazma/işlem
	mux.HandleFunc("POST /api/fs/write", s.handleWrite)
	mux.HandleFunc("POST /api/fs/copy", s.handleCopy)
	mux.HandleFunc("POST /api/fs/move", s.handleMove)
	mux.HandleFunc("POST /api/fs/delete", s.handleDelete)
	mux.HandleFunc("POST /api/fs/rename", s.handleRename)
	mux.HandleFunc("POST /api/fs/mkdir", s.handleMkdir)
	mux.HandleFunc("POST /api/fs/newfile", s.handleNewFile)

	// Terminal
	mux.HandleFunc("GET /api/shells", s.handleShells)
	mux.HandleFunc("/ws", s.hub.handleWS)

	return s.withMiddleware(mux)
}

// withMiddleware, CORS başlıkları ve token doğrulaması ekler.
func (s *Server) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if !s.authorized(r) {
			http.Error(w, "yetkisiz", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// authorized, "Authorization: Bearer <token>" başlığını veya ?token= query'sini doğrular.
func (s *Server) authorized(r *http.Request) bool {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		if strings.TrimPrefix(h, "Bearer ") == s.token {
			return true
		}
	}
	return r.URL.Query().Get("token") == s.token
}

// --- REST işleyicileri ---

func (s *Server) handleList(w http.ResponseWriter, r *http.Request) {
	entries, err := s.fs.ListDir(r.URL.Query().Get("path"))
	respond(w, entries, err)
}

func (s *Server) handleDirs(w http.ResponseWriter, r *http.Request) {
	entries, err := s.fs.ListDirsOnly(r.URL.Query().Get("path"))
	respond(w, entries, err)
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	home, err := s.fs.Home()
	respond(w, map[string]string{"path": home}, err)
}

func (s *Server) handleDrives(w http.ResponseWriter, r *http.Request) {
	respond(w, s.fs.Drives(), nil)
}

func (s *Server) handleParent(w http.ResponseWriter, r *http.Request) {
	respond(w, map[string]string{"path": s.fs.Parent(r.URL.Query().Get("path"))}, nil)
}

func (s *Server) handleShells(w http.ResponseWriter, r *http.Request) {
	respond(w, s.term.AvailableShells(), nil)
}

func (s *Server) handleRead(w http.ResponseWriter, r *http.Request) {
	content, err := s.fs.ReadText(r.URL.Query().Get("path"))
	respond(w, content, err)
}

// handleFile, ham dosyayı (Range destekli, uzantıdan Content-Type) servis eder.
func (s *Server) handleFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path gerekli", http.StatusBadRequest)
		return
	}
	http.ServeFile(w, r, path)
}

func (s *Server) handleWrite(w http.ResponseWriter, r *http.Request) {
	var body struct{ Path, Content string }
	if !decode(w, r, &body) {
		return
	}
	respond(w, okResp(), s.fs.WriteText(body.Path, body.Content))
}

func (s *Server) handleCopy(w http.ResponseWriter, r *http.Request) {
	var body struct{ Src, Dst string }
	if !decode(w, r, &body) {
		return
	}
	respond(w, okResp(), s.fs.Copy(body.Src, body.Dst))
}

func (s *Server) handleMove(w http.ResponseWriter, r *http.Request) {
	var body struct{ Src, Dst string }
	if !decode(w, r, &body) {
		return
	}
	respond(w, okResp(), s.fs.Move(body.Src, body.Dst))
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	var body struct{ Path string }
	if !decode(w, r, &body) {
		return
	}
	respond(w, okResp(), s.fs.Delete(body.Path))
}

func (s *Server) handleRename(w http.ResponseWriter, r *http.Request) {
	var body struct{ Path, Name string }
	if !decode(w, r, &body) {
		return
	}
	respond(w, okResp(), s.fs.Rename(body.Path, body.Name))
}

func (s *Server) handleMkdir(w http.ResponseWriter, r *http.Request) {
	var body struct{ Dir, Name string }
	if !decode(w, r, &body) {
		return
	}
	respond(w, okResp(), s.fs.Mkdir(body.Dir, body.Name))
}

func (s *Server) handleNewFile(w http.ResponseWriter, r *http.Request) {
	var body struct{ Dir, Name string }
	if !decode(w, r, &body) {
		return
	}
	respond(w, okResp(), s.fs.NewFile(body.Dir, body.Name))
}

// --- yardımcılar ---

func okResp() map[string]bool { return map[string]bool{"ok": true} }

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		http.Error(w, "geçersiz istek gövdesi", http.StatusBadRequest)
		return false
	}
	return true
}

func respond(w http.ResponseWriter, data any, err error) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(data)
}
