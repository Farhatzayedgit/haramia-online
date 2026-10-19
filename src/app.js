// ===== واجهة اللعبة =====
// إعدادات مشروع فايربيز «haramia-game» — مش سرية، الحماية من قواعد الأمان (firebase/database.rules.json)
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyCj8_3j0Bf6yobxXns3bN80k3iJvzLdhp8",
  authDomain: "haramia-game.firebaseapp.com",
  databaseURL: "https://haramia-game-default-rtdb.firebaseio.com",
  projectId: "haramia-game",
  storageBucket: "haramia-game.firebasestorage.app",
  messagingSenderId: "147732133483",
  appId: "1:147732133483:web:1f531f853428d3e0eaa32e"
};
var ROOT = "haramiya"; // كل بيانات النسخة الجديدة تحت المسار ده، منفصلة عن النسخة القديمة

var ROLE = {
  thief: { name: "الحرامي", team: "thieves", color: "#C2362B" },
  traitor: { name: "الخاين", team: "village", color: "#6B2D4E" },
  cop: { name: "الضابط", team: "village", color: "#256B42" },
  doctor: { name: "الدكتور", team: "village", color: "#256B42" },
  bullet: { name: "الرصاصة الأخيرة", team: "village", color: "#256B42" },
  villager: { name: "أهل القرية", team: "village", color: "#256B42" }
};
var AV = ["#C2362B", "#256B42", "#3E6FA3", "#C98A12", "#6B2D4E", "#8A5A2E", "#2F7F7A", "#C2552B", "#5C4632", "#6E4FA0", "#3A3550", "#9C5A14"];
var BOT_NAMES = ["حمادة", "أم إبراهيم", "الحاج عبده", "شوقي", "نعمة", "بطة", "عم رجب", "زيزي", "مدحت", "فتحية", "سيد", "عزة", "كرم", "سوسن", "رمضان"];

var App = {
  mode: null, s: null, me: null, host: false, code: null, hist: [], db: null, ref: null,
  ui: { screen: "home", flipped: false, overlay: null, msgTo: null, err: "" },
  botBusy: {}
};

// ---------- تخزين ----------
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function myId() {
  var id = store("hq_pid");
  if (!id) { id = "p" + Math.random().toString(36).slice(2, 10); store("hq_pid", id); }
  return id;
}
function myName() { return store("hq_name") || ""; }
function myAv() { var v = parseInt(store("hq_av") || "0", 10); return isNaN(v) ? 0 : v; }

// ---------- أدوات ----------
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }); }
function $(sel) { return document.querySelector(sel); }
function P(id) { return App.s ? Engine.P(App.s, id) : null; }
function nm(id) { var p = P(id); return p ? esc(p.name) : "حد"; }
function toast(t) {
  var el = $("#toast"); el.textContent = t; el.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove("on"); }, 2600);
}

// ---------- أصوات بسيطة ----------
var Snd = {
  ctx: null,
  on: function () { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === "suspended") this.ctx.resume(); } catch (e) {} },
  tone: function (f, d, type, when, vol) {
    if (!this.ctx) return;
    try {
      var c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (when || 0);
      o.type = type || "triangle"; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(vol || 0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (e) {}
  },
  play: function (k) {
    var T = this;
    if (k === "tap") T.tone(660, .07, "sine", 0, .08);
    if (k === "turn") { T.tone(523, .12); T.tone(784, .18, "triangle", .1); }
    if (k === "vote") { T.tone(196, .2, "square", 0, .08); T.tone(196, .2, "square", .25, .08); }
    if (k === "out") { T.tone(330, .2, "sawtooth", 0, .1); T.tone(247, .25, "sawtooth", .18, .1); T.tone(165, .5, "sawtooth", .38, .1); }
    if (k === "saved") { [523, 659, 784, 1047].forEach(function (f, i) { T.tone(f, .18, "triangle", i * .1); }); }
    if (k === "mission") { T.tone(220, .5, "sine", 0, .12); T.tone(277, .5, "sine", .2, .1); }
    if (k === "win") { [392, 523, 659, 784, 659, 784].forEach(function (f, i) { T.tone(f, .22, "triangle", i * .13); }); }
  }
};

// ---------- حالة اللعبة ----------
function commit(ns) {
  var prev = App.s;
  App.s = Engine.norm(ns);
  if (App.mode === "online" && App.host && App.ref) App.ref.child("state").set(App.s);
  onChange(prev, App.s);
}

function receive(ns) { // للاعيبة اللي مش مضيفين
  var prev = App.s;
  App.s = Engine.norm(ns);
  onChange(prev, App.s);
}

function onChange(prev, s) {
  if (prev && s) {
    if (prev.phase !== s.phase) {
      App.ui.flipped = false; App.ui.msgTo = null;
      if (s.phase === "talk") Snd.play("turn");
      if (s.phase === "vote") Snd.play("vote");
      if (s.phase === "voteResult" && s.voteOut) Snd.play("out");
      if (s.phase === "mission") Snd.play("mission");
      if (s.phase === "missionResult") Snd.play(s.events.some(function (e) { return e.k === "killed" || e.k === "bulletMiss"; }) ? "out" : "saved");
      if (s.phase === "over") Snd.play("win");
    } else if (s.phase === "talk" && (prev.spk !== s.spk || prev.round !== s.round) && s.order[s.spk] === App.me) Snd.play("turn");
  }
  render();
  runBots();
  Voice.sync();
}

function hostApply(pid, a) {
  var s = App.s;
  if (a.type === "back") {
    if (!App.hist.length) { toast("مفيش خطوة قبل كده"); return; }
    commit(App.hist.pop()); toast("رجعنا خطوة"); return;
  }
  var ns = Engine.clone(s);
  var err = Engine.act(ns, pid, a, Date.now());
  if (err) { if (pid === App.me) toast(err); return; }
  if (JSON.stringify(ns) === JSON.stringify(s)) return;
  if (ns.phase !== s.phase || (ns.phase === "talk" && (ns.spk !== s.spk || ns.round !== s.round))) {
    App.hist.push(s); if (App.hist.length > 20) App.hist.shift();
  }
  ns.seq = (s.seq || 0) + 1;
  commit(ns);
}

function send(a) {
  Snd.on();
  if (App.host) return hostApply(App.me, a);
  if (App.mode === "online" && App.ref) App.ref.child("actions").push({ pid: App.me, a: a, t: Date.now() });
}

// ---------- الشات الصوتي ----------
// واحد بس بيتكلم في المرة (اللي عليه الدور)، فهو بس اللي بيفتح المايك ويبعت صوته للباقي.
// اللي مش دوره مبيفتحش المايك أصلًا — فمحدش يقدر يرد في دور مش دوره.
// فايربيز بيوصّل الموبايلات ببعض، والصوت نفسه بيروح مباشر بين الموبايلات.
var ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
];

