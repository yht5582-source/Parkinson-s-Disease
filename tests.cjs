// Engine tests: node tests.cjs
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
const mt = html.match(/\/\*CASES-START\*\/([\s\S]*?)\/\*MAP-END\*\/\s*(if\(typeof module[^\n]*)/);
assert(m && mt, 'engine or teaching block not found');
const sandbox = { module: {} };
vm.runInNewContext(m[1] + mt[1] + mt[2], sandbox);
const E = sandbox.module.exports;
const { CASES, QUIZ, MINDMAP } = sandbox.module.teach;

let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name, '\n  ', e.message); process.exitCode = 1; } };
const near = (a, b, d = 1e-6) => assert(Math.abs(a - b) <= d, `${a} != ${b}`);
const reg = o => ({ ld: 100, n: 4, first: 7, int: 4, cr: 0, comt: 'none', maob: 'none', da: 'none', dadose: 0, am: 0, ach: 0, ...o });
const pt = o => ({ egfr: 'n', sleep: 23, wake: 7, ...o });

// --- MDS 2015 classification
const dx = o => E.dxClass({ brady: true, tremor: true, rigid: false, ex: 0, rf: 0, sp: 0, ...o });
t('needs bradykinesia', () => assert.equal(dx({ brady: false, sp: 4 }), 'none'));
t('needs tremor or rigidity', () => assert.equal(dx({ tremor: false, rigid: false }), 'none'));
t('rigidity alone is enough', () => assert.notEqual(dx({ tremor: false, rigid: true }), 'none'));
t('exclusion beats everything', () => assert.equal(dx({ ex: 1, sp: 4 }), 'excluded'));
t('established: no flags, 2 supportive', () => assert.equal(dx({ sp: 2 }), 'established'));
t('no flags, 1 supportive is probable', () => assert.equal(dx({ sp: 1 }), 'probable'));
t('no flags, 0 supportive is probable', () => assert.equal(dx({ sp: 0 }), 'probable'));
t('1 flag needs 1 supportive', () => { assert.equal(dx({ rf: 1, sp: 1 }), 'probable'); assert.equal(dx({ rf: 1, sp: 0 }), 'fail'); });
t('2 flags need 2 supportive', () => { assert.equal(dx({ rf: 2, sp: 2 }), 'probable'); assert.equal(dx({ rf: 2, sp: 1 }), 'fail'); });
t('3 flags always fail', () => assert.equal(dx({ rf: 3, sp: 4 }), 'fail'));
t('a flag blocks established', () => assert.equal(dx({ rf: 1, sp: 4 }), 'probable'));

// --- LEDD (Tomlinson 2010, Jost 2023)
t('IR levodopa x1', () => assert.equal(E.ledd(reg()), 400));
t('CR x0.75', () => assert.equal(E.ledd(reg({ n: 0, cr: 200 })), 150));
t('entacapone only on IR doses', () => assert.equal(E.ledd(reg({ comt: 'ent', cr: 200 })), Math.round(400 + 150 + 400 * .33)));
t('opicapone on all levodopa LED', () => assert.equal(E.ledd(reg({ comt: 'opi', cr: 200 })), Math.round((400 + 150) * 1.5)));
t('Jost table 3 opicapone example', () => assert.equal(E.ledd(reg({ ld: 150, comt: 'opi' })), 900));
t('Jost table 3 entacapone example', () => assert.equal(E.ledd(reg({ n: 3, comt: 'ent' })), 399));
t('safinamide 50 = 150', () => assert.equal(E.ledd(reg({ n: 0, maob: 'saf50' })), 150));
t('safinamide 100 = 150', () => assert.equal(E.ledd(reg({ n: 0, maob: 'saf100' })), 150));
t('rasagiline and selegiline = 100', () => { assert.equal(E.ledd(reg({ n: 0, maob: 'ras' })), 100); assert.equal(E.ledd(reg({ n: 0, maob: 'sel' })), 100); });
t('agonist factors', () => {
  assert.equal(E.ledd(reg({ n: 0, da: 'prx', dadose: 1 })), 100);
  assert.equal(E.ledd(reg({ n: 0, da: 'rop', dadose: 4 })), 80);
  assert.equal(E.ledd(reg({ n: 0, da: 'rot', dadose: 4 })), 120);
});
t('amantadine x1', () => assert.equal(E.ledd(reg({ n: 0, am: 200 })), 200));
t('anticholinergic is not counted', () => assert.equal(E.ledd(reg({ ach: 1 })), 400));

