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

function benchmarkBucket(table, key) {
  if(!table[key]) table[key] = {games: 0, l5Wins: 0, l6Wins: 0, ties: 0, l5Vp: 0, l6Vp: 0};
  return table[key];
}

function benchmarkAddGameToReport(report, gameResult, onError, scenarioIndex, gameName) {
  report.rejectedActions += gameResult.rejected.length;
  if(gameResult.rejected.length && onError) {
    onError({type: 'rejected', scenario: scenarioIndex, game: gameName, rejected: gameResult.rejected});
  }
  if(gameResult.crash) {
    report.crashes.push(gameResult.crash);
    if(onError) onError({type: 'crash', scenario: scenarioIndex, game: gameName, error: gameResult.crash});
    return;
  }
  var l5 = null;
  var l6 = null;
  for(var i = 0; i < gameResult.players.length; i++) {
    if(gameResult.players[i].level == 5) l5 = gameResult.players[i];
    else if(gameResult.players[i].level == 6) l6 = gameResult.players[i];
  }
  if(!l5 || !l6) {
    report.crashes.push('benchmark game did not contain exactly one Level 5 and one Level 6 actor');
    return;
  }
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
}

function runBenchmark(options) {
  options = options || {};
  var pairs = options.pairs == undefined ? 1 : options.pairs;
  var seed = options.seed == undefined ? 1 : options.seed;
  var onProgress = options.onProgress;
  var onError = options.onError;
  if(pairs < 1 || pairs != Math.floor(pairs)) throw new Error('pairs must be a positive integer');
  if(seed != Math.floor(seed)) throw new Error('seed must be an integer');
  var params = options.params || benchmarkDefaultParams();
  if(params.numplayers != 2) throw new Error('the initial benchmark harness supports exactly two players');

  var started = new Date().getTime();
  var report = {
    seed: seed,
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
    benchmarkAddGameToReport(report, gameA, onError, i, 'A');
    var gameB = benchmarkRunGame(scenario.snapshot, [6, 5], scenario.setup.actionSeed);
    benchmarkAddGameToReport(report, gameB, onError, i, 'B');
    var sameTrace = gameA.trace.join('\n') == gameB.trace.join('\n');
    var sameOutcome = benchmarkSameOutcome(gameA, gameB);
    if(!gameA.crash && !gameB.crash && sameTrace && sameOutcome) report.equivalence.passed++;
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
  report.runtimeMs = new Date().getTime() - started;
  return report;
}
