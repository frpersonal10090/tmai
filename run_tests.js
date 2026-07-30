// Local test runner for the browser JavaScript sources.
// Usage: node run_tests.js

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function makeElement() {
  return {
    style: {},
    children: [],
    innerHTML: '',
    appendChild: function(child) { this.children.push(child); return child; },
    removeChild: function(child) {
      var index = this.children.indexOf(child);
      if(index >= 0) this.children.splice(index, 1);
      return child;
    }
  };
}

var body = makeElement();
var document = {
  body: body,
  documentElement: {scrollLeft: 0, scrollTop: 0},
  createElement: function() { return makeElement(); },
  onkeydown: null
};

var context = {
  console: console,
  document: document,
  window: {event: null, setTimeout: function() { return 0; }},
  location: {search: ''},
  alert: function() {},
  logText: '',
  lastLogLine: '',
  logUpsideDown: false,
  logColored: false,
  addLog: function() {},
  clearHelp: function() {},
  setHelp: function() {},
  drawHud: function() {},
  drawMap: function() {},
  displayLog: function() {},
  actionEl: makeElement(),
  popupElement: makeElement(),
  uiElement: makeElement(),
  hudElement: makeElement(),
  logEl: makeElement(),
  helpEl: makeElement()
};
context.window.window = context.window;
context.window.document = document;
context.global = context;

vm.createContext(context);

var files = [
  'util.js',
  'enums.js',
  'game.js',
  'world.js',
  'faction.js',
  'player.js',
  'action.js',
  'rules.js',
  'render.js',
  'menu.js',
  'strategy.js',
  'actor.js',
  'ai_lode.js',
  'ai_lou.js',
  'ai_level6.js',
  'ai_random.js',
  'human.js',
  'state.js',
  'snellman.js',
  'save.js',
  'unittest.js',
  'fireice.js'
];

for(var i = 0; i < files.length; i++) {
  var filename = path.join(__dirname, files[i]);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename: files[i]});
}

// The tests need render.js helpers such as getPlayerResourcesString, but do
// not need to construct a real visual board in the terminal.
context.drawHud = function() {};
context.drawMap = function() {};
context.displayLog = function() {};
context.beginGame();

if(!context.runAllUnitTests()) process.exitCode = 1;

// The benchmark has its own VM loader.  Exercise one complete mirrored pair so
// regressions in the headless entry point are caught with the normal test run.
var childProcess = require('child_process');
var benchmarkResult = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'benchmark.js'), '--pairs', '1', '--seed', '12345', '--expect-equivalent', '--verify-reproducibility', '--json'],
    {encoding: 'utf8'});
var benchmarkReplayResult = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'benchmark.js'), '--pairs', '1', '--seed', '12345', '--expect-equivalent', '--verify-reproducibility', '--json'],
    {encoding: 'utf8'});
var benchmarkProgressResult = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'benchmark.js'), '--pairs', '1', '--seed', '12345', '--expect-equivalent'],
    {encoding: 'utf8'});
var benchmarkCompetitiveResult = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'benchmark.js'), '--pairs', '20', '--seed', '12345', '--json'],
    {encoding: 'utf8'});
