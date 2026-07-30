#!/usr/bin/env node
// Usage: node benchmark.js --pairs 100 --seed 12345 [--expect-equivalent] [--verify-reproducibility] [--quiet] [--verbose] [--json]

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
  var options = {pairs: 1, seed: 1, expectEquivalent: false, verifyReproducibility: false, json: false, quiet: false, verbose: false};
  for(var i = 0; i < argv.length; i++) {
    if(argv[i] == '--pairs') options.pairs = Number(argv[++i]);
    else if(argv[i] == '--seed') options.seed = Number(argv[++i]);
    else if(argv[i] == '--expect-equivalent') options.expectEquivalent = true;
    else if(argv[i] == '--verify-reproducibility') options.verifyReproducibility = true;
    else if(argv[i] == '--json') options.json = true;
    else if(argv[i] == '--quiet') options.quiet = true;
    else if(argv[i] == '--verbose') options.verbose = true;
    else if(argv[i] == '--help') options.help = true;
    else throw new Error('unknown argument: ' + argv[i]);
  }
  return options;
}

function formatElapsed(milliseconds) {
  if(milliseconds < 1000) return milliseconds + 'ms';
  return (milliseconds / 1000).toFixed(1) + 's';
}

function formatProgress(progress) {
  var report = progress.report;
  var gamesPerSecond = progress.elapsedMs ? progress.processedGames / (progress.elapsedMs / 1000) : 0;
  var averageDifference = report.completedGames ? report.vpDifference / report.completedGames : 0;
  var percent = progress.completedScenarios * 100 / report.scenarios;
  return 'Progress ' + progress.completedScenarios + '/' + report.scenarios +
      ' (' + percent.toFixed(1) + '%) | games ' + progress.processedGames + '/' + report.games +
      ' | elapsed ' + formatElapsed(progress.elapsedMs) +
      ' | ' + gamesPerSecond.toFixed(2) + ' games/s' +
      ' | L5 ' + report.l5Wins + ', L6 ' + report.l6Wins + ', ties ' + report.ties +
      ' | avg VP difference (L6 - L5) ' + averageDifference.toFixed(2);
}

function formatScenarioDiagnostic(scenario) {
  function gameScores(game) {
    if(game.crash) return 'crashed';
    var scores = [];
    for(var i = 0; i < game.players.length; i++) scores.push('seat' + game.players[i].seat + ' L' + game.players[i].level + ' ' + game.players[i].vp);
    return scores.join(', ');
  }
  return 'Scenario ' + (scenario.scenario + 1) + ': ' + scenario.setup.factions.join(' vs ') +
      ' | A ' + gameScores(scenario.gameA) + ' | B ' + gameScores(scenario.gameB);
}

function createProgressReporter(options) {
  var interval = Math.max(1, Math.ceil(options.pairs / 20));
  return function(progress) {
    if(!options.quiet && !options.json &&
        (progress.completedScenarios == 1 || progress.completedScenarios == progress.report.scenarios ||
         progress.completedScenarios % interval == 0)) {
      console.error(formatProgress(progress));
    }
    if(options.verbose && !options.json && progress.scenario) console.error(formatScenarioDiagnostic(progress.scenario));
  };
}

