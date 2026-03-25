function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// Set merchant ID in sidebar
document.addEventListener('DOMContentLoaded', () => {
  const mid = typeof MERCHANT_ID !== 'undefined' ? MERCHANT_ID : '';
  const el = document.getElementById('merchantIdText');
  if (el && mid) el.textContent = mid;
});
