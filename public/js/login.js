let currentOtpToken = null;

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  hideError();
}

function showError(msg) {
  const el = document.getElementById('loginError');
  document.getElementById('loginErrorText').textContent = msg;
  el.classList.remove('hidden');
}
function hideError() {
  document.getElementById('loginError').classList.add('hidden');
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('.btn-text').style.opacity = loading ? '0' : '1';
  btn.querySelector('.btn-icon').style.opacity = loading ? '0' : '1';
  const loader = btn.querySelector('.btn-loader');
  loading ? loader.classList.remove('hidden') : loader.classList.add('hidden');
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'ri-eye-line';
  } else {
    input.type = 'password';
    icon.className = 'ri-eye-off-line';
  }
}

async function doEmailLogin() {
  hideError();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) return showError('Email dan password wajib diisi.');

  setLoading('emailLoginBtn', true);
  try {
    const res = await fetch('/api/login/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success) {
      window.location.href = '/dashboard';
    } else {
      showError(data.message || 'Login gagal.');
      setLoading('emailLoginBtn', false);
    }
  } catch {
    showError('Gagal terhubung ke server.');
    setLoading('emailLoginBtn', false);
  }
}

async function doRequestOTP() {
  hideError();
  const phone = document.getElementById('loginPhone').value.trim().replace(/^0/, '');
  if (!phone) return showError('Nomor HP wajib diisi.');

  setLoading('otpRequestBtn', true);
  try {
    const res = await fetch('/api/login/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, country_code: '62' }),
    });
    const data = await res.json();
    if (data.success) {
      currentOtpToken = data.data?.otp_token || data.data?.token || null;
      document.getElementById('otp-step-1').classList.add('hidden');
      document.getElementById('otp-step-2').classList.remove('hidden');
      setTimeout(() => document.getElementById('loginOTP')?.focus(), 100);
    } else {
      showError(data.message || 'Gagal mengirim OTP.');
    }
  } catch {
    showError('Gagal terhubung ke server.');
  }
  setLoading('otpRequestBtn', false);
}

async function doVerifyOTP() {
  hideError();
  const otp = document.getElementById('loginOTP').value.trim();
  if (!otp || otp.length < 4) return showError('Masukkan kode OTP yang valid.');
  if (!currentOtpToken) return showError('Token OTP tidak ditemukan. Ulangi.');

  setLoading('otpVerifyBtn', true);
  try {
    const res = await fetch('/api/login/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, otp_token: currentOtpToken }),
    });
    const data = await res.json();
    if (data.success) {
      window.location.href = '/dashboard';
    } else {
      showError(data.message || 'OTP tidak valid.');
      setLoading('otpVerifyBtn', false);
    }
  } catch {
    showError('Gagal terhubung ke server.');
    setLoading('otpVerifyBtn', false);
  }
}

function backOTPStep1() {
  document.getElementById('otp-step-1').classList.remove('hidden');
  document.getElementById('otp-step-2').classList.add('hidden');
  document.getElementById('loginOTP').value = '';
  currentOtpToken = null;
  hideError();
}

// Enter key support
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const activeTab = document.querySelector('.tab-panel.active')?.id;
  if (activeTab === 'tab-email') doEmailLogin();
  else if (activeTab === 'tab-otp') {
    const step2Visible = !document.getElementById('otp-step-2').classList.contains('hidden');
    step2Visible ? doVerifyOTP() : doRequestOTP();
  }
});