var Voice = {
  mic: "idle", stream: null, pcs: {}, inPc: null, inFrom: null, sid: null, speaking: false,
  wiredCode: null, offs: [], handled: {}, wrote: [], level: 0, audio: null,

  supported: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection); },

  // بنطلب إذن المايك بدري (بعد ضغطة من اللاعب) عشان وقت دوره ميتعطّلش
  ask: function () {
    if (!this.supported()) { this.mic = "unsupported"; return; }
    if (this.mic === "ready" || this.mic === "asking") return;
    var V = this; V.mic = "asking";
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (st) {
      st.getTracks().forEach(function (t) { t.stop(); });
      V.mic = "ready"; render();
    }).catch(function () { V.mic = "denied"; render(); });
  },

  path: function (kind, to, from) { return ROOT + "/" + kind + "/" + App.code + "/" + to + (from ? "/" + from : ""); },

  audioEl: function () {
    if (!this.audio) {
      var a = document.createElement("audio");
      a.autoplay = true; a.setAttribute("playsinline", ""); a.hidden = true;
      document.body.appendChild(a); this.audio = a;
    }
    return this.audio;
  },

  wire: function () {
    if (this.wiredCode === App.code || !App.db || !App.code) return;
    this.unwire();
    this.wiredCode = App.code;
    var V = this, me = App.me;
    var r1 = App.db.ref(V.path("rtc", me));
    var h1 = r1.on("value", function (snap) {
      var obj = snap.val(); if (!obj) return;
      Object.keys(obj).forEach(function (from) {
        var m = obj[from]; if (!m || !m.sdp || !m.type) return;
        var key = from + ":" + m.type + ":" + (m.sid || "");
        if (V.handled[key]) return; V.handled[key] = 1;
        if (m.type === "offer") V.onOffer(from, m); else if (m.type === "answer") V.onAnswer(from, m);
      });
    }, function () {});
    var r2 = App.db.ref(V.path("ice", me));
    var h2 = r2.on("child_added", function (snap) {
      var v = snap.val(); snap.ref.remove().catch(function () {});
      if (!v || !v.c) return;
      var pc = V.inFrom === v.from ? V.inPc : V.pcs[v.from];
      if (pc && pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(v.c)).catch(function () {});
      else if (pc) { pc._pend = pc._pend || []; pc._pend.push(v.c); }
    }, function () {});
    V.offs = [function () { r1.off("value", h1); }, function () { r2.off("child_added", h2); }];
  },

  unwire: function () { this.offs.forEach(function (f) { try { f(); } catch (e) {} }); this.offs = []; this.wiredCode = null; },

  flushIce: function (pc) { if (pc && pc._pend) { pc._pend.forEach(function (c) { pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {}); }); pc._pend = null; } },

  sendIce: function (to, cand) {
    try { App.db.ref(this.path("ice", to)).push({ from: App.me, c: cand.toJSON ? cand.toJSON() : cand }); } catch (e) {}
  },

  onOffer: function (from, m) {
    var V = this;
    if (V.inPc) { try { V.inPc.close(); } catch (e) {} }
    var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    V.inPc = pc; V.inFrom = from;
    pc.onicecandidate = function (ev) { if (ev.candidate) V.sendIce(from, ev.candidate); };
    pc.ontrack = function (ev) { var a = V.audioEl(); a.srcObject = ev.streams[0]; var p = a.play(); if (p && p.catch) p.catch(function () {}); };
    pc.setRemoteDescription({ type: "offer", sdp: m.sdp })
      .then(function () { V.flushIce(pc); return pc.createAnswer(); })
      .then(function (ans) { return pc.setLocalDescription(ans).then(function () { return ans; }); })
      .then(function (ans) {
        V.wrote.push(V.path("rtc", from, App.me));
        return App.db.ref(V.path("rtc", from, App.me)).set({ type: "answer", sdp: ans.sdp, sid: m.sid || null });
      }).catch(function () {});
  },

  onAnswer: function (from, m) {
    var pc = this.pcs[from], V = this;
    if (!pc || pc.signalingState === "stable") return;
    pc.setRemoteDescription({ type: "answer", sdp: m.sdp }).then(function () { V.flushIce(pc); }).catch(function () {});
  },

  speak: function (sid, peers) {
    var V = this;
    if (V.speaking && V.sid === sid) return;
    V.teardown(); V.sid = sid;
    if (!V.supported()) { V.mic = "unsupported"; return; }
    V.speaking = true;
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }).then(function (st) {
      if (V.sid !== sid) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
      V.stream = st; V.mic = "ready"; V.meter(st); render();
      var track = st.getAudioTracks()[0];
      peers.forEach(function (uid) {
        var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        V.pcs[uid] = pc;
        pc.addTrack(track, st);
        pc.onicecandidate = function (ev) { if (ev.candidate) V.sendIce(uid, ev.candidate); };
        pc.createOffer().then(function (off) { return pc.setLocalDescription(off).then(function () { return off; }); })
          .then(function (off) {
            V.wrote.push(V.path("rtc", uid, App.me));
            return App.db.ref(V.path("rtc", uid, App.me)).set({ type: "offer", sdp: off.sdp, sid: sid });
          }).catch(function () {});
      });
    }).catch(function () { V.mic = "denied"; V.speaking = false; render(); });
  },

  meter: function (st) {
    var V = this;
    try {
      Snd.on(); if (!Snd.ctx) return;
      var src = Snd.ctx.createMediaStreamSource(st), an = Snd.ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      var buf = new Uint8Array(an.frequencyBinCount);
      (function tick() {
        if (!V.speaking || V.stream !== st) return;
        an.getByteFrequencyData(buf); var sum = 0; for (var i = 0; i < buf.length; i++) sum += buf[i];
        V.level = Math.min(1, sum / buf.length / 60);
        var bar = document.querySelector("[data-mic]"); if (bar) bar.style.width = Math.round(V.level * 100) + "%";
        requestAnimationFrame(tick);
      })();
    } catch (e) {}
  },

  teardown: function () {
    var V = this;
    V.wrote.forEach(function (p) { try { App.db && App.db.ref(p).remove().catch(function () {}); } catch (e) {} });
    V.wrote = [];
    Object.keys(V.pcs).forEach(function (u) { try { V.pcs[u].close(); } catch (e) {} });
    V.pcs = {};
    if (V.inPc) { try { V.inPc.close(); } catch (e) {} V.inPc = null; V.inFrom = null; }
    if (V.stream) { V.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} }); V.stream = null; }
    if (V.audio) { try { V.audio.srcObject = null; } catch (e) {} }
    V.speaking = false; V.level = 0;
  },

  // بيتنادى مع كل تحديث: يظبط الصوت على حسب مين عليه الدور
  sync: function () {
    var s = App.s;
    if (App.mode !== "online" || !s || !s.cfg.voice || s.phase !== "talk" || !App.db) {
      if (this.speaking || this.inPc) this.teardown();
      if (App.mode !== "online") this.unwire();
      return;
    }
    this.wire();
    var sp = s.order[s.spk];
    var sid = s.day + "-" + s.round + "-" + s.spk + "-" + sp;
    if (sp === App.me) {
      if (this.sid !== sid || !this.speaking) {
        var peers = s.players.filter(function (p) { return p.id !== App.me && !p.bot; }).map(function (p) { return p.id; });
        this.speak(sid, peers);
      }
    } else {
      if (this.speaking) this.teardown();
      this.sid = sid;
    }
  }
};

