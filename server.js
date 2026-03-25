require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");
const gobiz = require("./lib/gobiz");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.userId || !req.session.loggedIn) {
    return res.redirect("/login");
  }
  next();
}

// ─── Pages ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  if (req.session.loggedIn) return res.redirect("/dashboard");
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session.loggedIn) return res.redirect("/dashboard");
  res.render("login", { error: null });
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.render("dashboard", {
    userId: req.session.userId,
    merchantId: req.session.merchantId || null,
  });
});

app.get("/mutasi", requireAuth, (req, res) => {
  res.render("mutasi", {
    userId: req.session.userId,
    merchantId: req.session.merchantId || null,
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// ─── Auth API ─────────────────────────────────────────────────────────────────

app.post("/api/login/email", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: "Email dan password wajib diisi." });

  const userId = crypto.randomUUID();
  try {
    await gobiz.emailLogin(userId, email, password);
    const merchantId = await gobiz.getMerchantId(userId);
    req.session.userId = userId;
    req.session.merchantId = merchantId;
    req.session.loggedIn = true;
    res.json({ success: true });
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || "Login gagal.";
    res.status(401).json({ success: false, message: msg });
  }
});

app.post("/api/login/otp/request", async (req, res) => {
  const { phone, country_code } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "Nomor HP wajib diisi." });

  const userId = req.session.otpUserId || crypto.randomUUID();
  req.session.otpUserId = userId;

  try {
    const data = await gobiz.requestOTP(userId, phone, country_code || "62");
    res.json({ success: true, data });
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || "Gagal kirim OTP.";
    res.status(400).json({ success: false, message: msg });
  }
});

app.post("/api/login/otp/verify", async (req, res) => {
  const { otp, otp_token } = req.body;
  const userId = req.session.otpUserId;
  if (!userId) return res.status(400).json({ success: false, message: "Session OTP tidak ditemukan." });
  if (!otp || !otp_token) return res.status(400).json({ success: false, message: "OTP dan token wajib." });

  try {
    await gobiz.verifyOTP(userId, otp, otp_token);
    const merchantId = await gobiz.getMerchantId(userId);
    req.session.userId = userId;
    req.session.merchantId = merchantId;
    req.session.loggedIn = true;
    delete req.session.otpUserId;
    res.json({ success: true });
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || "OTP tidak valid.";
    res.status(401).json({ success: false, message: msg });
  }
});

// ─── Mutasi API ───────────────────────────────────────────────────────────────

app.get("/api/mutasi", requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const userId = req.session.userId;
  const merchantId = req.session.merchantId;

  if (!merchantId) return res.status(400).json({ success: false, message: "Merchant ID tidak ditemukan." });

  const today = new Date().toISOString().slice(0, 10);
  const fromISO = from ? `${from}T00:00:00+07:00` : `${today}T00:00:00+07:00`;
  const toISO = to ? `${to}T23:59:59+07:00` : `${today}T23:59:59+07:00`;

  try {
    const data = await gobiz.searchJournals(userId, merchantId, fromISO, toISO);
    const transactions = (data.hits || []).map(gobiz.normalizeTx);
    const total = transactions.reduce((s, t) => s + (t.amount || 0), 0);
    res.json({
      success: true,
      transactions,
      total: gobiz.formatRupiah(total),
      count: transactions.length,
    });
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || "Gagal ambil mutasi.";
    res.status(500).json({ success: false, message: msg });
  }
});

// SSE stream mutasi realtime
const sseClients = new Map();

app.get("/api/mutasi/stream", requireAuth, (req, res) => {
  const userId = req.session.userId;
  const merchantId = req.session.merchantId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("connected", { message: "Stream aktif" });

  if (merchantId) {
    gobiz.startMutasiListener(userId, merchantId, (tx) => {
      send("transaction", tx);
    });
  }

  const keepAlive = setInterval(() => {
    res.write(":ping\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(keepAlive);
  });
});

app.listen(PORT, () => {
  console.log(`\n  🟢 PansaGateway running → http://localhost:${PORT}\n`);
});