// --- agonist switching
t('ropinirole 8 to pramipexole is not 8 mg', () => near(E.switchDA('rop', 8, 'prx'), 1.5));
t('pramipexole to ropinirole', () => assert.equal(E.switchDA('prx', 1.5, 'rop'), 8));
t('capped at the new maximum', () => assert.equal(E.switchDA('rop', 24, 'prx'), 4.5));
t('none to drug gives the start dose', () => assert.equal(E.switchDA('none', 0, 'rot'), 4));
t('drug to none gives zero', () => assert.equal(E.switchDA('rop', 8, 'none'), 0));

// --- normalize
t('negative and out-of-range values are clamped', () => {
  const r = E.normalize(reg({ ld: -100, n: 99.4, first: 1, int: .1, am: 900, dadose: -1 }));
  assert.deepEqual([r.ld, r.n, r.first, r.int, r.am, r.dadose], [0, 10, 4, 1.5, 400, 0]);
});
t('NaN falls back to the minimum', () => assert.equal(E.normalize(reg({ ld: NaN })).ld, 0));
t('no agonist means no agonist dose', () => assert.equal(E.normalize(reg({ dadose: 8 })).dadose, 0));

// --- fractionate
t('4 q4h becomes 5 q3h, same span', () => { const r = E.fractionate(reg(), .75); assert.deepEqual([r.n, r.int, r.ld], [5, 3, 75]); });
t('zero doses stay zero, finite', () => { const r = E.fractionate(reg({ n: 0 }), .75); assert.equal(r.n, 0); assert(isFinite(r.int)); });
t('one dose becomes two within interval limit', () => { const r = E.fractionate(reg({ n: 1 }), 1); assert.equal(r.n, 2); assert(r.int <= 8); });
t('never adds past 8 doses', () => { const r = E.fractionate(reg({ n: 8, int: 2.5 }), .75); assert.equal(r.n, 8); assert.equal(r.ld, 75); });
t('10 doses are not reduced', () => assert.equal(E.fractionate(reg({ n: 10, int: 2 }), 1).n, 10));
t('interval floor 2.5 h', () => assert(E.fractionate(reg({ n: 7, int: 1.5 }), 1).int >= 2.5));
t('zero levodopa is not raised to 25', () => assert.equal(E.fractionate(reg({ ld: 0 }), .75).ld, 0));