function voiceLine(sp) {
  var s = App.s;
  if (App.mode !== "online" || !s.cfg.voice) return "";
  var V = Voice;
  if (V.mic === "unsupported") return '<div class="vline off">الموبايل ده مش بيدعم الشات الصوتي</div>';
  if (sp === App.me) {
    if (V.mic === "denied") return '<div class="vline off">المايك مقفول — اسمح للأبليكيشن يستخدم المايك من إعدادات الموبايل</div>';
    return '<div class="vline on"><span>المايك مفتوح — الكل سامعك</span><div class="vmeter"><i data-mic></i></div></div>';
  }
  return '<div class="vline">بتسمع صوت ' + nm(sp) + " — المايك بتاعك مقفول لحد دورك</div>";
}

// ---------- البوتات (وضع التجربة) ----------
function runBots() {
  if (App.mode !== "local" || !App.s) return;
  App.s.players.forEach(function (b) {
    if (!b.bot || App.botBusy[b.id]) return;
    if (!botAction(App.s, b)) return;
    App.botBusy[b.id] = true;
    var s0 = App.s;
    var delay = s0.phase === "talk" ? 1400 + Math.random() * 1400 : 500 + Math.random() * 1500;
    setTimeout(function () {
      delete App.botBusy[b.id];
      if (App.mode !== "local") return;
      var a = botAction(App.s, Engine.P(App.s, b.id) || b);
      if (a) hostApply(b.id, a);
    }, delay);
  });
}

function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }

function botAction(s, b) {
  if (!b) return null;
  if (s.phase === "reveal" && !b.seen) return { type: "seen" };
  if (s.phase === "talk" && s.order[s.spk] === b.id) return { type: "done" };
  if (s.phase === "vote" && b.alive && !s.votes[b.id]) {
    var opts = (s.runoff || Engine.alive(s).map(function (p) { return p.id; })).filter(function (id) { return id !== b.id; });
    if (b.role === "thief") { var nt = opts.filter(function (id) { return !Engine.isThief(Engine.P(s, id)); }); if (nt.length) opts = nt; }
    if (!opts.length || Math.random() < 0.08) return { type: "vote", t: "skip" };
    return { type: "vote", t: pickOne(opts) };
  }
  if (s.phase === "lastMsg" && s.voteOut === b.id) return { type: "lastMsg" };
  if (s.phase === "mission" && b.alive && !s.mission.picks[b.id]) {
    var k = Engine.missionKind(s, b), t = Engine.validTargets(s, b);
    if (k === "bullet" && Math.random() < 0.7) return { type: "mission", t: "skip" };
    if (k === "thief") {
      var mate = s.players.filter(function (p) { return p.role === "thief" && p.id !== b.id && s.mission.picks[p.id]; })[0];
      if (mate && t.indexOf(s.mission.picks[mate.id]) >= 0) return { type: "mission", t: s.mission.picks[mate.id] };
    }
    if (!t.length) return k === "bullet" ? { type: "mission", t: "skip" } : null;
    return { type: "mission", t: pickOne(t) };
  }
  return null;
}

// ---------- بداية الأوضة ----------
function readHomeFields() {
  var n = ($("#nm") && $("#nm").value.trim()) || myName();
  if (!n) { toast("اكتب اسمك الأول"); return null; }
  store("hq_name", n);
  return n;
}

function startLocal() {
  var n = readHomeFields(); if (!n) return;
  App.mode = "local"; App.host = true; App.me = myId(); App.hist = []; App.code = null;
  var s = Engine.newRoom(App.me, n, myAv());
  var names = BOT_NAMES.slice().sort(function () { return Math.random() - .5; });
  for (var i = 0; i < 6; i++) Engine.act(s, "bot" + i, { type: "join", name: names[i], av: (i + 1) % AV.length, bot: true }, 0);
  App.ui.screen = "game";
  commit(s);
}

function addBot() {
  var s = App.s, used = s.players.map(function (p) { return p.name; });
  var name = BOT_NAMES.filter(function (n) { return used.indexOf(n) < 0; })[0] || ("بوت " + ar(s.players.length));
  var id = "bot" + Math.random().toString(36).slice(2, 7);
  hostApply(id, { type: "join", name: name, av: s.players.length % AV.length, bot: true });
}
function removeBot() {
  var bots = App.s.players.filter(function (p) { return p.bot; });
  if (!bots.length) return;
  hostApply(App.me, { type: "kick", id: bots[bots.length - 1].id });
}

function loadScript(src) {
  return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
}

function loadFb(file) {
  var v = "10.14.1";
  return loadScript("vendor/" + file).catch(function () { return loadScript("https://cdn.jsdelivr.net/npm/firebase@" + v + "/" + file); });
}

