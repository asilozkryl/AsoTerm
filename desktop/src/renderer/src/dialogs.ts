// Electron window.prompt'u desteklemediğinden özel modal diyalogları + toast.
// Vanilla DOM (React'ten bağımsız) — her yerden çağrılabilir.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function overlay(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.tabIndex = -1;
  return el;
}

export function promptDialog(title: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const ov = overlay();
    ov.innerHTML = `
      <div class="modal">
        <div class="modal-title">${escapeHtml(title)}</div>
        <input class="modal-input" type="text" />
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">İptal</button>
          <button class="btn btn-primary" data-act="ok">Tamam</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const input = ov.querySelector('.modal-input') as HTMLInputElement;
    input.value = defaultValue;
    input.focus();
    input.select();
    const done = (v: string | null) => {
      ov.remove();
      resolve(v);
    };
    ov.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === ov || t.dataset.act === 'cancel') done(null);
      if (t.dataset.act === 'ok') done(input.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value);
      if (e.key === 'Escape') done(null);
      e.stopPropagation();
    });
  });
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ov = overlay();
    ov.innerHTML = `
      <div class="modal">
        <div class="modal-message">${escapeHtml(message)}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="no">Hayır</button>
          <button class="btn btn-danger" data-act="yes">Evet</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    (ov.querySelector('[data-act="yes"]') as HTMLElement).focus();
    const done = (v: boolean) => {
      ov.remove();
      resolve(v);
    };
    ov.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === ov || t.dataset.act === 'no') done(false);
      if (t.dataset.act === 'yes') done(true);
    });
    ov.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') done(false);
      if (e.key === 'Enter') done(true);
    });
  });
}

export function toast(message: string, isError = false): void {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' toast-error' : '');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
