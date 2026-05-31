// asoterm-server, Electron renderer'ı için yerel HTTP+WebSocket sidecar sunucusudur.
// Başlangıçta {"port":N,"token":"..."} satırını stdout'a yazar; ebeveyn süreç
// (Electron) kapanıp stdin EOF olunca kendini sonlandırır.
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"

	"AsoTerm/internal/api"
	"AsoTerm/internal/fsmanager"
	"AsoTerm/internal/terminal"
)

func main() {
	token := newToken()

	fsMgr := fsmanager.NewManager()
	termMgr := terminal.NewManager()
	srv := api.NewServer(fsMgr, termMgr, token)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintln(os.Stderr, "dinlenemiyor:", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port

	// Electron main bu satırı okuyup port ve token'ı öğrenir.
	info, _ := json.Marshal(map[string]any{"port": port, "token": token})
	fmt.Println(string(info))

	// Ebeveyn süreç kapanınca (stdin EOF) temiz çık.
	go func() {
		_, _ = io.Copy(io.Discard, os.Stdin)
		termMgr.CloseAll()
		os.Exit(0)
	}()

	if err := http.Serve(ln, srv.Handler()); err != nil {
		fmt.Fprintln(os.Stderr, "sunucu hatası:", err)
		os.Exit(1)
	}
}

func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