// بيشغّل فايربيز ويسجّل دخول تلقائي (مجهول) — كل لاعب ليه رقم ثابت من السيرفر
function fbReady() {
  if (!FIREBASE_CONFIG) return Promise.reject("nocfg");
  if (App.db && App.uid) return Promise.resolve(App.db);
  if (App._fbP) return App._fbP;
  App._fbP = (window.firebase && firebase.database ? Promise.resolve() :
    loadFb("firebase-app-compat.js").then(function () { return loadFb("firebase-auth-compat.js"); }).then(function () { return loadFb("firebase-database-compat.js"); }))
    .then(function () {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      var auth = firebase.auth();
      return new Promise(function (res, rej) {
        var done = false;
        var t = setTimeout(function () { if (!done) { done = true; rej("timeout"); } }, 20000);
        var off = auth.onAuthStateChanged(function (u) {
          if (u && !done) { done = true; clearTimeout(t); off(); App.uid = u.uid; App.db = firebase.database(); res(App.db); }
        });
        if (!auth.currentUser) auth.signInAnonymously().catch(function (e) { if (!done) { done = true; clearTimeout(t); rej(e); } });
      });
    });
  App._fbP.catch(function () { App._fbP = null; });
  return App._fbP;
}

function onlineError(e) {
  var m = String((e && (e.code || e.message)) || e || "");
  if (e === "nocfg") showOverlay("online");
  else if (/permission/i.test(m)) toast("السيرفر رافض — قواعد الحماية لسه متحطّتش في فايربيز");
  else if (/admin-restricted|operation-not-allowed/i.test(m)) toast("الدخول المجهول مقفول في فايربيز — لازم يتفعّل");
  else toast("مش قادرين نوصل للسيرفر — اتأكد من النت وجرّب تاني");
}

function roomRef(code) { return App.db.ref(ROOT + "/rooms/" + code); }

function createOnline() {
  var n = readHomeFields(); if (!n) return;
  Voice.ask();
  toast("بنعمل الأوضة…");
  fbReady().then(function (db) {
    App.me = App.uid;
    var tries = 0;
    (function attempt() {
      var code = String(1000 + Math.floor(Math.random() * 9000));
      var ref = roomRef(code);
      ref.child("state").once("value").then(function (snap) {
        if (snap.exists() && tries++ < 6) return attempt();
        var s = Engine.newRoom(App.me, n, myAv());
        return ref.child("state").set(s).then(function () {
          ref.child("created").set(firebase.database.ServerValue.TIMESTAMP).catch(function () {});
          App.mode = "online"; App.host = true; App.code = code; App.hist = []; App.ref = ref;
          hostListen();
          try { sessionStorage.setItem("hq_room", JSON.stringify({ code: code, host: true })); } catch (e) {}
          App.ui.screen = "game"; commit(s);
        });
      }).catch(onlineError);
    })();
  }).catch(onlineError);
}

function hostListen() {
  App.ref.child("actions").on("child_added", function (snap) {
    var m = snap.val(); snap.ref.remove();
    if (m && m.pid && m.a) hostApply(m.pid, m.a);
  });
}

function joinOnline(code) {
  var n = readHomeFields(); if (!n) return;
  code = String(code || "").replace(/[^0-9]/g, "");
  if (code.length !== 4) { toast("الكود ٤ أرقام"); return; }
  Voice.ask();
  fbReady().then(function (db) {
    var ref = roomRef(code);
    ref.child("state").once("value").then(function (snap) {
      if (!snap.exists()) { toast("مفيش أوضة بالكود ده"); return; }
      App.mode = "online"; App.host = false; App.me = App.uid; App.code = code; App.ref = ref;
      try { sessionStorage.setItem("hq_room", JSON.stringify({ code: code, host: false })); } catch (e) {}
      App.ui.screen = "game";
      ref.child("state").on("value", function (sn) { if (sn.exists()) receive(sn.val()); }, onlineError);
      send({ type: "join", name: n, av: myAv() });
    }).catch(onlineError);
  }).catch(onlineError);
}

function resumeOnline() {
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem("hq_room") || "null"); } catch (e) {}
  if (!saved || !FIREBASE_CONFIG) return;
  fbReady().then(function (db) {
    var ref = roomRef(saved.code);
    ref.child("state").once("value").then(function (snap) {
      if (!snap.exists()) return;
      App.mode = "online"; App.me = App.uid; App.code = saved.code; App.ref = ref;
      var s = Engine.norm(snap.val());
      App.host = s.hostId === App.me;
      App.ui.screen = "game";
      if (App.host) { App.s = s; hostListen(); render(); }
      else ref.child("state").on("value", function (sn) { if (sn.exists()) receive(sn.val()); });
    });
  }).catch(function () {});
}

function leaveRoom() {
  Voice.teardown();
  if (App.mode === "online" && App.ref) {
    if (!App.host) send({ type: "leave" });
    App.ref.child("state").off(); App.ref.child("actions").off();
  }
  try { sessionStorage.removeItem("hq_room"); } catch (e) {}
  App.mode = null; App.s = null; App.ref = null; App.host = false; App.hist = []; App.ui.screen = "home"; App.ui.overlay = null;
  render();
}

// ---------- مكونات العرض ----------
function avatar(p, size) {
  size = size || 48;
  var c = AV[(p.av || 0) % AV.length];
  // لو أكتر من لاعب اختاروا نفس اللون، نفرّق بينهم عشان محدش يتلخبط
  if (App.s && App.s.players) {
    var idx = App.s.players.indexOf(p);
    var dup = idx > 0 && App.s.players.slice(0, idx).some(function (q) { return (q.av || 0) % AV.length === (p.av || 0) % AV.length; });
    if (dup) c = AV[((p.av || 0) + idx * 5) % AV.length];
  }
  return '<div class="av" style="width:' + size + 'px;height:' + size + 'px;background:' + c + ';font-size:' + Math.round(size * .46) + 'px">' + esc((p.name || "؟").trim().charAt(0)) + "</div>";
}

function cardHTML(role, k) {
  k = k || 0.6;
  return '<div class="cardwrap" style="--k:' + k + '"><div class="cardscale">' + (CARDS[role] || CARDS.back) + "</div></div>";
}

function roleTag(p) {
  var r = ROLE[p.role]; if (!r) return "";
  return '<span class="rtag" style="background:' + r.color + '">' + r.name + "</span>";
}

