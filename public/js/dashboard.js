function paymentIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('gopay')) return 'ri-wallet-3-line';
  if (t.includes('qris')) return 'ri-qr-code-line';
  if (t.includes('bank') || t.includes('transfer')) return 'ri-bank-line';
  if (t.includes('card') || t.includes('credit')) return 'ri-bank-card-line';
  return 'ri-exchange-line';
}

function statusClass(status) {
  const s = (status || '').toLowerCase();
  if (['settlement', 'capture'].includes(s)) return 'status-settlement';
  if (s === 'pending') return 'status-pending';
  if (['deny', 'cancel', 'expire'].includes(s)) return 'status-deny';
  return 'status-unknown';
}

function formatTime(isoStr) {
  if (!isoStr) return '–';
  try {
    return new Date(isoStr).toLocaleString('id-ID', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
  } catch { return isoStr; }
}

function renderTxItem(tx) {
  return `
    <div class="tx-item">
      <div class="tx-icon"><i class="${paymentIcon(tx.paymentType)}"></i></div>
      <div class="tx-main">
        <div class="tx-order">${tx.orderId || tx.id || '–'}</div>
        <div class="tx-meta">${formatTime(tx.time)} · ${tx.paymentType || '–'}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount">${tx.amountFormatted || 'Rp 0'}</div>
        <div class="tx-status ${statusClass(tx.status)}">${(tx.status || '–').toUpperCase()}</div>
      </div>
    </div>`;
}

async function loadDashboardData() {
  try {
    const res = await fetch('/api/mutasi');
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('statTotal').textContent = data.total || 'Rp 0';
    document.getElementById('statCount').textContent = data.count || 0;
    document.getElementById('statTime').textContent = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

    const list = document.getElementById('dashTxList');
    const recent = (data.transactions || []).slice(0, 8);
    if (recent.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="ri-inbox-line"></i><p>Belum ada transaksi hari ini</p></div>`;
    } else {
      list.innerHTML = recent.map(renderTxItem).join('');
    }
  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

function initSSE() {
  const statusEl = document.getElementById('statStream');
  try {
    const es = new EventSource('/api/mutasi/stream');
    es.addEventListener('connected', () => {
      if (statusEl) statusEl.textContent = 'Terhubung ✓';
    });
    es.addEventListener('transaction', (e) => {
      const tx = JSON.parse(e.data);
      loadDashboardData();
    });
    es.onerror = () => {
      if (statusEl) statusEl.textContent = 'Reconnecting...';
    };
  } catch {
    if (statusEl) statusEl.textContent = 'Tidak tersedia';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
  initSSE();
  // Refresh every 2 minutes
  setInterval(loadDashboardData, 120_000);
});
