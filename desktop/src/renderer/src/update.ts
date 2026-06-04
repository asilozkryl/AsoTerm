// Otomatik güncelleme akışı (renderer tarafı) — "önce sor".
// main süreci electron-updater olaylarını 'update:event' ile iletir; burada
// kullanıcıya indirme ve yeniden başlatma için onay diyalogları gösterilir.
import { confirmDialog, toast } from './dialogs';

let wired = false;
let manualCheck = false; // denetimi kullanıcı mı başlattı (sessiz açılış denetimi değil)
let downloading = false;

export function initAutoUpdate(): () => void {
  if (wired) return () => {};
  wired = true;

  const off = window.asoterm.update.on(async (ev) => {
    switch (ev.kind) {
      case 'available': {
        manualCheck = false;
        const ok = await confirmDialog(`Yeni sürüm ${ev.version} mevcut. Şimdi indirilsin mi?`);
        if (ok) {
          downloading = true;
          toast(`Sürüm ${ev.version} indiriliyor…`);
          // Hata olursa 'error' olayı (downloading=true) bilgilendirir.
          window.asoterm.update.download().catch(() => {});
        }
        break;
      }
      case 'none':
        if (manualCheck) toast('Zaten en güncel sürümü kullanıyorsunuz.');
        manualCheck = false;
        break;
      case 'progress':
        // Akışı sade tutmak için yüzde başına bildirim göstermiyoruz.
        break;
      case 'downloaded': {
        downloading = false;
        const ok = await confirmDialog(
          `Sürüm ${ev.version} indirildi. Şimdi yeniden başlatılıp kurulsun mu?`,
        );
        if (ok) window.asoterm.update.install();
        break;
      }
      case 'error':
        if (downloading) {
          downloading = false;
          toast('Güncelleme indirilemedi: ' + ev.message, true);
        } else if (manualCheck) {
          manualCheck = false;
          toast('Güncelleme denetlenemedi: ' + ev.message, true);
        }
        break;
    }
  });

  // Açılışta sessiz denetim — abonelik kurulduktan SONRA çağrılır ki olay kaçmasın.
  window.asoterm.update.check().catch(() => {});
  return off;
}

// Ayarlardan elle "güncellemeleri denetle".
export function checkForUpdatesManually(): void {
  manualCheck = true;
  toast('Güncellemeler denetleniyor…');
  window.asoterm.update
    .check()
    .then((r) => {
      if (r.ok) return; // 'available' veya 'none' olayı gelip işlenecek
      manualCheck = false;
      toast(
        r.reason === 'dev'
          ? 'Geliştirme modunda güncelleme denetimi devre dışı.'
          : 'Güncelleme denetlenemedi.',
        r.reason !== 'dev',
      );
    })
    .catch(() => {
      manualCheck = false;
    });
}