// grid of player tiles
function grid(opts) {
  var s = App.s, list = opts.list || s.players;
  var h = '<div class="grid">';
  list.forEach(function (p) {
    var cls = "tile", extra = "";
    if (!p.alive) cls += " dead";
    if (opts.speaking === p.id) cls += " speaking";
    if (opts.selected === p.id) cls += " sel";
    var click = opts.clickable && opts.clickable.indexOf(p.id) >= 0;
    if (opts.clickable && !click) cls += " dim";
    if (opts.counts && opts.counts[p.id]) extra += '<span class="badge">' + ar(opts.counts[p.id]) + "</span>";
    if (opts.marks && opts.marks[p.id]) extra += '<span class="mark">' + opts.marks[p.id] + "</span>";
    var tag = "";
    if (!p.alive || opts.revealAll) tag = roleTag(p);
    else if (p.id === App.me) tag = '<span class="you">إنت</span>';
    var inner = avatar(p, 50) + '<div class="tname">' + esc(p.name) + "</div>" + tag + extra;
    if (click) h += '<button type="button" class="' + cls + '" data-a="' + opts.action + '" data-id="' + p.id + '">' + inner + "</button>";
    else h += '<div class="' + cls + '">' + inner + "</div>";
  });
  return h + "</div>";
}

function topbar(label) {
  var me = P(App.me);
  var peek = me && me.role ? '<button type="button" class="peek" data-a="peek">كارتي</button>' : "";
  return '<div class="topbar"><div><div class="tday">الدور ' + ar(App.s.day) + '</div><div class="tphase">' + label + "</div></div>" + peek + "</div>";
}

function countdown() {
  return '<div class="cd"><div class="cdnum" data-cd>--</div><div class="cdbar"><i data-cdbar></i></div></div>';
}

function waitNote(t) { return '<p class="wait">' + t + "</p>"; }

// ---------- الشاشات ----------
function vHome() {
  var avs = "";
  for (var i = 0; i < 8; i++) avs += '<button type="button" class="avpick' + (myAv() === i ? " on" : "") + '" data-a="av" data-i="' + i + '" style="background:' + AV[i] + '" aria-label="لون ' + ar(i + 1) + '"></button>';
  return '<div class="screen home">' +
    '<div class="emblem">' + CARDS.emblem + "</div>" +
    '<h1 class="brand"><span class="b1">حرامية</span><span class="b2">وأهل قرية</span></h1>' +
    '<p class="tag">مين فيكم الحرامي؟</p>' +
    '<div class="panel">' +
    '<label class="field"><span>اسمك</span><input id="nm" maxlength="16" autocomplete="off" value="' + esc(myName()) + '" placeholder="اكتب اسمك"></label>' +
    '<div class="avrow">' + avs + "</div>" +
    '<button type="button" class="btn" data-a="local">العب مع بوتات</button>' +
    '<button type="button" class="btn green" data-a="create">اعمل أوضة أونلاين</button>' +
    '<div class="joinrow"><input id="code" inputmode="numeric" maxlength="4" placeholder="كود الأوضة" aria-label="كود الأوضة"><button type="button" class="btn ghost" data-a="join">ادخل</button></div>' +
    "</div>" +
    '<button type="button" class="link" data-a="rules">قواعد اللعب</button>' +
    "</div>";
}

function stepper(label, key, val, min, max, isHost, suffix) {
  var v = '<b>' + ar(val) + (suffix || "") + "</b>";
  if (!isHost) return '<div class="row"><span>' + label + "</span>" + v + "</div>";
  return '<div class="row"><span>' + label + '</span><div class="step"><button type="button" data-a="cfg" data-k="' + key + '" data-v="' + (val - (key === "talkSec" ? 5 : 1)) + '" aria-label="أقل"' + (val <= min ? " disabled" : "") + '>−</button>' + v + '<button type="button" data-a="cfg" data-k="' + key + '" data-v="' + (val + (key === "talkSec" ? 5 : 1)) + '" aria-label="أكتر"' + (val >= max ? " disabled" : "") + ">+</button></div></div>";
}
function toggle(label, key, on, isHost) {
  if (!isHost) return '<div class="row"><span>' + label + "</span><b>" + (on ? "موجود" : "مش موجود") + "</b></div>";
  return '<div class="row"><span>' + label + '</span><button type="button" class="sw' + (on ? " on" : "") + '" data-a="cfg" data-k="' + key + '" data-v="' + (on ? 0 : 1) + '" aria-pressed="' + on + '" aria-label="' + label + '"><i></i></button></div>';
}

function vLobby() {
  var s = App.s, isHost = App.host, c = s.cfg;
  var h = '<div class="screen">';
  h += '<div class="lobbyhead">';
  if (App.mode === "online") h += '<div class="codebox"><span>كود الأوضة</span><b>' + ar(App.code) + "</b><small>ابعته لصحابك يدخلوا بيه</small></div>";
  else h += '<div class="codebox"><span>تجربة على موبايل واحد</span><b class="sm">إنت والبوتات</b></div>';
  h += "</div>";
  h += '<div class="panel"><div class="ptitle">اللاعيبة (' + ar(s.players.length) + ")</div><div class=\"plist\">";
  s.players.forEach(function (p) {
    h += '<div class="pchip">' + avatar(p, 34) + "<span>" + esc(p.name) + (p.id === s.hostId ? ' <small>المضيف</small>' : "") + (p.id === App.me ? ' <small>إنت</small>' : "") + "</span>";
    if (isHost && p.id !== s.hostId && App.mode === "online") h += '<button type="button" class="x" data-a="kick" data-id="' + p.id + '" aria-label="طلّع ' + esc(p.name) + '">×</button>';
    h += "</div>";
  });
  h += "</div>";
  if (App.mode === "local") h += '<div class="botrow"><button type="button" class="btn ghost sm" data-a="addbot">+ ضيف بوت</button><button type="button" class="btn ghost sm" data-a="rmbot">− شيل بوت</button></div>';
  h += "</div>";

  h += '<div class="panel"><div class="ptitle">إعدادات الدور' + (isHost ? "" : " <small>(المضيف بس اللي بيغيّرها)</small>") + "</div>";
  h += stepper("عدد الحرامية", "thieves", c.thieves, 1, 5, isHost);
  h += stepper("كام من أهل القرية يخرج عشان الحرامية يكسبوا", "goal", c.goal, 1, 5, isHost);
  h += stepper("وقت الكلام لكل لاعب", "talkSec", c.talkSec, 10, 120, isHost, " ث");
  h += toggle("الضابط", "cop", c.cop, isHost);
  h += toggle("الدكتور", "doctor", c.doctor, isHost);
  h += toggle("الرصاصة الأخيرة", "bullet", c.bullet, isHost);
  h += toggle("الخاين", "traitor", c.traitor, isHost);
  h += toggle("الرسالة الأخيرة", "lastMsg", c.lastMsg, isHost);
  if (App.mode === "online") h += toggle("الشات الصوتي في جولة الكلام", "voice", c.voice, isHost);
  var vill = s.players.length - c.thieves - Engine.specialsCount(c);
  h += '<div class="sum">' + ar(c.thieves) + " حرامي · " + (vill > 0 ? ar(vill) + " أهل قرية عاديين" : "مفيش أهل قرية عاديين") + "</div>";
  h += "</div>";
  var err = Engine.validate(s);
  if (isHost) {
    if (err) h += '<p class="warn">' + err + "</p>";
    h += '<button type="button" class="btn big" data-a="start"' + (err ? " disabled" : "") + ">ابدأ اللعب</button>";
  } else h += waitNote("مستنيين المضيف يبدأ اللعبة…");
  h += '<button type="button" class="link" data-a="leave">اخرج من الأوضة</button>';
  return h + "</div>";
}

