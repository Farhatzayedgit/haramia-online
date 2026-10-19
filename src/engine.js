// ===== محرك اللعبة: حرامية وأهل قرية =====
// كل منطق اللعبة هنا. المضيف (صاحب الأوضة) بس هو اللي بيشغّله، والباقيين بيبعتوا أفعال.
var Engine = (function () {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function defaultCfg() {
    return { thieves: 2, traitor: false, cop: true, doctor: true, bullet: true, goal: 3, talkSec: 30, lastMsg: true, voice: true };
  }

  function newRoom(hostId, name, av) {
    return {
      v: 1, phase: "lobby", hostId: hostId, cfg: defaultCfg(),
      players: [mkPlayer(hostId, name, av)],
      day: 0, round: 0, rounds: 0, order: [], spk: 0, spkEnd: 0,
      votes: {}, runoff: null, voteOut: null, voteCounts: {}, voteNote: "",
      lastMsg: null, mission: { picks: {} }, events: [], bulletUsed: false, lastHeal: null,
      winner: null, seq: 0
    };
  }

  function mkPlayer(id, name, av) {
    return { id: id, name: String(name || "لاعب").slice(0, 16), av: av || 0, alive: true, role: null, seen: false, bot: false };
  }

  // Firebase بيشيل الأوبجكتات والمصفوفات الفاضية، فبنرجّعها
  function norm(s) {
    if (!s) return s;
    s.players = s.players || [];
    s.order = s.order || [];
    s.votes = s.votes || {};
    s.voteCounts = s.voteCounts || {};
    s.mission = s.mission || {};
    s.mission.picks = s.mission.picks || {};
    s.events = s.events || [];
    s.cfg = Object.assign(defaultCfg(), s.cfg || {});
    if (s.runoff === undefined) s.runoff = null;
    if (s.voteOut === undefined) s.voteOut = null;
    if (s.lastMsg === undefined) s.lastMsg = null;
    if (s.lastHeal === undefined) s.lastHeal = null;
    if (s.winner === undefined) s.winner = null;
    return s;
  }

  function P(s, id) { for (var i = 0; i < s.players.length; i++) if (s.players[i].id === id) return s.players[i]; return null; }
  function alive(s) { return s.players.filter(function (p) { return p.alive; }); }
  function isThief(p) { return p && p.role === "thief"; }

  function specialsCount(cfg) { return (cfg.traitor ? 1 : 0) + (cfg.cop ? 1 : 0) + (cfg.doctor ? 1 : 0) + (cfg.bullet ? 1 : 0); }

  function validate(s) {
    var n = s.players.length, c = s.cfg;
    if (n < 4) return "محتاجين ٤ لاعيبة على الأقل";
    if (c.thieves < 1) return "لازم حرامي واحد على الأقل";
    if (c.thieves * 2 >= n) return "عدد الحرامية كبير على عدد اللاعيبة";
    if (c.thieves + specialsCount(c) > n - 1) return "الأدوار أكتر من اللاعيبة — قلّل الأدوار";
    return null;
  }

  function assignRoles(s) {
    var c = s.cfg, roles = [];
    for (var i = 0; i < c.thieves; i++) roles.push("thief");
    if (c.traitor) roles.push("traitor");
    if (c.cop) roles.push("cop");
    if (c.doctor) roles.push("doctor");
    if (c.bullet) roles.push("bullet");
    while (roles.length < s.players.length) roles.push("villager");
    shuffle(roles);
    s.players.forEach(function (p, i) { p.role = roles[i]; p.alive = true; p.seen = !!p.bot && false; });
  }

  function nonThiefTotal(s) { return s.players.filter(function (p) { return !isThief(p); }).length; }
  function goalOf(s) { return Math.max(1, Math.min(s.cfg.goal, nonThiefTotal(s))); }

  function winner(s) {
    var th = alive(s).filter(isThief).length;
    if (th === 0) return "village";
    var outNon = s.players.filter(function (p) { return !p.alive && !isThief(p); }).length;
    if (outNon >= goalOf(s)) return "thieves";
    return null;
  }

  function beginTalk(s, now) {
    var al = alive(s).map(function (p) { return p.id; });
    var start = (s.day - 1) % al.length;
    s.order = al.slice(start).concat(al.slice(0, start));
    s.phase = "talk";
    s.rounds = s.day === 1 ? 2 : 1;
    s.round = 1; s.spk = 0;
    s.spkEnd = now + s.cfg.talkSec * 1000;
  }

  function nextSpeaker(s, now) {
    s.spk++;
    if (s.spk >= s.order.length) {
      s.round++; s.spk = 0;
      if (s.round > s.rounds) { beginVote(s); return; }
    }
    s.spkEnd = now + s.cfg.talkSec * 1000;
  }

  function beginVote(s) {
    s.phase = "vote"; s.votes = {}; s.runoff = null; s.voteNote = "";
  }

  function tally(votes) {
    var c = {};
    Object.keys(votes).forEach(function (k) { var t = votes[k]; if (t && t !== "skip") c[t] = (c[t] || 0) + 1; });
    return c;
  }

  function resolveVote(s) {
    var c = tally(s.votes);
    var ids = Object.keys(c), max = 0;
    ids.forEach(function (id) { if (c[id] > max) max = c[id]; });
    var top = ids.filter(function (id) { return c[id] === max; });
    s.voteCounts = c;
    if (max === 0) { s.voteOut = null; s.voteNote = "محدش اتصوّت عليه"; s.phase = "voteResult"; return; }
    if (top.length > 1) {
      if (!s.runoff) { s.runoff = top; s.votes = {}; s.voteNote = "تعادل! إعادة تصويت بين المتعادلين"; return; }
      s.voteOut = null; s.voteNote = "تعادل تاني — محدش خرج المرة دي"; s.phase = "voteResult"; return;
    }
    s.voteOut = top[0];
    var p = P(s, top[0]); if (p) p.alive = false;
    s.voteNote = "";
    s.phase = "voteResult";
  }

  function needsPick(s, p) {
    // كل اللي عايشين لازم يختاروا حاجة وقت المهام (حتى أهل القرية) عشان محدش يعرف مين معاه مهمة
    return p.alive;
  }

  function missionKind(s, p) {
    if (p.role === "thief") return "thief";
    if (p.role === "cop") return "cop";
    if (p.role === "doctor") return "doctor";
    if (p.role === "bullet" && !s.bulletUsed) return "bullet";
    return "decoy";
  }

  function validTargets(s, p) {
    var k = missionKind(s, p), al = alive(s);
    if (k === "thief") return al.filter(function (q) { return !isThief(q); }).map(function (q) { return q.id; });
    if (k === "doctor") return al.filter(function (q) { return !(s.lastHeal && q.id === s.lastHeal); }).map(function (q) { return q.id; });
    return al.filter(function (q) { return q.id !== p.id; }).map(function (q) { return q.id; });
  }

  function beginMission(s) {
    s.phase = "mission"; s.mission = { picks: {} }; s.events = [];
  }

  function resolveMission(s) {
    var picks = s.mission.picks, ev = [];
    var startAlive = alive(s);
    // ١) الضابط
    startAlive.forEach(function (p) {
      if (p.role === "cop" && picks[p.id]) {
        var t = P(s, picks[p.id]);
        if (t && t.alive && isThief(t)) { t.alive = false; ev.push({ k: "arrest", id: t.id }); }
      }
    });
    // ٢) الرصاصة الأخيرة
    startAlive.forEach(function (p) {
      if (p.role === "bullet" && !s.bulletUsed && picks[p.id] && picks[p.id] !== "skip") {
        s.bulletUsed = true;
        var t = P(s, picks[p.id]);
        if (t && isThief(t)) { if (t.alive) { t.alive = false; ev.push({ k: "bulletHit", id: t.id, by: p.id }); } }
        else { p.alive = false; ev.push({ k: "bulletMiss", id: p.id }); }
      }
    });
    // ٣) الحرامية
    var c = {};
    startAlive.forEach(function (p) { if (isThief(p) && picks[p.id]) c[picks[p.id]] = (c[picks[p.id]] || 0) + 1; });
    var ids = Object.keys(c), max = 0;
    ids.forEach(function (id) { if (c[id] > max) max = c[id]; });
    var top = ids.filter(function (id) { return c[id] === max; });
    if (top.length) {
      var target = P(s, top[rnd(top.length)]);
      var docPick = null;
      startAlive.forEach(function (p) { if (p.role === "doctor" && picks[p.id]) docPick = picks[p.id]; });
      if (target && target.alive) {
        if (docPick === target.id) ev.push({ k: "saved" });
        else { target.alive = false; ev.push({ k: "killed", id: target.id }); }
      }
    }
    // آخر حماية للدكتور
    s.lastHeal = null;
    startAlive.forEach(function (p) { if (p.role === "doctor" && picks[p.id]) s.lastHeal = picks[p.id]; });
    if (!ev.length) ev.push({ k: "quiet" });
    s.events = ev;
    s.phase = "missionResult";
  }

  function afterVote(s, now) {
    var w = winner(s);
    if (w) return endGame(s, w);
    if (s.voteOut && s.cfg.lastMsg) { s.phase = "lastMsg"; s.lastMsg = null; return; }
    beginMission(s);
  }

  function afterMission(s, now) {
    var w = winner(s);
    if (w) return endGame(s, w);
    s.day++; s.lastMsg = null;
    beginTalk(s, now);
  }

  function endGame(s, w) { s.phase = "over"; s.winner = w; }

  // يرجّع رسالة غلط أو null. بيعدّل s مباشرة.
  function act(s, pid, a, now) {
    var me = P(s, pid), isHost = pid === s.hostId, t = a.type;

    if (t === "join") {
      if (me) { me.name = String(a.name || me.name).slice(0, 16); if (a.av != null) me.av = a.av; return null; }
      if (s.phase !== "lobby") return "اللعبة بدأت خلاص";
      if (s.players.length >= 16) return "الأوضة مليانة";
      var np = mkPlayer(pid, a.name, a.av); np.bot = !!a.bot; s.players.push(np); return null;
    }
    if (!me) return "مش موجود في الأوضة";

    if (t === "leave") { if (s.phase !== "lobby" || isHost) return null; s.players = s.players.filter(function (p) { return p.id !== pid; }); return null; }
    if (t === "kick") { if (!isHost || s.phase !== "lobby" || a.id === s.hostId) return null; s.players = s.players.filter(function (p) { return p.id !== a.id; }); return null; }
    if (t === "cfg") {
      if (!isHost || s.phase !== "lobby") return null;
      var k = a.key, v = a.val;
      if (["traitor", "cop", "doctor", "bullet", "lastMsg", "voice"].indexOf(k) >= 0) s.cfg[k] = !!v;
      if (k === "thieves") s.cfg.thieves = Math.max(1, Math.min(5, v | 0));
      if (k === "goal") s.cfg.goal = Math.max(1, Math.min(5, v | 0));
      if (k === "talkSec") s.cfg.talkSec = Math.max(10, Math.min(120, v | 0));
      return null;
    }
    if (t === "start") {
      if (!isHost || s.phase !== "lobby") return null;
      var err = validate(s); if (err) return err;
      assignRoles(s);
      s.day = 1; s.bulletUsed = false; s.lastHeal = null; s.winner = null; s.voteOut = null; s.lastMsg = null; s.events = [];
      s.phase = "reveal";
      s.players.forEach(function (p) { p.seen = false; });
      return null;
    }
    if (t === "seen") {
      if (s.phase !== "reveal") return null;
      me.seen = true;
      if (s.players.every(function (p) { return p.seen; })) beginTalk(s, now);
      return null;
    }
    if (t === "done") {
      if (s.phase === "talk" && s.order[s.spk] === pid) nextSpeaker(s, now);
      return null;
    }
    if (t === "tick") {
      if (s.phase === "talk" && now >= s.spkEnd) nextSpeaker(s, now);
      return null;
    }
    if (t === "vote") {
      if (s.phase !== "vote" || !me.alive) return null;
      var tg = a.t;
      if (tg !== "skip") {
        var tp = P(s, tg);
        if (!tp || !tp.alive || tg === pid) return null;
        if (s.runoff && s.runoff.indexOf(tg) < 0) return null;
      }
      s.votes[pid] = tg;
      if (alive(s).every(function (p) { return s.votes[p.id]; })) resolveVote(s);
      return null;
    }
    if (t === "lastMsg") {
      if (s.phase !== "lastMsg" || pid !== s.voteOut) return null;
      var to = P(s, a.to);
      if (a.text && to && to.alive) s.lastMsg = { from: pid, to: a.to, text: String(a.text).slice(0, 140) };
      else s.lastMsg = null;
      beginMission(s);
      return null;
    }
    if (t === "mission") {
      if (s.phase !== "mission" || !me.alive) return null;
      var k2 = missionKind(s, me);
      if (a.t === "skip") { if (k2 !== "bullet") return null; }
      else if (validTargets(s, me).indexOf(a.t) < 0) return null;
      s.mission.picks[pid] = a.t;
      if (alive(s).every(function (p) { return s.mission.picks[p.id]; })) resolveMission(s);
      return null;
    }
    if (t === "next") {
      if (!isHost) return null;
      if (s.phase === "voteResult") afterVote(s, now);
      else if (s.phase === "missionResult") afterMission(s, now);
      return null;
    }
    if (t === "force") {
      // المضيف يعدّي المرحلة لو حد علّق
      if (!isHost) return null;
      if (s.phase === "reveal") beginTalk(s, now);
      else if (s.phase === "talk") nextSpeaker(s, now);
      else if (s.phase === "vote") resolveVote(s);
      else if (s.phase === "lastMsg") beginMission(s);
      else if (s.phase === "mission") resolveMission(s);
      else if (s.phase === "voteResult") afterVote(s, now);
      else if (s.phase === "missionResult") afterMission(s, now);
      return null;
    }
    if (t === "restart") {
      if (!isHost || s.phase !== "over") return null;
      s.phase = "lobby"; s.day = 0; s.winner = null; s.events = []; s.votes = {}; s.voteOut = null; s.lastMsg = null;
      s.players.forEach(function (p) { p.alive = true; p.role = null; p.seen = false; });
      return null;
    }
    return null;
  }

  return {
    clone: clone, newRoom: newRoom, norm: norm, act: act, P: P, alive: alive, isThief: isThief,
    validate: validate, winner: winner, goalOf: goalOf, tally: tally, missionKind: missionKind,
    validTargets: validTargets, defaultCfg: defaultCfg, specialsCount: specialsCount
  };
})();
if (typeof module !== "undefined") module.exports = Engine;