// --- simulation
const sim = (o, y = 9, w = 7, s = 23) => E.simulate(reg(o), y, w, s);
t('24 h of points from 04:00', () => { const p = sim().pts; assert.equal(p.length, 481); near(p[0][0], 4); near(p[480][0], 28); });
t('more wearing-off late in the disease', () => assert(sim({}, 15).off > sim({}, 3).off));
t('narrow window late in the disease', () => { const a = E.therapeuticWindow(20), b = E.therapeuticWindow(1); assert(a.dysk - a.off < b.dysk - b.off); });
t('COMT shortens OFF', () => assert(sim({ comt: 'opi' }).off < sim().off));
t('higher dose raises dyskinesia time', () => assert(sim({ ld: 250 }).dy > sim({ ld: 100 }).dy));
t('amantadine raises the dyskinesia threshold', () => assert(sim({ am: 200 }).thrDysk > sim().thrDysk));
t('first dose 2 h after waking counts as morning OFF (fixed waking window)', () => {
  assert(sim({ first: 9, n: 5, int: 3 }, 9, 7, 20).off > sim({ first: 7, n: 5, int: 3 }, 9, 7, 20).off + 1);
});
t('waking at 05:00 counts OFF before the old 06:00 chart start', () => {
  assert(sim({ first: 7 }, 9, 5, 23).off > sim({ first: 7 }, 9, 7, 23).off + 1.5);
});
t('OFF plus dyskinesia never exceeds waking hours', () => { const r = sim({ ld: 0, n: 0 }, 15); assert(r.off + r.dy <= 16.0001); });
t('no levodopa at all is all OFF', () => near(sim({ ld: 0, n: 0 }, 9).off, 16, .06));
t('bedtime CR raises the night tail', () => {
  const at = (r, h) => r.pts.find(p => Math.abs(p[0] - h) < .01)[1];
  assert(at(sim({ cr: 200 }), 26) > at(sim(), 26));
});
t('doses past midnight wrap instead of vanishing', () => assert(sim({ n: 7, int: 4 }).pts.every(p => isFinite(p[1]))));
t('zero-dose regimen draws no markers', () => assert.equal(E.doseTimes(reg({ ld: 0 })).length, 0));

// --- warnings
const titles = (r, p) => E.regWarnings(reg(r), pt(p)).map(w => w.t).join('|');
t('amantadine 100 at eGFR 30-59 is compliant', () => assert(!titles({ am: 100 }, { egfr: 'm' }).includes('腎功能')));
t('amantadine 200 at eGFR 30-59 warns', () => assert(titles({ am: 200 }, { egfr: 'm' }).includes('腎功能')));
t('any amantadine at eGFR <30 warns', () => assert(titles({ am: 100 }, { egfr: 's' }).includes('腎功能')));
t('amantadine 300 normal eGFR is quiet', () => assert.equal(titles({ am: 300 }, {}), ''));
t('entacapone limit', () => { assert(titles({ comt: 'ent', n: 9, int: 2 }, {}).includes('Entacapone')); assert(!titles({ comt: 'ent', n: 8, int: 2 }, {}).includes('Entacapone')); });
t('agonist ceiling', () => assert(titles({ da: 'prx', dadose: 8 }, {}).includes('Pramipexole')));
t('rotigotine ceiling is 8 mg (Taiwan sources)', () => {
  assert.equal(E.DA.rot.max, 8);
  assert.equal(titles({ da: 'rot', dadose: 8 }, {}), '');
  assert(titles({ da: 'rot', dadose: 10 }, {}).includes('Rotigotine'));
  assert.equal(E.switchDA('rop', 24, 'rot'), 8);
});
t('entacapone 10 doses is within the Taiwan label, flagged as above the US limit', () => {
  const w = E.regWarnings(reg({ comt: 'ent', n: 10, int: 1.5 }), pt({})).find(x => x.t.includes('Entacapone'));
  assert.equal(w.lv, 'warn'); assert(w.d.includes('2000'));
});
t('last dose after bedtime', () => assert(titles({ n: 7, int: 4 }, {}).includes('就寢')));
t('last dose at bedtime is fine', () => assert.equal(titles({ n: 5, int: 4 }, {}), ''));