function vReveal() {
  var s = App.s, me = P(App.me);
  if (!me) return waitNote("بنجهّز…");
  var seenCount = s.players.filter(function (p) { return p.seen; }).length;
  var h = '<div class="screen center">';
  if (!me.seen) {
    h += '<h2 class="h">اقلب كارتك</h2><p class="sub">خلّي الموبايل قريب منك ومحدش يشوفه</p>';
    h += '<button type="button" class="flip' + (App.ui.flipped ? " flipped" : "") + '" data-a="flip" aria-label="اقلب الكارت"><div class="flip-in">' +
      '<div class="face">' + cardHTML("back", .72) + '</div><div class="face front">' + cardHTML(me.role, .72) + "</div></div></button>";
    if (App.ui.flipped) {
      if (me.role === "thief") {
        var mates = s.players.filter(function (p) { return p.role === "thief" && p.id !== me.id; }).map(function (p) { return esc(p.name); });
        h += '<p class="mates">' + (mates.length ? "زمايلك الحرامية: <b>" + mates.join("، ") + "</b>" : "إنت الحرامي الوحيد") + "</p>";
      }
      h += '<button type="button" class="btn big" data-a="seen">شفت كارتي</button>';
    } else h += '<p class="sub">دوس على الكارت</p>';
  } else {
    h += '<h2 class="h">جاهز</h2>' + waitNote("مستنيين الباقيين يشوفوا كروتهم (" + ar(seenCount) + " من " + ar(s.players.length) + ")");
  }
  return h + "</div>";
}

function deadBanner() {
  var me = P(App.me);
  if (me && !me.alive) return '<div class="banner dead">إنت خرجت من اللعبة — اتفرّج من غير ما تتكلم</div>';
  return "";
}

function vTalk() {
  var s = App.s, sp = s.order[s.spk], spP = P(sp);
  var h = '<div class="screen">' + topbar("جولة الكلام " + ar(s.round) + " من " + ar(s.rounds)) + deadBanner();
  if (sp === App.me) {
    h += '<div class="panel spot me"><div class="spk-l">دورك تتكلم</div>' + countdown() + '<button type="button" class="btn big" data-a="done">خلّصت كلامي</button></div>';
  } else {
    h += '<div class="panel spot"><div class="spk-who">' + (spP ? avatar(spP, 64) : "") + '<div><div class="spk-l">الدور على</div><div class="spk-n">' + nm(sp) + "</div></div></div>" + countdown() + "</div>";
  }
  h += voiceLine(sp);
  h += '<div class="rules-strip"><span>ممنوع ترد على حد في دور مش دورك</span><span>ممنوع الحلفان</span></div>';
  var marks = {};
  s.order.forEach(function (id, i) { marks[id] = ar(i + 1); });
  h += grid({ speaking: sp, marks: marks });
  return h + "</div>";
}

function vVote() {
  var s = App.s, me = P(App.me), counts = Engine.tally(s.votes);
  var voted = Object.keys(s.votes).length, total = Engine.alive(s).length;
  var h = '<div class="screen">' + topbar(s.runoff ? "إعادة التصويت" : "التصويت") + deadBanner();
  if (s.voteNote) h += '<div class="banner gold">' + s.voteNote + "</div>";
  var elig = (s.runoff || Engine.alive(s).map(function (p) { return p.id; })).filter(function (id) { return id !== App.me; });
  if (me && me.alive) {
    var mine = s.votes[App.me];
    h += '<p class="sub">' + (mine ? (mine === "skip" ? "إنت امتنعت — تقدر تغيّر لحد ما الكل يصوّت" : "صوّتّ على <b>" + nm(mine) + "</b> — تقدر تغيّر لحد ما الكل يصوّت") : "اختار مين يخرج من القرية") + "</p>";
    h += grid({ clickable: elig, action: "vote", selected: mine, counts: counts, list: s.players.filter(function (p) { return p.alive; }) });
    h += '<button type="button" class="btn ghost" data-a="vote" data-id="skip">امتنع عن التصويت</button>';
  } else {
    h += grid({ counts: counts, list: s.players.filter(function (p) { return p.alive; }) });
  }
  h += waitNote("صوّت " + ar(voted) + " من " + ar(total));
  return h + "</div>";
}

function vVoteResult() {
  var s = App.s, h = '<div class="screen center">' + topbar("نتيجة التصويت");
  if (s.voteOut) {
    var p = P(s.voteOut);
    h += '<h2 class="h">' + esc(p.name) + " خرج بالتصويت</h2>";
    h += cardHTML(p.role, .6);
    h += '<p class="sub big">وكان <span class="rpill" style="background:' + ROLE[p.role].color + '">' + ROLE[p.role].name + "</span></p>";
  } else h += '<h2 class="h">' + (s.voteNote || "محدش خرج") + "</h2>";
  h += hostNext();
  return h + "</div>";
}

function hostNext() {
  return App.host ? '<button type="button" class="btn big" data-a="next">كمّل</button>' : waitNote("مستنيين المضيف يكمّل…");
}

function vLastMsg() {
  var s = App.s, h = '<div class="screen">' + topbar("الرسالة الأخيرة");
  if (App.me === s.voteOut) {
    h += '<div class="panel"><div class="ptitle">ابعت رسالتك الأخيرة</div><p class="sub">هتوصل للي تختاره بس، ومحدش غيره هيشوفها</p>';
    h += grid({ clickable: Engine.alive(s).map(function (p) { return p.id; }), action: "msgto", selected: App.ui.msgTo, list: Engine.alive(s) });
    h += '<textarea id="lm" maxlength="140" rows="3" placeholder="اكتب رسالتك…"></textarea>';
    h += '<div class="two"><button type="button" class="btn" data-a="sendmsg">ابعت</button><button type="button" class="btn ghost" data-a="skipmsg">مش عايز أبعت</button></div></div>';
  } else h += '<h2 class="h center">' + nm(s.voteOut) + " بيكتب رسالته الأخيرة…</h2>" + waitNote("الرسالة هتوصل لواحد بس منكم");
  return h + "</div>";
}

