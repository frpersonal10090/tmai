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
    [path.join(__dirname, 'benchmark.js'), '--pairs', '1', '--seed', '12345', '--json'],
    {encoding: 'utf8'});
var benchmarkReplayResult = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'benchmark.js'), '--pairs', '1', '--seed', '12345', '--json'],
    {encoding: 'utf8'});
var benchmarkReport;
var benchmarkReplayReport;
try {
  benchmarkReport = JSON.parse(benchmarkResult.stdout);
  benchmarkReplayReport = JSON.parse(benchmarkReplayResult.stdout);
} catch(error) {
  console.error('Benchmark smoke test did not produce JSON: ' + benchmarkResult.stderr);
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
      benchmarkReport.scenarios === 1 && benchmarkReport.games === 2 &&
      benchmarkReport.completedGames === 2 && benchmarkReport.crashes.length === 0 &&
      benchmarkReport.equivalence.passed === 1 &&
      stableScenarioDetail(benchmarkReport) == stableScenarioDetail(benchmarkReplayReport);
  console.log('Benchmark smoke test: ' + (benchmarkSmokePassed ? 'passed' : 'failed'));
  if(!benchmarkSmokePassed) process.exitCode = 1;
}
