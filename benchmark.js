#!/usr/bin/env node
// Usage: node benchmark.js --pairs 100 --seed 12345 [--json]

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function makeElement() {
  return {
    style: {}, children: [], innerHTML: '',
    appendChild: function(child) { this.children.push(child); return child; },
    removeChild: function(child) {
      var index = this.children.indexOf(child);
      if(index >= 0) this.children.splice(index, 1);
      return child;
    }
  };
}

function createBenchmarkContext() {
  var body = makeElement();
  // Do not pass Node's Math object into the VM: its random function is replaced
  // per benchmark game, while the host process and browser behavior stay intact.
  var benchmarkMath = Object.create(Math);
  benchmarkMath.random = Math.random;
  var document = {
    body: body,
    documentElement: {scrollLeft: 0, scrollTop: 0},
    createElement: function() { return makeElement(); },
    onkeydown: null
  };
  var context = {
    console: console,
    Math: benchmarkMath,
    document: document,
    window: {event: null, setTimeout: function() { return 0; }},
    location: {search: ''},
    alert: function() {},
    logText: '', lastLogLine: '', logUpsideDown: false, logColored: false,
    addLog: function() {}, clearHelp: function() {}, setHelp: function() {},
    drawHud: function() {}, drawMap: function() {}, displayLog: function() {},
    actionEl: makeElement(), popupElement: makeElement(), uiElement: makeElement(),
    hudElement: makeElement(), logEl: makeElement(), helpEl: makeElement()
  };
  context.window.window = context.window;
  context.window.document = document;
  context.global = context;
  vm.createContext(context);
  return context;
}

function loadSources(context) {
  var files = [
    'util.js', 'enums.js', 'game.js', 'world.js', 'faction.js', 'player.js',
    'action.js', 'rules.js', 'render.js', 'menu.js', 'strategy.js', 'actor.js',
    'ai_lode.js', 'ai_lou.js', 'ai_level6.js', 'ai_random.js', 'human.js',
    'state.js', 'snellman.js', 'save.js', 'fireice.js', 'benchmark_harness.js'
  ];
  for(var i = 0; i < files.length; i++) {
    var filename = path.join(__dirname, files[i]);
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename: files[i]});
  }
}

function parseArgs(argv) {
  var options = {pairs: 1, seed: 1, json: false};
  for(var i = 0; i < argv.length; i++) {
    if(argv[i] == '--pairs') options.pairs = Number(argv[++i]);
    else if(argv[i] == '--seed') options.seed = Number(argv[++i]);
    else if(argv[i] == '--json') options.json = true;
    else if(argv[i] == '--help') options.help = true;
    else throw new Error('unknown argument: ' + argv[i]);
  }
  return options;
}

function formatBuckets(title, buckets) {
  var lines = [title + ':'];
  var keys = Object.keys(buckets).sort();
  for(var i = 0; i < keys.length; i++) {
    var value = buckets[keys[i]];
    lines.push('  ' + keys[i] + ': games ' + value.games +
        ', L5 wins ' + value.l5Wins + ', L6 wins ' + value.l6Wins +
        ', ties ' + value.ties + ', L5 VP ' + value.l5Vp + ', L6 VP ' + value.l6Vp);
  }
  return lines;
}

function formatReport(report) {
  var lines = [
    'Terra Mystica AI benchmark',
    'seed: ' + report.seed,
    'scenarios: ' + report.scenarios,
    'games: ' + report.games + ' (' + report.completedGames + ' completed)',
    'L5 wins: ' + report.l5Wins,
    'L6 wins: ' + report.l6Wins,
    'ties: ' + report.ties,
    'average VP L5: ' + report.averageVpL5.toFixed(2),
    'average VP L6: ' + report.averageVpL6.toFixed(2),
    'average VP difference (L6 - L5): ' + report.averageVpDifference.toFixed(2),
    'rejected/illegal AI actions: ' + report.rejectedActions,
    'crashes: ' + report.crashes.length,
    'baseline equivalence: ' + report.equivalence.passed + '/' + report.scenarios + ' paired scenarios matched',
    'runtime: ' + (report.runtimeMs / 1000).toFixed(3) + 's'
  ];
  lines = lines.concat(formatBuckets('by faction', report.byFaction));
  lines = lines.concat(formatBuckets('by seat', report.bySeat));
  if(report.equivalence.failed.length) lines.push('equivalence failures: ' + report.equivalence.failed.length + ' (use --json for details)');
  return lines.join('\n');
}

function main() {
  var options = parseArgs(process.argv.slice(2));
  if(options.help) {
    console.log('Usage: node benchmark.js --pairs <positive integer> --seed <integer> [--json]');
    return;
  }
  var context = createBenchmarkContext();
  loadSources(context);
  var report = context.runBenchmark({pairs: options.pairs, seed: options.seed});
  console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
  if(report.crashes.length || report.equivalence.failed.length) process.exitCode = 1;
}

try {
  main();
} catch(error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}