var MISSION_TXT = {
  thief: ["اختاروا مين يخرج", "اتفقوا مع بعض — اللي عليه أكتر اختيارات هو اللي هيخرج"],
  cop: ["اختار حد تقبض عليه", "لو طلع حرامي هيخرج على طول"],
  doctor: ["اختار حد تحميه", "لو الحرامية اختاروه هيفضل في اللعبة"],
  bullet: ["تستخدم الرصاصة؟", "لو ضربت حرامي يخرج، ولو ضربت حد من أهل القرية تخرج إنت"],
  decoy: ["مين أكتر واحد شاكك فيه؟", "الكل بيختار عشان محدش يعرف مين معاه مهمة"]
};

function vMission() {
  var s = App.s, me = P(App.me);
  var done = Object.keys(s.mission.picks).length, total = Engine.alive(s).length;
  var h = '<div class="screen">' + topbar("وقت المهام");
  if (s.lastMsg && s.lastMsg.to === App.me) h += '<div class="banner msg"><b>رسالة أخيرة من ' + nm(s.lastMsg.from) + ":</b> " + esc(s.lastMsg.text) + "</div>";
  h += deadBanner();
  if (me && me.alive) {
    if (s.mission.picks[App.me]) {
      h += '<div class="panel center"><h2 class="h">تمام</h2>' + waitNote("مستنيين الباقيين يخلّصوا (" + ar(done) + " من " + ar(total) + ")") + "</div>";
    } else {
      var k = Engine.missionKind(s, me), tx = MISSION_TXT[k], targets = Engine.validTargets(s, me);
      var marks = {};
      if (k === "thief") s.players.forEach(function (p) { if (p.role === "thief" && p.id !== App.me && s.mission.picks[p.id]) marks[s.mission.picks[p.id]] = (marks[s.mission.picks[p.id]] ? marks[s.mission.picks[p.id]] + "، " : "") + esc(p.name); });
      h += '<div class="panel mission ' + k + '"><div class="ptitle">' + tx[0] + '</div><p class="sub">' + tx[1] + "</p></div>";
      h += grid({ clickable: targets, action: "mission", marks: marks, list: Engine.alive(s) });
      if (k === "bullet") h += '<button type="button" class="btn ghost" data-a="mission" data-id="skip">مش دلوقتي — سيب الرصاصة لبعدين</button>';
    }
  } else h += waitNote("خلّصوا " + ar(done) + " من " + ar(total));
  h += '<p class="hint">خلّي موبايلك قريب منك ومحدش يشوف شاشتك</p>';
  return h + "</div>";
}

function evHTML(e) {
  var p = e.id ? P(e.id) : null, card = p ? cardHTML(p.role, .38) : "";
  var t = "";
  if (e.k === "killed") t = "الحرامية خلّصوا على <b>" + esc(p.name) + "</b> — وكان " + ROLE[p.role].name;
  if (e.k === "saved") t = "الحرامية حاولوا يخلّصوا على حد… بس الدكتور لحقه";
  if (e.k === "arrest") t = "الضابط قبض على <b>" + esc(p.name) + "</b> وطلع حرامي!";
  if (e.k === "bulletHit") t = "الرصاصة الأخيرة صابت <b>" + esc(p.name) + "</b> وطلع حرامي!";
  if (e.k === "bulletMiss") t = "<b>" + esc(p.name) + "</b> ضرب الرصاصة الأخيرة غلط وخرج هو";
  if (e.k === "quiet") t = "الدور عدّى من غير ما حد يخرج";
  return '<div class="ev">' + card + '<p>' + t + "</p></div>";
}

function vMissionResult() {
  var s = App.s, h = '<div class="screen">' + topbar("اللي حصل في المهام");
  s.events.forEach(function (e) { h += evHTML(e); });
  h += hostNext();
  return h + "</div>";
}

function vOver() {
  var s = App.s, me = P(App.me);
  var myTeamWon = me && ((s.winner === "thieves" && (me.role === "thief" || me.role === "traitor")) || (s.winner === "village" && me.role !== "thief" && me.role !== "traitor"));
  var h = '<div class="screen center">';
  h += '<div class="winner ' + s.winner + '"><div class="w1">' + (s.winner === "thieves" ? "الحرامية كسبوا!" : "أهل القرية كسبوا!") + '</div><div class="w2">' + (myTeamWon ? "فريقك كسب" : "فريقك خسر") + "</div></div>";
  h += grid({ revealAll: true });
  if (App.host) h += '<button type="button" class="btn big" data-a="restart">العب تاني</button>';
  else h += waitNote("مستنيين المضيف يبدأ دور جديد…");
  h += '<button type="button" class="link" data-a="leave">اخرج للرئيسية</button>';
  return h + "</div>";
}

function vRules() {
  return '<div class="ov-card"><h2 class="h">قواعد اللعب</h2>' +
    '<ol class="rules"><li><b>أول دور:</b> جولتين كلام، بعدهم تصويت، وبعد التصويت المهام.</li>' +
    "<li><b>كل دور بعد كده:</b> جولة كلام واحدة، تصويت، وبعده المهام.</li>" +
    "<li>كل واحد بيتكلم <b>في دوره بس</b>.</li>" +
    "<li><b>ممنوع ترد</b> على حد في دور مش دورك.</li>" +
    "<li><b>ممنوع الحلفان</b> في اللعب.</li></ol>" +
    '<div class="rgrid">' +
    '<div><b style="color:#C2362B">الحرامي</b> يتفق مع زمايله على واحد يخرج.</div>' +
    '<div><b style="color:#256B42">الضابط</b> يقبض على حد، ولو حرامي يخرج.</div>' +
    '<div><b style="color:#256B42">الدكتور</b> يحمي حد من الحرامية.</div>' +
    '<div><b style="color:#256B42">الرصاصة الأخيرة</b> طلقة واحدة: لو حرامي يخرج، لو بريء تخرج إنت.</div>' +
    '<div><b style="color:#6B2D4E">الخاين</b> من أهل القرية في العدّ وقلبه مع الحرامية.</div>' +
    '<div><b style="color:#256B42">أهل القرية</b> سلاحهم الكلام والتصويت.</div></div>' +
    '<p class="sub">أهل القرية يكسبوا لما يمسكوا كل الحرامية، والحرامية يكسبوا لما يخرج العدد المتفق عليه من أهل القرية.</p>' +
    '<button type="button" class="btn" data-a="close">تمام</button></div>';
}

