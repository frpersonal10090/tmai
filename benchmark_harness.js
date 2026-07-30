/*
TM AI benchmark harness.

This file deliberately runs on the browser-style game globals.  benchmark.js
loads it in a small Node VM with the same source-file order as run_tests.js.
It does not alter normal game startup, rules, or actor implementations.
*/

function benchmarkSeededRandom(seed) {
  var state = seed >>> 0;
  return function() {
    state = (state + 0x6D2B79F5) >>> 0;
    var value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// This is called only by benchmark.js, whose VM has a private Math object.
function setBenchmarkRandomSeed(seed) {
  Math.random = benchmarkSeededRandom(seed);
}

function benchmarkMixSeed(seed, salt) {
  var value = (seed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function benchmarkDefaultParams() {
  return {
    numplayers: 2,
    startplayer: -1,
    finalscoring: -1,
    worldGenerator: initStandardWorld,
    presetfaction: ['random', 'random'],
    presetround: [T_NONE, T_NONE, T_NONE, T_NONE, T_NONE, T_NONE],
    presetbonus: {},
    allai: true,
    newcultistsrule: true,
    towntilepromo2013: true,
    bonustilepromo2013: true,
    fireice: true,
    turnorder: true,
    aiAlgorithm: 5,
    fireiceerrata: true,
    roundtilepromo2015: true,
    worldMap: 0
  };
}

function benchmarkSetActors(levels) {
  for(var i = 0; i < levels.length; i++) {
    game.players[i].human = false;
    game.players[i].actor = levels[i] == 6 ? new AILevel6() : new AILou(5);
  }
}

function benchmarkDriveUntil(finished) {
  // This is the production blocking loop.  AI actors invoke its callbacks
  // synchronously, so it needs neither DOM interaction nor timer pumping.
  gameLoopBlocking(finished);
  if(!finished()) throw new Error('headless game loop did not reach its target: ' + getCallBackStateDebugString());
}

function benchmarkCreateScenario(seed, params) {
  setBenchmarkRandomSeed(seed);
  game = new Game();
  state = new State();
  logText = '';
  initParams(params);
  initWorldForParams(params);
  initBoard();
  initPlayers(params);
  benchmarkSetActors([5, 5]);
  chooseOrRandomizePlayerFactions(params);
  chooseRoundTiles(params);
  chooseBonusTiles(params);

  state.type = S_INIT_FACTION;
  benchmarkDriveUntil(function() { return state.type == S_ACTION; });

  var setup = {
    seed: seed,
    actionSeed: benchmarkMixSeed(seed, 0xA17C10A),
    startPlayer: state.startPlayer,
    factions: [],
    world: game.world.join(','),
    roundTiles: game.roundtiles.slice(1),
    bonusTiles: []
  };
  for(var i = 0; i < game.players.length; i++) setup.factions.push(getFactionCodeName(game.players[i].getFaction()));
  for(var tile = T_BON_BEGIN + 1; tile < T_BON_END; tile++) if(game.bonustiles[tile]) setup.bonusTiles.push(tile);

  return {setup: setup, snapshot: saveGameState(game, state, undefined)};
}

function benchmarkDecisionString(result) {
  if(state.type == S_ACTION && result instanceof Array) return actionsToString(result);
  var encoded = JSON.stringify(result);
  return encoded == undefined ? String(result) : encoded;
}

function benchmarkRunGame(snapshot, levels, actionSeed) {
  var trace = [];
  var rejected = [];
  var originalExecuteResult = State.prototype.executeResult;
  var started = new Date().getTime();
  try {
    loadGameState(snapshot);
    benchmarkSetActors(levels);
    setBenchmarkRandomSeed(actionSeed);
    State.prototype.executeResult = function(playerIndex, result) {
      var stateName = getGameStateCodeName(this.type);
      var decision = benchmarkDecisionString(result);
      var error = originalExecuteResult.call(this, playerIndex, result);
      trace.push(stateName + '|seat=' + playerIndex + '|' + decision);
      if(error != '') rejected.push({seat: playerIndex, state: stateName, decision: decision, error: error});
      return error;
    };
    benchmarkDriveUntil(function() { return state.type == S_GAME_OVER; });
    var players = [];
    for(var i = 0; i < game.players.length; i++) {
      players.push({
        seat: i,
        level: levels[i],
        faction: getFactionCodeName(game.players[i].getFaction()),
        vp: game.players[i].vp
      });
    }
    return {players: players, trace: trace, rejected: rejected, runtimeMs: new Date().getTime() - started};
  } catch(error) {
    return {
      players: [],
      trace: trace,
      rejected: rejected,
      crash: error && error.stack ? error.stack : String(error),
      runtimeMs: new Date().getTime() - started
    };
  } finally {
    State.prototype.executeResult = originalExecuteResult;
  }
}

function benchmarkSameOutcome(left, right) {
  if(left.players.length != right.players.length) return false;
  for(var i = 0; i < left.players.length; i++) {
    if(left.players[i].faction != right.players[i].faction || left.players[i].vp != right.players[i].vp) return false;
  }
  return true;
}

function benchmarkSameGame(left, right) {
  if(!!left.crash != !!right.crash) return false;
  if(left.crash) return left.crash == right.crash;
  return benchmarkSameOutcome(left, right) &&
      left.trace.join('\n') == right.trace.join('\n') &&
      JSON.stringify(left.rejected) == JSON.stringify(right.rejected);
}

function benchmarkBucket(table, key) {
  if(!table[key]) table[key] = {games: 0, l5Wins: 0, l6Wins: 0, ties: 0, l5Vp: 0, l6Vp: 0};
  return table[key];
}

function benchmarkPairedBucket(table, key) {
  if(!table[key]) table[key] = {samples: 0, l5Wins: 0, l6Wins: 0, ties: 0, l5Vp: 0, l6Vp: 0, vpDeltas: []};
  return table[key];
}

function benchmarkAddPairedBucket(table, key, l5, l6) {
  var bucket = benchmarkPairedBucket(table, key);
  var delta = l6.vp - l5.vp;
  bucket.samples++;
  bucket.l5Vp += l5.vp;
  bucket.l6Vp += l6.vp;
  bucket.vpDeltas.push(delta);
  if(delta == 0) bucket.ties++;
  else if(delta < 0) bucket.l5Wins++;
  else bucket.l6Wins++;
}

function benchmarkLevelPlayers(gameResult) {
  if(gameResult.crash) return null;
  var l5 = null;
  var l6 = null;
  for(var i = 0; i < gameResult.players.length; i++) {
    if(gameResult.players[i].level == 5) l5 = gameResult.players[i];
    else if(gameResult.players[i].level == 6) l6 = gameResult.players[i];
  }
  return l5 && l6 ? {l5: l5, l6: l6} : null;
}

function benchmarkAddGameToReport(report, gameResult, onError, scenarioIndex, gameName) {
  report.rejectedActions += gameResult.rejected.length;
  if(gameResult.rejected.length && onError) {
    onError({type: 'rejected', scenario: scenarioIndex, game: gameName, rejected: gameResult.rejected});
  }
  if(gameResult.crash) {
    report.crashes.push(gameResult.crash);
    if(onError) onError({type: 'crash', scenario: scenarioIndex, game: gameName, error: gameResult.crash});
    return null;
  }
  var levels = benchmarkLevelPlayers(gameResult);
  if(!levels) {
    var invalidGame = 'benchmark game did not contain exactly one Level 5 and one Level 6 actor';
    report.crashes.push(invalidGame);
    if(onError) onError({type: 'invalid state', scenario: scenarioIndex, game: gameName, error: invalidGame});
    return null;
  }
  var l5 = levels.l5;
  var l6 = levels.l6;
  report.completedGames++;
  report.l5Vp += l5.vp;
  report.l6Vp += l6.vp;
  report.vpDifference += l6.vp - l5.vp;
  var outcome = l5.vp == l6.vp ? 'tie' : (l5.vp > l6.vp ? 'l5' : 'l6');
  if(outcome == 'tie') report.ties++;
  else if(outcome == 'l5') report.l5Wins++;
  else report.l6Wins++;

  var players = [l5, l6];
  for(var j = 0; j < players.length; j++) {
    var player = players[j];
    var faction = benchmarkBucket(report.byFaction, player.faction);
    var seat = benchmarkBucket(report.bySeat, 'seat' + player.seat);
    var buckets = [faction, seat];
    for(var k = 0; k < buckets.length; k++) {
      var bucket = buckets[k];
      bucket.games++;
      if(player.level == 5) bucket.l5Vp += player.vp;
      else bucket.l6Vp += player.vp;
      if(outcome == 'tie') bucket.ties++;
      else if(outcome == 'l5' && player.level == 5 || outcome == 'l6' && player.level == 6) {
        if(player.level == 5) bucket.l5Wins++;
        else bucket.l6Wins++;
      }
    }
  }
  return levels;
}

function benchmarkAddPairedResult(report, gameA, gameB, levelsA, levelsB) {
  if(!levelsA || !levelsB) return false;
  var paired = report.paired;
  var l5Vp = levelsA.l5.vp + levelsB.l5.vp;
  var l6Vp = levelsA.l6.vp + levelsB.l6.vp;
  var delta = l6Vp - l5Vp;
  paired.completedScenarios++;
  paired.l5Vp += l5Vp;
  paired.l6Vp += l6Vp;
  paired.vpDeltas.push(delta);
  if(delta == 0) paired.ties++;
  else if(delta < 0) paired.l5Wins++;
  else paired.l6Wins++;

  var players = [levelsA.l5, levelsA.l6, levelsB.l5, levelsB.l6];
  var byFaction = {};
  var bySeat = {};
  for(var i = 0; i < players.length; i++) {
    var player = players[i];
    var faction = byFaction[player.faction] || (byFaction[player.faction] = {});
    var seat = bySeat[player.seat] || (bySeat[player.seat] = {});
    if(player.level == 5) {
      faction.l5 = player;
      seat.l5 = player;
    } else {
      faction.l6 = player;
      seat.l6 = player;
    }
  }
  var factionKeys = Object.keys(byFaction);
  for(var j = 0; j < factionKeys.length; j++) {
    var factionPlayers = byFaction[factionKeys[j]];
    if(factionPlayers.l5 && factionPlayers.l6) {
      benchmarkAddPairedBucket(report.pairedByFaction, factionKeys[j], factionPlayers.l5, factionPlayers.l6);
    }
  }
  var seatKeys = Object.keys(bySeat);
  for(var k = 0; k < seatKeys.length; k++) {
    var seatPlayers = bySeat[seatKeys[k]];
    if(seatPlayers.l5 && seatPlayers.l6) {
      benchmarkAddPairedBucket(report.pairedBySeat, 'seat' + seatKeys[k], seatPlayers.l5, seatPlayers.l6);
    }
  }
  return true;
}

function benchmarkStatistics(values) {
  if(!values.length) {
    return {count: 0, mean: null, median: null, standardDeviation: null, standardError: null, confidence95: {low: null, high: null}, min: null, max: null};
  }
  var total = 0;
  var min = values[0];
  var max = values[0];
  for(var i = 0; i < values.length; i++) {
    total += values[i];
    if(values[i] < min) min = values[i];
    if(values[i] > max) max = values[i];
  }
  var mean = total / values.length;
  var sorted = values.slice().sort(function(left, right) { return left - right; });
  var middle = Math.floor(sorted.length / 2);
  var median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  var variance = 0;
  for(var j = 0; j < values.length; j++) variance += Math.pow(values[j] - mean, 2);
  var standardDeviation = values.length > 1 ? Math.sqrt(variance / (values.length - 1)) : 0;
  var standardError = standardDeviation / Math.sqrt(values.length);
  return {
    count: values.length,
    mean: mean,
    median: median,
    standardDeviation: standardDeviation,
    standardError: standardError,
    confidence95: {low: mean - 1.96 * standardError, high: mean + 1.96 * standardError},
    min: min,
    max: max
  };
}

function benchmarkAddStatistics(target, values) {
  var statistics = benchmarkStatistics(values);
  target.meanVpDelta = statistics.mean;
  target.medianVpDelta = statistics.median;
  target.standardDeviation = statistics.standardDeviation;
  target.standardError = statistics.standardError;
  target.confidence95 = statistics.confidence95;
  target.minVpDelta = statistics.min;
  target.maxVpDelta = statistics.max;
}

function runBenchmark(options) {
  options = options || {};
  var pairs = options.pairs == undefined ? 1 : options.pairs;
  var seed = options.seed == undefined ? 1 : options.seed;
  var onProgress = options.onProgress;
  var onError = options.onError;
  var mode = options.expectEquivalent ? 'equivalence' : 'competitive';
  var verifyReproducibility = !!options.verifyReproducibility;
  if(pairs < 1 || pairs != Math.floor(pairs)) throw new Error('pairs must be a positive integer');
  if(seed != Math.floor(seed)) throw new Error('seed must be an integer');
  var params = options.params || benchmarkDefaultParams();
  if(params.numplayers != 2) throw new Error('the initial benchmark harness supports exactly two players');

  var started = new Date().getTime();
  var report = {
    seed: seed,
    mode: mode,
    scenarios: pairs,
    games: pairs * 2,
    completedGames: 0,
    l5Wins: 0,
    l6Wins: 0,
    ties: 0,
    l5Vp: 0,
    l6Vp: 0,
    vpDifference: 0,
    rejectedActions: 0,
    crashes: [],
    byFaction: {},
    bySeat: {},
    paired: {completedScenarios: 0, l5Wins: 0, l6Wins: 0, ties: 0, l5Vp: 0, l6Vp: 0, vpDeltas: []},
    pairedByFaction: {},
    pairedBySeat: {},
    comparisons: {traceMatches: 0, traceMismatches: 0, outcomeMatches: 0, outcomeMismatches: 0, unavailable: 0},
    reproducibility: {checkedGames: 0, failures: []},
    equivalence: {passed: 0, failed: []},
    scenariosDetail: []
  };

  for(var i = 0; i < pairs; i++) {
    var scenarioSeed = benchmarkMixSeed(seed, i + 1);
    var scenario;
    try {
      scenario = benchmarkCreateScenario(scenarioSeed, params);
    } catch(error) {
      var setupCrash = error && error.stack ? error.stack : String(error);
      report.crashes.push(setupCrash);
      report.crashes.push(setupCrash);
      report.equivalence.failed.push({scenario: i, reason: 'setup crash', error: setupCrash});
      if(onError) onError({type: 'setup crash', scenario: i, error: setupCrash});
      if(onProgress) onProgress({
        completedScenarios: i + 1,
        processedGames: (i + 1) * 2,
        report: report,
        elapsedMs: new Date().getTime() - started
      });
      continue;
    }
    var gameA = benchmarkRunGame(scenario.snapshot, [5, 6], scenario.setup.actionSeed);
    var levelsA = benchmarkAddGameToReport(report, gameA, onError, i, 'A');
    var gameB = benchmarkRunGame(scenario.snapshot, [6, 5], scenario.setup.actionSeed);
    var levelsB = benchmarkAddGameToReport(report, gameB, onError, i, 'B');
    if(verifyReproducibility) {
      var originalGames = [gameA, gameB];
      var levels = [[5, 6], [6, 5]];
      for(var replayIndex = 0; replayIndex < originalGames.length; replayIndex++) {
        var replay = benchmarkRunGame(scenario.snapshot, levels[replayIndex], scenario.setup.actionSeed);
        report.reproducibility.checkedGames++;
        if(!benchmarkSameGame(originalGames[replayIndex], replay)) {
          var reproducibilityFailure = {
            scenario: i,
            game: replayIndex == 0 ? 'A' : 'B',
            setup: scenario.setup,
            originalCrash: originalGames[replayIndex].crash,
            replayCrash: replay.crash
          };
          report.reproducibility.failures.push(reproducibilityFailure);
          if(onError) onError({type: 'reproducibility', scenario: i, game: reproducibilityFailure.game, error: 'replay did not match its original game'});
        }
      }
    }
    var sameTrace = gameA.trace.join('\n') == gameB.trace.join('\n');
    var sameOutcome = benchmarkSameOutcome(gameA, gameB);
    if(levelsA && levelsB) {
      if(sameTrace) report.comparisons.traceMatches++;
      else report.comparisons.traceMismatches++;
      if(sameOutcome) report.comparisons.outcomeMatches++;
      else report.comparisons.outcomeMismatches++;
      benchmarkAddPairedResult(report, gameA, gameB, levelsA, levelsB);
    } else {
      report.comparisons.unavailable++;
    }
    if(levelsA && levelsB && sameTrace && sameOutcome) report.equivalence.passed++;
    else report.equivalence.failed.push({
      scenario: i,
      setup: scenario.setup,
      sameTrace: sameTrace,
      sameOutcome: sameOutcome,
      gameACrash: gameA.crash,
      gameBCrash: gameB.crash
    });
    report.scenariosDetail.push({scenario: i, setup: scenario.setup, gameA: gameA, gameB: gameB});
    if(onProgress) onProgress({
      completedScenarios: i + 1,
      processedGames: (i + 1) * 2,
      report: report,
      elapsedMs: new Date().getTime() - started,
      scenario: report.scenariosDetail[report.scenariosDetail.length - 1]
    });
  }

  report.averageVpL5 = report.completedGames ? report.l5Vp / report.completedGames : 0;
  report.averageVpL6 = report.completedGames ? report.l6Vp / report.completedGames : 0;
  report.averageVpDifference = report.completedGames ? report.vpDifference / report.completedGames : 0;
  benchmarkAddStatistics(report.paired, report.paired.vpDeltas);
  var pairedFactionKeys = Object.keys(report.pairedByFaction);
  for(var j = 0; j < pairedFactionKeys.length; j++) {
    benchmarkAddStatistics(report.pairedByFaction[pairedFactionKeys[j]], report.pairedByFaction[pairedFactionKeys[j]].vpDeltas);
  }
  var pairedSeatKeys = Object.keys(report.pairedBySeat);
  for(var k = 0; k < pairedSeatKeys.length; k++) {
    benchmarkAddStatistics(report.pairedBySeat[pairedSeatKeys[k]], report.pairedBySeat[pairedSeatKeys[k]].vpDeltas);
  }
  report.runtimeMs = new Date().getTime() - started;
  report.gamesPerSecond = report.runtimeMs ? report.completedGames / (report.runtimeMs / 1000) : 0;
  return report;
}
