package api

import (
	"net/http"
	"sync"

	"AsoTerm/internal/terminal"

	"github.com/gorilla/websocket"
)

// wsMsg, renderer ile sunucu arasındaki terminal protokol mesajıdır.
type wsMsg struct {
	Type  string            `json:"type"`
	ReqID string            `json:"reqId,omitempty"`
	ID    string            `json:"id,omitempty"`
	Data  string            `json:"data,omitempty"`
	Cwd   string            `json:"cwd,omitempty"`
	Shell string            `json:"shell,omitempty"`
	SSH   *terminal.SSHOpts `json:"ssh,omitempty"`
	Cols  int               `json:"cols,omitempty"`
	Rows  int               `json:"rows,omitempty"`
	Error string            `json:"error,omitempty"`
}

// Hub, açık WebSocket bağlantılarını yönetir ve terminal.Sink'i uygular.
type Hub struct {
	term     *terminal.Manager
	upgrader websocket.Upgrader
	mu       sync.Mutex
	conns    map[*wsConn]struct{}
}

type wsConn struct {
	ws      *websocket.Conn
	writeMu sync.Mutex
}

func newHub(term *terminal.Manager) *Hub {
	return &Hub{
		term:  term,
		conns: make(map[*wsConn]struct{}),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(*http.Request) bool { return true }, // yalnız yerel
		},
	}
}

func (h *Hub) handleWS(w http.ResponseWriter, r *http.Request) {
	ws, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	c := &wsConn{ws: ws}

	h.mu.Lock()
	h.conns[c] = struct{}{}
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.conns, c)
		h.mu.Unlock()
		ws.Close()
	}()

	for {
		var msg wsMsg
		if err := ws.ReadJSON(&msg); err != nil {
			return
		}
		h.handleMsg(c, msg)
	}
}

func (h *Hub) handleMsg(c *wsConn, msg wsMsg) {
	switch msg.Type {
	case "create":
		id, err := h.term.Create(msg.Shell, msg.Cwd)
		if err != nil {
			c.send(wsMsg{Type: "error", ReqID: msg.ReqID, Error: err.Error()})
			return
		}
		c.send(wsMsg{Type: "created", ReqID: msg.ReqID, ID: id})
	case "create-ssh":
		if msg.SSH == nil {
			c.send(wsMsg{Type: "error", ReqID: msg.ReqID, Error: "ssh seçenekleri eksik"})
			return
		}
		// SSH dial bloklar → ayrı goroutine'de bağlan, sonucu asenkron bildir.
		go func(reqID string, opts terminal.SSHOpts) {
			id, err := h.term.CreateSSH(opts)
			if err != nil {
				c.send(wsMsg{Type: "error", ReqID: reqID, Error: err.Error()})
				return
			}
			c.send(wsMsg{Type: "created", ReqID: reqID, ID: id})
		}(msg.ReqID, *msg.SSH)
	case "input":
		_ = h.term.Write(msg.ID, msg.Data)
	case "resize":
		_ = h.term.Resize(msg.ID, msg.Cols, msg.Rows)
	case "close":
		_ = h.term.Close(msg.ID)
	}
}

// --- terminal.Sink uygulaması (tüm bağlantılara yayınlar) ---

func (h *Hub) OnData(id, b64 string) {
	h.broadcast(wsMsg{Type: "data", ID: id, Data: b64})
}

func (h *Hub) OnExit(id string) {
	h.broadcast(wsMsg{Type: "exit", ID: id})
}

func (h *Hub) broadcast(msg wsMsg) {
	h.mu.Lock()
	conns := make([]*wsConn, 0, len(h.conns))
	for c := range h.conns {
		conns = append(conns, c)
	}
	h.mu.Unlock()
	for _, c := range conns {
		c.send(msg)
	}
}

func (c *wsConn) send(msg wsMsg) {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	_ = c.ws.WriteJSON(msg)
}