function vPeek() {
  var me = P(App.me); if (!me || !me.role) return "";
  var extra = "";
  if (me.role === "thief") {
    var mates = App.s.players.filter(function (p) { return p.role === "thief" && p.id !== me.id; }).map(function (p) { return esc(p.name) + (p.alive ? "" : " (خرج)"); });
    extra = '<p class="mates">' + (mates.length ? "زمايلك: <b>" + mates.join("، ") + "</b>" : "إنت الحرامي الوحيد") + "</p>";
  }
  if (me.role === "bullet" && App.s.bulletUsed) extra = '<p class="mates">الرصاصة اتضربت خلاص</p>';
  return '<div class="ov-card center">' + cardHTML(me.role, .7) + extra + '<button type="button" class="btn" data-a="close">اقفل</button></div>';
}

function vOnlineHelp() {
  return '<div class="ov-card"><h2 class="h">اللعب أونلاين محتاج سيرفر</h2>' +
    '<p class="sub">عشان كل واحد يلعب من موبايله، اللعبة محتاجة تتربط بقاعدة بيانات فايربيز. أول ما الإعدادات تتحط في اللعبة، الزرار ده هيشتغل على طول.</p>' +
    '<p class="sub">لحد كده تقدر تجرّب اللعبة كاملة مع البوتات.</p>' +
    '<button type="button" class="btn" data-a="close">تمام</button></div>';
}

function showOverlay(k) { App.ui.overlay = k; render(); }

function hostBar() {
  if (!App.host || !App.s || ["lobby", "over"].indexOf(App.s.phase) >= 0) return "";
  return '<div class="hostbar"><span>تحكم المضيف</span><button type="button" data-a="back">رجوع خطوة</button><button type="button" data-a="force">عدّي المرحلة</button></div>';
}

function render() {
  var root = $("#app"), h = "";
  if (App.ui.screen === "home" || !App.s) h = vHome();
  else {
    var s = App.s, me = P(App.me);
    if (!me && App.mode === "online") h = '<div class="screen center">' + (s.phase === "lobby" ? waitNote("بندخلك الأوضة…") : '<h2 class="h">اللعبة بدأت خلاص</h2><button type="button" class="btn" data-a="leave">ارجع</button>') + "</div>";
    else h = ({ lobby: vLobby, reveal: vReveal, talk: vTalk, vote: vVote, voteResult: vVoteResult, lastMsg: vLastMsg, mission: vMission, missionResult: vMissionResult, over: vOver }[s.phase] || vLobby)();
    h += hostBar();
  }
  var keepMsg = $("#lm") ? $("#lm").value : null;
  root.innerHTML = h;
  if (keepMsg !== null && $("#lm")) $("#lm").value = keepMsg;
  var ov = $("#ov");
  var oh = App.ui.overlay === "rules" ? vRules() : App.ui.overlay === "peek" ? vPeek() : App.ui.overlay === "online" ? vOnlineHelp() : "";
  ov.innerHTML = oh; ov.classList.toggle("on", !!oh);
  updateClock();
}

function updateClock() {
  var s = App.s; if (!s || s.phase !== "talk") return;
  var left = Math.max(0, s.spkEnd - Date.now()), total = s.cfg.talkSec * 1000;
  var n = document.querySelector("[data-cd]"), b = document.querySelector("[data-cdbar]");
  if (n) { n.textContent = ar(Math.ceil(left / 1000)); n.classList.toggle("low", left < 6000); }
  if (b) b.style.width = Math.max(0, Math.min(100, left / total * 100)) + "%";
}

setInterval(function () {
  updateClock();
  if (App.host && App.s && App.s.phase === "talk" && Date.now() >= App.s.spkEnd) hostApply(App.me, { type: "tick" });
}, 300);

// ---------- الضغطات ----------
document.addEventListener("click", function (e) {
  var el = e.target.closest("[data-a]"); if (!el || el.disabled) return;
  Snd.on();
  var a = el.getAttribute("data-a"), id = el.getAttribute("data-id");
  if (a !== "flip") Snd.play("tap");
  switch (a) {
    case "av": store("hq_av", el.getAttribute("data-i")); var keep = $("#nm") ? $("#nm").value : ""; render(); if ($("#nm")) $("#nm").value = keep; break;
    case "local": startLocal(); break;
    case "create": createOnline(); break;
    case "join": joinOnline($("#code") && $("#code").value); break;
    case "rules": showOverlay("rules"); break;
    case "close": App.ui.overlay = null; render(); break;
    case "peek": showOverlay("peek"); break;
    case "leave": leaveRoom(); break;
    case "addbot": addBot(); break;
    case "rmbot": removeBot(); break;
    case "kick": send({ type: "kick", id: id }); break;
    case "cfg": send({ type: "cfg", key: el.getAttribute("data-k"), val: parseInt(el.getAttribute("data-v"), 10) }); break;
    case "start": send({ type: "start" }); break;
    case "flip": App.ui.flipped = true; Snd.play("turn"); render(); break;
    case "seen": send({ type: "seen" }); break;
    case "done": send({ type: "done" }); break;
    case "vote": send({ type: "vote", t: id }); break;
    case "next": send({ type: "next" }); break;
    case "msgto": App.ui.msgTo = id; render(); break;
    case "sendmsg":
      var txt = ($("#lm") && $("#lm").value.trim()) || "";
      if (!App.ui.msgTo) { toast("اختار هتبعت لمين"); break; }
      if (!txt) { toast("اكتب الرسالة"); break; }
      send({ type: "lastMsg", to: App.ui.msgTo, text: txt }); break;
    case "skipmsg": send({ type: "lastMsg" }); break;
    case "mission": send({ type: "mission", t: id }); break;
    case "restart": send({ type: "restart" }); break;
    case "back": send({ type: "back" }); break;
    case "force": send({ type: "force" }); break;
  }
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && e.target && e.target.id === "code") joinOnline(e.target.value);
});

render();
resumeOnline();
