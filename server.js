const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PUB = path.join(__dirname, 'public');
if (!fs.existsSync(path.join(PUB, 'index.html'))) console.error('Missing public/index.html next to server.js');
app.use(express.static(PUB));
app.get('/host', (req, res) => res.sendFile(path.join(PUB, 'host.html')));

const YEARS = 20, TIME = 45;
const INCOME = [
  { id: 'office', name: 'Steady office job', desc: '$60k a year. Reliable, a little dull.', pay: 60000, hap: -1 },
  { id: 'gig', name: 'Part-time + side hustle', desc: '$42k a year. Lots of free time.', pay: 42000, hap: 3 },
  { id: 'exec', name: 'High-powered career', desc: '$95k a year. Brutal hours.', pay: 95000, hap: -6 },
  { id: 'biz', name: 'Run your own business', desc: 'Could earn $140k, $40k, or $5k.', pay: 0, hap: -2, biz: true },
];
const EXPENSE = [
  { id: 'frugal', name: 'Frugal living', desc: '$28k a year. Beans and rice.', cost: 28000, hap: -3 },
  { id: 'comfy', name: 'Comfortable life', desc: '$42k a year. Nothing fancy.', cost: 42000, hap: 0 },
  { id: 'travel', name: 'Travel & experiences', desc: '$55k a year. Memories over stuff.', cost: 55000, hap: 5 },
  { id: 'lavish', name: 'Luxury lifestyle', desc: '$80k a year. Living large.', cost: 80000, hap: 8 },
];
const INVEST = [
  { id: 'cash', name: 'Keep it in cash', desc: '0% return. Zero risk.', mean: 0, sd: 0 },
  { id: 'bonds', name: 'Bonds', desc: 'About 3% a year. Very steady.', mean: 0.03, sd: 0.015 },
  { id: 'index', name: 'Index fund', desc: 'About 7% a year, swings up to 15%.', mean: 0.07, sd: 0.15 },
  { id: 'risky', name: 'Crypto & startups', desc: 'About 10% a year, wild swings.', mean: 0.10, sd: 0.45 },
  { id: 'self', name: 'Invest in yourself', desc: '$5k on courses and health. +5% pay for good, +2 mood.' },
];
const EVENTS = [
  { name: 'Quiet year', text: 'Nothing unusual happens.' },
  { name: 'Market boom', text: 'Stocks and crypto surge.', ret: 0.08 },
  { name: 'Recession', text: 'Markets fall and pay gets cut.', ret: -0.12, inc: 0.85 },
  { name: 'Inflation spike', text: 'Everything costs more.', exp: 1.2 },
  { name: 'Hot job market', text: 'Employers are paying extra.', inc: 1.1 },
  { name: 'Wellness wave', text: 'The whole town feels better.', hap: 3 },
  { name: 'Grim winter', text: 'A gloomy year for everyone.', hap: -3 },
];
const PERSONAL = [
  { text: 'Surprise inheritance', money: 15000, hap: 2 },
  { text: 'Medical bill', money: -9000, hap: -3 },
  { text: 'Car breaks down', money: -4000, hap: -1 },
  { text: 'Work bonus', money: 7000, hap: 2 },
  { text: 'You fall in love', money: -2000, hap: 6 },
  { text: 'Burnout hits', money: 0, hap: -5 },
  { text: 'Old friends reunite', money: -500, hap: 3 },
  { text: 'Tax audit', money: -6000, hap: -2 },
];
const pub = a => a.map(({ id, name, desc }) => ({ id, name, desc }));
const pick = a => a[Math.floor(Math.random() * a.length)];
const find = (a, id) => a.find(x => x.id === id);
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
const fmt = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US');
const sg = n => (n < 0 ? '-' : '+') + fmt(Math.abs(n));
const score = p => Math.round(p.money + p.hap * 1000);
const board = g => [...g.players.values()]
  .map(p => ({ name: p.name, money: p.money, hap: p.hap, score: score(p) }))
  .sort((a, b) => b.score - a.score);

const games = {};
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => {
  let c;
  do { c = Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); }
  while (games[c]);
  return c;
};

function nextYear(code) {
  const g = games[code];
  g.y++;
  if (g.y > YEARS) { g.state = 'end'; io.to(code).emit('final', board(g)); return; }
  g.state = 'choosing';
  g.ev = g.y === 1 ? EVENTS[0] : pick(EVENTS);
  for (const p of g.players.values()) p.choice = null;
  io.to(code).emit('year', {
    year: g.y, total: YEARS, age: 24 + g.y, time: TIME,
    event: { name: g.ev.name, text: g.ev.text },
    options: { inc: pub(INCOME), exp: pub(EXPENSE), inv: pub(INVEST) },
  });
  g.timer = setTimeout(() => resolve(code), TIME * 1000 + 500);
}