var benchmarkReport;
var benchmarkReplayReport;
var benchmarkCompetitiveReport;
try {
  benchmarkReport = JSON.parse(benchmarkResult.stdout);
  benchmarkReplayReport = JSON.parse(benchmarkReplayResult.stdout);
  benchmarkCompetitiveReport = JSON.parse(benchmarkCompetitiveResult.stdout);
} catch(error) {
  console.error('Benchmark smoke test did not produce JSON: ' + benchmarkResult.stderr + benchmarkCompetitiveResult.stderr);
  process.exitCode = 1;
}
if(benchmarkReport && benchmarkReplayReport) {
  var stableScenarioDetail = function(report) {
    return JSON.stringify(report.scenariosDetail, function(key, value) {
      return key == 'runtimeMs' ? undefined : value;
    });
  };
  var benchmarkSmokePassed = benchmarkResult.status === 0 &&
      benchmarkReplayResult.status === 0 &&
      benchmarkProgressResult.status === 0 && benchmarkResult.stderr === '' &&
      benchmarkReport.scenarios === 1 && benchmarkReport.games === 2 &&
      benchmarkReport.completedGames === 2 && benchmarkReport.crashes.length === 0 &&
      benchmarkReport.mode === 'equivalence' &&
      benchmarkReport.reproducibility.checkedGames === 2 &&
      benchmarkReport.reproducibility.failures.length === 0 &&
      benchmarkReport.equivalence.passed === 1 &&
      /Progress 1\/1 \(100\.0%\) \| games 2\/2/.test(benchmarkProgressResult.stderr) &&
      stableScenarioDetail(benchmarkReport) == stableScenarioDetail(benchmarkReplayReport);
  console.log('Benchmark smoke test: ' + (benchmarkSmokePassed ? 'passed' : 'failed'));
  if(!benchmarkSmokePassed) process.exitCode = 1;
}
if(benchmarkCompetitiveReport) {
  var competitiveSmokePassed = benchmarkCompetitiveResult.status === 0 &&
      benchmarkCompetitiveResult.stderr === '' &&
      benchmarkCompetitiveReport.mode === 'competitive' &&
      benchmarkCompetitiveReport.scenarios === 20 &&
      benchmarkCompetitiveReport.completedGames === 40 &&
      benchmarkCompetitiveReport.paired.completedScenarios === 20 &&
      benchmarkCompetitiveReport.paired.vpDeltas.length === 20 &&
      benchmarkCompetitiveReport.crashes.length === 0 &&
      benchmarkCompetitiveReport.rejectedActions === 0 &&
      benchmarkCompetitiveReport.equivalence.failed.length > 0 &&
      (benchmarkCompetitiveReport.comparisons.traceMismatches > 0 ||
       benchmarkCompetitiveReport.comparisons.outcomeMismatches > 0);
  console.log('Competitive benchmark smoke test: ' + (competitiveSmokePassed ? 'passed' : 'failed'));
  if(!competitiveSmokePassed) process.exitCode = 1;
}

// Exercise the real deterministic score-purity position, rather than a
// synthetic scorer fixture.  Level 5 remains the characterized control;
// Level 6 must make every candidate score independent of evaluation order.
var scoreDiagnosticLevel5 = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'score_diagnostics.js'), '--positions', '20', '--seed', '12345', '--ai', '5', '--json', '--quiet'],
    {encoding: 'utf8'});
var scoreDiagnosticLevel6 = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'score_diagnostics.js'), '--positions', '20', '--seed', '12345', '--ai', '6', '--json', '--quiet'],
    {encoding: 'utf8'});
var scoreDiagnosticLevel5Report;
var scoreDiagnosticLevel6Report;
try {
  scoreDiagnosticLevel5Report = JSON.parse(scoreDiagnosticLevel5.stdout);
  scoreDiagnosticLevel6Report = JSON.parse(scoreDiagnosticLevel6.stdout);
} catch(error) {
  console.error('Score-purity regression test did not produce JSON: ' +
      scoreDiagnosticLevel5.stderr + scoreDiagnosticLevel6.stderr);
  process.exitCode = 1;
}
if(scoreDiagnosticLevel5Report && scoreDiagnosticLevel6Report) {
  var affectedSelection = null;
  for(var i = 0; i < scoreDiagnosticLevel5Report.positionSelections.length; i++) {
    var selection = scoreDiagnosticLevel5Report.positionSelections[i];
    if(selection.scoreAffected &&
       (selection.original != selection.reversed || selection.original != selection.shuffled)) {
      affectedSelection = selection;
      break;
    }
  }
  var level6Selection = null;
  if(affectedSelection) {
    for(var j = 0; j < scoreDiagnosticLevel6Report.positionSelections.length; j++) {
      if(scoreDiagnosticLevel6Report.positionSelections[j].position == affectedSelection.position) {
        level6Selection = scoreDiagnosticLevel6Report.positionSelections[j];
        break;
      }
    }
  }
  var scorePurityPassed = scoreDiagnosticLevel5.status === 0 &&
      scoreDiagnosticLevel6.status === 0 &&
      scoreDiagnosticLevel5Report.affectedCandidates > 0 &&
      affectedSelection != null &&
      scoreDiagnosticLevel6Report.affectedCandidates === 0 &&
      level6Selection != null &&
      level6Selection.original == level6Selection.reversed &&
      level6Selection.original == level6Selection.shuffled &&
      scoreDiagnosticLevel5Report.integrityFailures.length === 0 &&
      scoreDiagnosticLevel6Report.integrityFailures.length === 0;
  console.log('Score-purity Level 5/Level 6 regression: ' + (scorePurityPassed ? 'passed' : 'failed'));
  if(!scorePurityPassed) process.exitCode = 1;
}