// --- initial treatment
const rank = o => E.initRank({ age: 66, func: true, tr: false, cog: false, icd: false, eds: false, oh: false, ...o });
const row = (l, s) => l.find(x => x.n.includes(s));
t('levodopa first when function is affected', () => { assert(rank()[0].n.startsWith('Levodopa')); assert.equal(rank()[0].label, '首選'); });
t('MAO-B leads in mild disease', () => assert(rank({ func: false })[0].n.startsWith('MAO-B')));
t('agonist not advised in the elderly', () => assert.equal(row(rank({ age: 75 }), '致效劑').label, '不建議'));
t('agonist not advised with cognitive impairment', () => assert.equal(row(rank({ cog: true }), '致效劑').label, '不建議'));
t('anticholinergic only young + tremor + intact cognition', () => {
  assert.equal(row(rank({ age: 45, tr: true }), '抗膽鹼').label, '可選');
  assert.equal(row(rank({ age: 45, tr: true, cog: true }), '抗膽鹼').label, '不建議');
  assert.equal(row(rank({ age: 66, tr: true }), '抗膽鹼').label, '不建議');
});
t('young patient is not told about age >=60', () => {
  const w = row(rank({ age: 45 }), '抗膽鹼').w.join();
  assert(!w.includes('≥60')); assert(w.includes('非以顫抖'));
});
t('blank age is not treated as young', () => {
  const l = rank({ age: null });
  assert(!row(l, '致效劑').w.join().includes('年輕'));
  assert.equal(row(rank({ age: null, tr: true }), '抗膽鹼').label, '不建議');
  assert(row(rank({ age: null, tr: true }), '抗膽鹼').w.join().includes('未填年齡'));
});

// --- misc
t('fmtT', () => { assert.equal(E.fmtT(7.5), '07:30'); assert.equal(E.fmtT(25), '01:00'); assert.equal(E.fmtT(7.999), '08:00'); assert.equal(E.fmtT(24), '00:00'); });
t('amantadine renal caps', () => assert.deepEqual(['n', 'm', 's'].map(E.amMax), [300, 100, 0]));

// --- cases: stated teaching points must match what the engine computes
const dxc = c => E.dxClass({ ...c.dx.core, ex: c.dx.ex.length, rf: c.dx.rf.length, sp: c.dx.sp.length });
const cs = id => CASES.find(c => c.id === id);
const simc = (c, r) => E.simulate(c.sim[r], c.sim.pt.years, c.sim.pt.wake, c.sim.pt.sleep);
t('6 cases with unique ids', () => { assert.equal(CASES.length, 6); assert.equal(new Set(CASES.map(c => c.id)).size, 6); });
t('case 1 is clinically established', () => assert.equal(dxc(cs(1)), 'established'));
t('case 2 fails on 3 red flags', () => { assert.equal(dxc(cs(2)), 'fail'); assert.equal(cs(2).dx.rf.length, 3); });
t('case 3: levodopa first, agonist not advised, anticholinergic optional', () => {
  const i = cs(3).init, l = E.initRank({ age: i.age, func: true, tr: i.tremor, cog: i.cog, icd: i.icd, eds: i.eds, oh: i.oh });
  assert(l[0].n.startsWith('Levodopa')); assert.equal(row(l, '致效劑').label, '不建議'); assert.equal(row(l, '抗膽鹼').label, '可選');
});
t('case 4: proposal lowers both OFF and dyskinesia', () => {
  const c = cs(4), a = simc(c, 'cur'), b = simc(c, 'prop');
  assert(b.off < a.off, `off ${a.off} ${b.off}`); assert(b.dy < a.dy, `dy ${a.dy} ${b.dy}`);
  assert(c.sim.pt.offh >= 2 && c.sim.pt.dyskh >= 1);
  assert(c.sim.prop.ld * c.sim.prop.n < c.sim.cur.ld * c.sim.cur.n, 'levodopa total falls');
  assert(E.ledd(c.sim.prop) > E.ledd(c.sim.cur), 'LEDD rises through amantadine');
  const opi = E.simulate({ ...c.sim.cur, ld: 125, n: 5, int: 3, comt: 'opi' }, 8, 7, 23);
  assert(opi.dy > a.dy, 'stated opicapone comparison');
});
t('case 5: agonist removed, LEDD about equal, OFF stays modest', () => {
  const c = cs(5); assert.equal(E.ledd(c.sim.cur), 600); assert.equal(E.ledd(c.sim.prop), 625); assert.equal(c.sim.prop.da, 'none');
  assert(simc(c, 'prop').off < 2); assert.equal(simc(c, 'prop').dy, 0);
  near(E.simulate({ ...c.sim.prop, ld: 150, n: 3, int: 5 }, 6, 7, 23).off, 6.5, .06);
});
t('case 6: story says no dyskinesia, model agrees', () => { assert.equal(simc(cs(6), 'cur').dy, 0); assert.equal(simc(cs(6), 'prop').dy, 0); });
t('case 6: renal alert on current, none on proposal; anticholinergic stopped', () => {
  const c = cs(6), w = r => E.regWarnings(c.sim[r], c.sim.pt).map(x => x.t).join();
  assert(w('cur').includes('腎功能')); assert(!w('prop').includes('腎功能')); assert.equal(c.sim.prop.ach, 0);
});
t('case regimens are already within input limits', () => CASES.filter(c => c.sim).forEach(c => ['cur', 'prop'].forEach(r => {
  assert.deepEqual(E.normalize({ ...c.sim[r] }), c.sim[r]);
  assert(!E.regWarnings(c.sim[r], c.sim.pt).some(x => x.t.includes('就寢')));
})));

