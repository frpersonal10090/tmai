#!/usr/bin/env node
// Usage: node score_diagnostics.js --positions 100 --seed 12345 [--ai 5|6] [--json] [--quiet]

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

function createDiagnosticContext() {
  var body = makeElement();
  var diagnosticMath = Object.create(Math);
  diagnosticMath.random = Math.random;
  var document = {
    body: body,
    documentElement: {scrollLeft: 0, scrollTop: 0},
    createElement: function() { return makeElement(); },
    onkeydown: null
  };
  var context = {
    console: console,
    Math: diagnosticMath,
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
    'state.js', 'snellman.js', 'save.js', 'fireice.js', 'benchmark_harness.js',
    'score_diagnostics_harness.js'
  ];
  for(var i = 0; i < files.length; i++) {
    var filename = path.join(__dirname, files[i]);
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename: files[i]});
  }
}

function parseArgs(argv) {
  var options = {positions: 100, seed: 1, aiLevel: 5, json: false, quiet: false};
  for(var i = 0; i < argv.length; i++) {
    if(argv[i] == '--positions') options.positions = Number(argv[++i]);
    else if(argv[i] == '--seed') options.seed = Number(argv[++i]);
    else if(argv[i] == '--ai') options.aiLevel = Number(argv[++i]);
    else if(argv[i] == '--json') options.json = true;
    else if(argv[i] == '--quiet') options.quiet = true;
    else if(argv[i] == '--help') options.help = true;
    else throw new Error('unknown argument: ' + argv[i]);
  }
  return options;
}

function formatElapsed(milliseconds) {
  if(milliseconds < 1000) return milliseconds + 'ms';
  return (milliseconds / 1000).toFixed(1) + 's';
}

function formatCounts(counts) {
  var keys = Object.keys(counts).sort();
  if(!keys.length) return 'none';
  var result = [];
  for(var i = 0; i < keys.length; i++) result.push(keys[i] + ': ' + counts[keys[i]]);
  return result.join(', ');
}

function formatReport(report) {
  var lines = [
    'Terra Mystica AI score-purity diagnostic',
    'AI level: ' + report.aiLevel,
    'seed: ' + report.seed,
    'positions sampled: ' + report.positionsSampled + '/' + report.requestedPositions,
    'turns analyzed: ' + report.turnsAnalyzed,
    'sampled factions: ' + formatCounts(report.factionsAnalyzed),
    'sampled rounds: ' + formatCounts(report.roundsAnalyzed),
    'total action candidates analyzed: ' + report.totalCandidates,
    'candidates whose scores changed with evaluation order: ' + report.affectedCandidates,
    'affected candidates: ' + report.affectedCandidatePercentage.toFixed(2) + '%',
    'typical score difference (median absolute): ' + report.typicalScoreDifference,
    'maximum score difference: ' + report.maximumScoreDifference,
    'turns where selected action changed: ' + report.selectedActionChanges,
    'selected-action changes on turns with score changes: ' + report.selectedActionChangesWithScoreChanges,
    'affected factions: ' + formatCounts(report.affectedFactions),
    'affected rounds: ' + formatCounts(report.affectedRounds),
    'affected action types: ' + formatCounts(report.affectedActionTypes),
    'tile scorer candidates checked: bonus ' + report.tileScorers.bonus.candidates +
        ', favor ' + report.tileScorers.favor.candidates + ', town ' + report.tileScorers.town.candidates,
    'tile scorer order-sensitive candidates: bonus ' + report.tileScorers.bonus.affected +
        ', favor ' + report.tileScorers.favor.affected + ', town ' + report.tileScorers.town.affected,
    'real game-state-corrupting scorer passes: ' + report.realGameStateCorruption.count +
        ' (' + formatCounts(report.realGameStateCorruption.byScorer) + ')',
    'state-isolation integrity failures: ' + report.integrityFailures.length,
    'scenarios used: ' + report.scenariosUsed,
    'runtime: ' + formatElapsed(report.runtimeMs)
  ];
  var mutationNames = Object.keys(report.mutations).sort();
  lines.push('observed scoring mutations:');
  if(!mutationNames.length) lines.push('  none');
  for(var i = 0; i < mutationNames.length; i++) lines.push('  ' + mutationNames[i] + ': ' + report.mutations[mutationNames[i]].count);
  if(report.selectedActionChangeSamples.length) lines.push('selected-action samples: ' + JSON.stringify(report.selectedActionChangeSamples));
  if(report.integrityFailures.length) lines.push('integrity failures: ' + JSON.stringify(report.integrityFailures));
  return lines.join('\n');
}

function main() {
  var options = parseArgs(process.argv.slice(2));
  if(options.help) {
    console.log('Usage: node score_diagnostics.js --positions <positive integer> --seed <integer> [--ai 5|6] [--json] [--quiet]');
    return;
  }
  var context = createDiagnosticContext();
  loadSources(context);
  var interval = Math.max(1, Math.ceil(options.positions / 20));
  var report = context.runScoreDiagnostics({
    positions: options.positions,
    seed: options.seed,
    aiLevel: options.aiLevel,
    onProgress: function(progress) {
      if(options.quiet || options.json) return;
      if(progress.positionsSampled == 1 || progress.positionsSampled == progress.requestedPositions || progress.positionsSampled % interval == 0) {
        console.error('Progress ' + progress.positionsSampled + '/' + progress.requestedPositions +
            ' | candidates ' + progress.report.totalCandidates +
            ' | affected ' + progress.report.affectedCandidates +
            ' | selected changes ' + progress.report.selectedActionChanges +
            ' | elapsed ' + formatElapsed(progress.elapsedMs));
      }
    }
  });
  console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
  // A detected production mutation is a finding, not a diagnostic failure.
  // Only failed isolation makes the comparison itself untrustworthy.
  if(!report.trustworthy) process.exitCode = 1;
}

try {
  main();
} catch(error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}
