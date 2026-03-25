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
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
  } catch { return isoStr; }
}

function renderTableRows(txs) {
  if (!txs.length) {
    return `<tr><td colspan="5" class="empty-row"><i class="ri-inbox-line"></i> Tidak ada transaksi</td></tr>`;
  }
  return txs.map(tx => `
    <tr>
      <td>${formatTime(tx.time)}</td>
      <td>${tx.orderId || tx.id || '–'}</td>
      <td><i class="${paymentIcon(tx.paymentType)}"></i> ${tx.paymentType || '–'}</td>
      <td><span class="tx-status ${statusClass(tx.status)}">${(tx.status || '–').toUpperCase()}</span></td>
      <td class="amount-cell">${tx.amountFormatted || 'Rp 0'}</td>
    </tr>`).join('');
}

function renderMobileCards(txs) {
  if (!txs.length) {
    return `<div class="empty-state"><i class="ri-inbox-line"></i><p>Tidak ada transaksi</p></div>`;
  }
  return txs.map(tx => `
    <div class="m-card">
      <div class="m-card-row">
        <span class="m-label"><i class="${paymentIcon(tx.paymentType)}"></i> ${tx.paymentType || '–'}</span>
        <span class="tx-status ${statusClass(tx.status)}">${(tx.status || '–').toUpperCase()}</span>
      </div>
      <div class="m-card-row">
        <span class="m-val">${tx.orderId || tx.id || '–'}</span>
        <span class="m-amount">${tx.amountFormatted || 'Rp 0'}</span>
      </div>
      <div class="m-card-row">
        <span class="m-label">🕐 ${formatTime(tx.time)}</span>
      </div>
    </div>`).join('');
}

async function loadMutasi() {
  const from = document.getElementById('filterFrom').value;
  const to = document.getElementById('filterTo').value;
  const spinner = document.getElementById('loadingSpinner');
  spinner.classList.remove('hidden');

  let url = '/api/mutasi';
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (params.toString()) url += '?' + params.toString();

  try {
    const res = await fetch(url);
    const data = await res.json();

    document.getElementById('mutasiTotal').textContent = data.total || 'Rp 0';
    document.getElementById('mutasiCount').textContent = data.count || 0;

    const txs = data.transactions || [];
    document.getElementById('mutasiTableBody').innerHTML = renderTableRows(txs);
    document.getElementById('mutasiMobileCards').innerHTML = renderMobileCards(txs);
  } catch (e) {
    console.error('Mutasi load error:', e);
  } finally {
    spinner.classList.add('hidden');
  }
}

function resetFilter() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('filterFrom').value = today;
  document.getElementById('filterTo').value = today;
  loadMutasi();
}

function showToast(msg) {
  const toast = document.getElementById('newTxToast');
  document.getElementById('toastText').textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function initSSE() {
  const indicator = document.getElementById('liveIndicator');
  try {
    const es = new EventSource('/api/mutasi/stream');
    es.addEventListener('connected', () => {
      if (indicator) indicator.style.opacity = '1';
    });
    es.addEventListener('transaction', (e) => {
      const tx = JSON.parse(e.data);
      showToast(`${tx.amountFormatted || 'Transaksi'} masuk — ${tx.paymentType || ''}`);
      loadMutasi();
    });
    es.onerror = () => {
      if (indicator) indicator.style.opacity = '0.4';
    };
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('filterFrom').value = today;
  document.getElementById('filterTo').value = today;
  loadMutasi();
  initSSE();
});