// --- quiz
const qz = id => QUIZ.find(q => q.id === id);
t('20 questions, 10 basic + 10 advanced', () => {
  assert.equal(QUIZ.length, 20); assert.equal(QUIZ.filter(q => q.lv === '基礎').length, 10); assert.equal(QUIZ.filter(q => q.lv === '高階').length, 10);
  assert.equal(new Set(QUIZ.map(q => q.id)).size, 20);
});
t('answers are spread A-D 5 each', () => [0, 1, 2, 3].forEach(i => assert.equal(QUIZ.filter(q => q.a === i).length, 5)));
t('each question has 4 distinct options, an explanation and a source', () => QUIZ.forEach(q => {
  assert.equal(new Set(q.o).size, 4, q.id); assert(q.e && q.s, q.id); assert(q.a >= 0 && q.a < 4, q.id);
}));
t('the correct option is not a giveaway by length', () => {
  const longest = QUIZ.filter(q => q.o[q.a].length > Math.max(...q.o.filter((_, i) => i !== q.a).map(x => x.length)));
  assert(longest.length <= 5, longest.map(q => q.id).join());
});
const parseMg = s => parseInt(s, 10);
t('b5 matches engine', () => assert.equal(parseMg(qz('b5').o[qz('b5').a]), E.ledd(reg({ da: 'rop', dadose: 8 }))));
t('a2 matches engine', () => assert.equal(parseMg(qz('a2').o[qz('a2').a]), E.ledd(reg({ cr: 200, comt: 'opi', maob: 'saf50' }))));
t('a1 matches engine', () => { assert.equal(dx({ rf: 2, sp: 1 }), 'fail'); assert(qz('a1').o[qz('a1').a].includes('不符合')); });
t('a3 matches engine', () => { assert.equal(E.MAOB.saf50.led, 150); assert.equal(E.MAOB.saf100.led, 150); assert(qz('a3').o[qz('a3').a].includes('150')); });
t('b2 option C is the established rule', () => assert.equal(dx({ rf: 0, sp: 2 }), 'established'));

// --- mind map
t('mind map has branches and no empty node', () => {
  assert(MINDMAP.length >= 6);
  const walk = n => { if (typeof n === 'string') return assert(n.length); assert(n.t); (n.c || []).forEach(walk); };
  MINDMAP.forEach(walk);
});
t('mind map limits match the engine', () => {
  const txt = JSON.stringify(MINDMAP);
  assert(txt.includes('上限 ' + E.DA.rot.max + ' mg/24h')); assert(txt.includes('固定 ' + E.MAOB.saf50.led));
});

console.log(`${n} passed${process.exitCode ? ', with failures' : ''}`);