function resolve(code) {
  const g = games[code];
  if (!g || g.state !== 'choosing') return;
  g.state = 'reveal';
  clearTimeout(g.timer);
  const ev = g.ev;
  for (const p of g.players.values()) {
    const c = p.choice || p.last;
    p.last = c;
    const I = find(INCOME, c.inc), E = find(EXPENSE, c.exp), V = find(INVEST, c.inv);
    let base = I.pay;
    if (I.biz) { const r = Math.random(); base = r < 0.4 ? 140000 : r < 0.8 ? 40000 : 5000; }
    const sk = p.skill;
    const pay = Math.round(base * (1 + sk) * (ev.inc || 1));
    const cost = Math.round(E.cost * (ev.exp || 1));
    const start = p.money, hs = p.hap;
    let gain = 0, rate = 0, fee = 0;
    if (V.id === 'self') { fee = 5000; p.skill = Math.min(0.5, p.skill + 0.05); }
    else if (start > 0) {
      rate = V.mean + V.sd * gauss() + (['index', 'risky'].includes(V.id) ? (ev.ret || 0) : 0);
      gain = Math.round(start * rate);
    }
    const debt = start < 0 ? Math.round(-start * 0.1) : 0;
    const pe = Math.random() < 0.35 ? pick(PERSONAL) : null;
    p.money = start + pay - cost - fee + gain - debt + (pe ? pe.money : 0);
    const parts = [
      [I.name, I.hap], [E.name, E.hap], ['Investing in yourself', V.id === 'self' ? 2 : 0],
      [ev.name, ev.hap || 0], [pe ? pe.text : '', pe ? pe.hap : 0], ['Living in debt', p.money < 0 ? -5 : 0],
    ].filter(x => x[1]);
    p.hap = Math.max(0, Math.min(100, hs + parts.reduce((a, x) => a + x[1], 0)));
    p.d = { I, E, V, base, sk, pay, cost, start, hs, gain, rate, fee, debt, pe, parts };
  }
  const b = board(g);
  const names = b.map(x => x.name);
  for (const [id, p] of g.players) {
    const { I, E, V, base, sk, pay, cost, start, hs, gain, rate, fee, debt, pe, parts } = p.d;
    const inc = [[I.name, fmt(base)]];
    if (sk) inc.push(['Training bonus', '+' + Math.round(sk * 100) + '%']);
    if (ev.inc) inc.push([ev.name, (ev.inc > 1 ? '+' : '-') + Math.round(Math.abs(ev.inc - 1) * 100) + '% pay']);
    const exp = [[E.name, '-' + fmt(E.cost)]];
    if (ev.exp) exp.push([ev.name, '+' + Math.round((ev.exp - 1) * 100) + '% costs']);
    if (debt) exp.push(['Interest on debt', '-' + fmt(debt)]);
    const inv = V.id === 'self' ? [['Courses & wellness', '-' + fmt(fee)], ['Future pay', '+5% for good']]
      : start > 0 ? [[V.name, (rate * 100).toFixed(1) + '% return'], ['Money invested', fmt(start)]]
      : [[V.name, 'Nothing to invest']];
    const steps = [
      { title: 'Income', rows: inc, big: sg(pay) },
      { title: 'Expenses', rows: exp, big: '-' + fmt(cost + debt) },
      { title: 'Investments', rows: inv, big: sg(gain - fee) },
      { title: 'Life events', rows: [[ev.name, ev.text], pe ? [pe.text, pe.money ? sg(pe.money) : ''] : ['A calm personal year', '']] },
      { title: 'Year-end scorecard', big: fmt(p.money), rows: [
        ['Money', fmt(start) + ' → ' + fmt(p.money)], ['Happiness', hs + ' → ' + p.hap],
        ...parts.map(([l, d]) => ['   ' + l, (d > 0 ? '+' : '') + d + ' mood']),
        ['Rank', '#' + (names.indexOf(p.name) + 1) + ' of ' + b.length]] },
    ];
    io.to(id).emit('report', { year: g.y, steps });
  }
  io.to(g.host).emit('reveal', { year: g.y, board: b.slice(0, 5), last: g.y === YEARS });
}

io.on('connection', socket => {
  socket.on('host:create', () => {
    const code = newCode();
    games[code] = { host: socket.id, players: new Map(), y: 0, state: 'lobby' };
    socket.data = { code, host: true };
    socket.join(code);
    socket.emit('created', code);
  });

  socket.on('host:next', () => {
    const g = games[socket.data.code];
    if (!g || !socket.data.host) return;
    if (g.state === 'lobby' && g.players.size === 0) return;
    if (g.state === 'lobby' || g.state === 'reveal') nextYear(socket.data.code);
  });

  socket.on('join', ({ code, name }) => {
    code = String(code || '').trim().toUpperCase();
    name = String(name || '').trim().slice(0, 16);
    const g = games[code];
    if (!g) return socket.emit('join:error', 'No game with that code. Check the code on the host screen.');
    if (g.state !== 'lobby') return socket.emit('join:error', 'That game has already started.');
    if (!name) return socket.emit('join:error', 'Enter a nickname to join.');
    if ([...g.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase()))
      return socket.emit('join:error', 'That nickname is taken. Pick another.');
    g.players.set(socket.id, { name, money: 10000, hap: 50, skill: 0, choice: null, last: { inc: 'office', exp: 'comfy', inv: 'bonds' } });
    socket.data = { code };
    socket.join(code);
    socket.emit('joined', name);
    io.to(g.host).emit('players', [...g.players.values()].map(p => p.name));
  });

  socket.on('choose', c => {
    const g = games[socket.data.code];
    const p = g && g.players.get(socket.id);
    if (!p || g.state !== 'choosing' || p.choice || !c) return;
    if (!find(INCOME, c.inc) || !find(EXPENSE, c.exp) || !find(INVEST, c.inv)) return;
    p.choice = { inc: c.inc, exp: c.exp, inv: c.inv };
    socket.emit('locked');
    const n = [...g.players.values()].filter(x => x.choice).length;
    io.to(g.host).emit('count', { n, total: g.players.size });
    if (n === g.players.size) resolve(socket.data.code);
  });

  socket.on('disconnect', () => {
    const { code, host } = socket.data || {};
    const g = games[code];
    if (!g) return;
    if (host) { clearTimeout(g.timer); io.to(code).emit('ended'); delete games[code]; }
    else if (g.players.delete(socket.id)) {
      io.to(g.host).emit('players', [...g.players.values()].map(p => p.name));
      if (g.state === 'choosing' && g.players.size && [...g.players.values()].every(p => p.choice)) resolve(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LifeSim running on http://localhost:${PORT}`));