function createErrorReporter() {
  return function(event) {
    var prefix = 'Benchmark ' + event.type + ' in scenario ' + (event.scenario + 1) +
        (event.game ? ', game ' + event.game : '') + ': ';
    if(event.type == 'rejected') {
      console.error(prefix + event.rejected.length + ' rejected/illegal AI action(s): ' + event.rejected[0].error);
    } else {
      console.error(prefix + event.error);
    }
  };
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

function formatNumber(value) {
  return value == null ? 'n/a' : value.toFixed(2);
}

function formatPairedBuckets(title, buckets) {
  var lines = [title + ':'];
  var keys = Object.keys(buckets).sort();
  for(var i = 0; i < keys.length; i++) {
    var value = buckets[keys[i]];
    lines.push('  ' + keys[i] + ': paired samples ' + value.samples +
        ', L5 wins ' + value.l5Wins + ', L6 wins ' + value.l6Wins + ', ties ' + value.ties +
        ', mean delta ' + formatNumber(value.meanVpDelta) +
        ', L5 VP ' + value.l5Vp + ', L6 VP ' + value.l6Vp);
  }
  return lines;
}

function formatReport(report) {
  var lines = [
    'Terra Mystica AI benchmark',
    'mode: ' + report.mode,
    'seed: ' + report.seed,
    'scenarios: ' + report.scenarios,
    'games: ' + report.games + ' (' + report.completedGames + ' completed)',
    'L5 wins: ' + report.l5Wins,
    'L6 wins: ' + report.l6Wins,
    'ties: ' + report.ties,
    'average VP L5: ' + report.averageVpL5.toFixed(2),
    'average VP L6: ' + report.averageVpL6.toFixed(2),
    'average VP difference (L6 - L5): ' + report.averageVpDifference.toFixed(2),
    'paired scenarios: ' + report.paired.completedScenarios + '/' + report.scenarios,
    'paired scenario results: L5 wins ' + report.paired.l5Wins + ', L6 wins ' + report.paired.l6Wins + ', ties ' + report.paired.ties,
    'mean paired VP delta (L6 - L5): ' + formatNumber(report.paired.meanVpDelta),
    'median paired VP delta (L6 - L5): ' + formatNumber(report.paired.medianVpDelta),
    'paired VP delta standard deviation: ' + formatNumber(report.paired.standardDeviation),
    'paired VP delta standard error: ' + formatNumber(report.paired.standardError),
    'approximate 95% CI for mean paired VP delta: [' + formatNumber(report.paired.confidence95.low) + ', ' + formatNumber(report.paired.confidence95.high) + ']',
    'paired VP delta range: [' + formatNumber(report.paired.minVpDelta) + ', ' + formatNumber(report.paired.maxVpDelta) + ']',
    'decision-trace mismatches: ' + report.comparisons.traceMismatches,
    'final-outcome mismatches: ' + report.comparisons.outcomeMismatches,
    'unavailable comparisons: ' + report.comparisons.unavailable,
    'reproducibility checks: ' + report.reproducibility.checkedGames + ', failures: ' + report.reproducibility.failures.length,
    'rejected/illegal AI actions: ' + report.rejectedActions,
    'crashes: ' + report.crashes.length,
    'trace/outcome equivalence: ' + report.equivalence.passed + '/' + report.scenarios + ' paired scenarios matched',
    'runtime: ' + (report.runtimeMs / 1000).toFixed(3) + 's',
    'games per second: ' + report.gamesPerSecond.toFixed(2)
  ];
  lines = lines.concat(formatBuckets('by faction', report.byFaction));
  lines = lines.concat(formatBuckets('by seat', report.bySeat));
  lines = lines.concat(formatPairedBuckets('paired result by faction', report.pairedByFaction));
  lines = lines.concat(formatPairedBuckets('paired result by seat', report.pairedBySeat));
  if(report.equivalence.failed.length) {
    lines.push((report.mode == 'equivalence' ? 'equivalence failures: ' : 'behavioral differences: ') +
        report.equivalence.failed.length + ' (use --json for details)');
  }
  return lines.join('\n');
}

function main() {
  var options = parseArgs(process.argv.slice(2));
  if(options.help) {
    console.log('Usage: node benchmark.js --pairs <positive integer> --seed <integer> [--expect-equivalent] [--verify-reproducibility] [--quiet] [--verbose] [--json]');
    return;
  }
  var context = createBenchmarkContext();
  loadSources(context);
  var report = context.runBenchmark({
    pairs: options.pairs,
    seed: options.seed,
    expectEquivalent: options.expectEquivalent,
    verifyReproducibility: options.verifyReproducibility,
    onProgress: createProgressReporter(options),
    onError: createErrorReporter()
  });
  console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
  if(report.crashes.length || report.rejectedActions || report.reproducibility.failures.length ||
      (options.expectEquivalent && report.equivalence.failed.length)) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch(error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}
