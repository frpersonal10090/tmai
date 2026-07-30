/*
TM AI score-purity diagnostic harness.

This file runs only in score_diagnostics.js's private VM.  It deliberately
does not change the browser game or either production AI implementation.
*/

function scoreDiagnosticsStable(value) {
  if(value === undefined) return '"<undefined>"';
  if(value === null) return 'null';
  if(typeof value == 'number') {
    if(value != value) return '"<NaN>"';
    if(value == Infinity) return '"<Infinity>"';
    if(value == -Infinity) return '"<-Infinity>"';
    return String(value);
  }
  if(typeof value == 'boolean') return value ? 'true' : 'false';
  if(typeof value == 'string') return JSON.stringify(value);
  if(typeof value == 'function') return '"<function>"';
  if(value instanceof Array) {
    var parts = [];
    for(var i = 0; i < value.length; i++) parts.push(scoreDiagnosticsStable(value[i]));
    return '[' + parts.join(',') + ']';
  }
  var keys = Object.keys(value).sort();
  var objectParts = [];
  for(var j = 0; j < keys.length; j++) {
    objectParts.push(JSON.stringify(keys[j]) + ':' + scoreDiagnosticsStable(value[keys[j]]));
  }
  return '{' + objectParts.join(',') + '}';
}

function scoreDiagnosticsValueForReport(value) {
  var encoded = scoreDiagnosticsStable(value);
  return encoded.length > 180 ? encoded.substring(0, 177) + '...' : encoded;
}

function scoreDiagnosticsDiff(before, after, path, result, limit) {
  if(scoreDiagnosticsStable(before) == scoreDiagnosticsStable(after)) return;
  if(result.length >= limit) return;
  var beforeObject = before && typeof before == 'object';
  var afterObject = after && typeof after == 'object';
  if(!beforeObject || !afterObject || before instanceof Array != after instanceof Array) {
    result.push({path: path, before: scoreDiagnosticsValueForReport(before), after: scoreDiagnosticsValueForReport(after)});
    return;
  }
  var seen = {};
  var keys = Object.keys(before).concat(Object.keys(after)).sort();
  for(var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if(seen[key]) continue;
    seen[key] = true;
    scoreDiagnosticsDiff(before[key], after[key], path + (before instanceof Array ? '[' + key + ']' : '.' + key), result, limit);
    if(result.length >= limit) return;
  }
}

function scoreDiagnosticsGameSnapshot() {
  var result = saveGameState(game, state, undefined);
  for(var i = 0; i < result.players.length; i++) delete result.players[i].actor;
  return result;
}

function scoreDiagnosticsDerivedSnapshot() {
  var waterKeys = [];
  for(var i = 0; i < waterDistanceCalculated.length; i++) {
    if(waterDistanceCalculated[i]) waterKeys.push(i);
  }
  return {
    townclusters: clone(townclusters),
    townmap: clone(townmap),
    networkclusters: clone(networkclusters),
    networkmap: clone(networkmap),
    waterDistanceKeys: waterKeys,
    colorToPlayerMap: clone(colorToPlayerMap),
    auxColorToPlayerMap: clone(auxColorToPlayerMap),
    woodColorToPlayerMap: clone(woodColorToPlayerMap)
  };
}

function scoreDiagnosticsOptionalGlobal(name) {
  return typeof global[name] == 'undefined' ? {present: false} : {present: true, value: clone(global[name])};
}

function scoreDiagnosticsTransientSnapshot() {
  return {
    lou: {xfaction: AILou.xfaction, ybonus: AILou.ybonus, yfavor: AILou.yfavor, info: AILou.info},
    townSelected: clone(townSelected),
    upgradeSA: upgradeSA,
    twoTown: scoreDiagnosticsOptionalGlobal('twoTown'),
    newColor: scoreDiagnosticsOptionalGlobal('newColor'),
    useToken: scoreDiagnosticsOptionalGlobal('useToken'),
    icult: scoreDiagnosticsOptionalGlobal('icult'),
    callbackState: callbackState
  };
}

function scoreDiagnosticsRestoreOptionalGlobal(name, entry) {
  if(entry.present) global[name] = clone(entry.value);
  else delete global[name];
}

function scoreDiagnosticsRestore(snapshot, transient) {
  loadGameState(snapshot);
  // loadGameState does the first two of these.  Doing all of them explicitly
  // makes the reset contract clear and prevents stale derived state from a
  // previous candidate pass.
  waterDistanceCalculated = [];
  recalculateColorMaps();
  calculateTownClusters();
  calculateNetworkClusters();
  AILou.xfaction = transient.lou.xfaction;
  AILou.ybonus = transient.lou.ybonus;
  AILou.yfavor = transient.lou.yfavor;
  AILou.info = transient.lou.info;
  townSelected = clone(transient.townSelected);
  upgradeSA = transient.upgradeSA;
  scoreDiagnosticsRestoreOptionalGlobal('twoTown', transient.twoTown);
  scoreDiagnosticsRestoreOptionalGlobal('newColor', transient.newColor);
  scoreDiagnosticsRestoreOptionalGlobal('useToken', transient.useToken);
  scoreDiagnosticsRestoreOptionalGlobal('icult', transient.icult);
  callbackState = transient.callbackState;
}

function scoreDiagnosticsMutableSnapshot(actor) {
  return {
    game: scoreDiagnosticsGameSnapshot(),
    actor: {
      ail: actor.ail,
      scoreActionValues: clone(actor.scoreActionValues),
      restrictions: clone(actor.restrictions)
    },
    derived: scoreDiagnosticsDerivedSnapshot(),
    globals: scoreDiagnosticsTransientSnapshot()
  };
}

function scoreDiagnosticsActionTypes(actions) {
  var result = [];
  for(var i = 0; i < actions.length; i++) result.push(getActionCodeName(actions[i].type));
  return result;
}

function scoreDiagnosticsCandidates(actions) {
  var seen = {};
  var usedIds = {};
  var result = [];
  for(var i = 0; i < actions.length; i++) {
    var sequence = clone(actions[i]);
    var key = scoreDiagnosticsStable(sequence);
    var occurrence = seen[key] || 0;
    seen[key] = occurrence + 1;
    var hash = 2166136261;
    for(var j = 0; j < key.length; j++) {
      hash ^= key.charCodeAt(j);
      hash = Math.imul(hash, 16777619);
    }
    var id = 'action-' + (hash >>> 0).toString(16) + '-' + occurrence;
    while(usedIds[id]) id += '-collision';
    usedIds[id] = true;
    result.push({
      id: id,
      actions: sequence,
      types: scoreDiagnosticsActionTypes(sequence),
      display: actionsToString(sequence)
    });
  }
  return result;
}

function scoreDiagnosticsShuffled(items, seed) {
  var result = items.slice(0);
  var random = benchmarkSeededRandom(seed);
  for(var i = result.length - 1; i > 0; i--) {
    var j = Math.floor(random() * (i + 1));
    var temporary = result[i];
    result[i] = result[j];
    result[j] = temporary;
  }
  return result;
}

function scoreDiagnosticsOrder(candidates, type, seed) {
  if(type == 'original') return candidates.slice(0);
  if(type == 'reversed') return candidates.slice(0).reverse();
  return scoreDiagnosticsShuffled(candidates, seed);
}

function scoreDiagnosticsMutationName(path) {
  if(path.charAt(0) == '.') path = path.substring(1);
  if(path.indexOf('actor.scoreActionValues.networkcon') == 0) return 'actor.scoreActionValues.networkcon';
  if(path.indexOf('derived.networkclusters') == 0) return 'derived.networkclusters (temporary-board cache)';
  if(path.indexOf('derived.networkmap') == 0) return 'derived.networkmap (temporary-board cache)';
  if(path.indexOf('derived.townclusters') == 0) return 'derived.townclusters (temporary-board cache)';
  if(path.indexOf('derived.townmap') == 0) return 'derived.townmap (temporary-board cache)';
  if(path.indexOf('derived.waterDistanceKeys') == 0) return 'derived.waterDistanceCalculated (cache fill)';
  if(path.indexOf('game.buildings') == 0) return 'game.buildings (temporary-board cleanup)';
  if(/^game\.players\[\d+\]\.favortiles/.test(path)) return 'player.favortiles (temporary favor-tile cleanup)';
  if(path.indexOf('globals.lou.ybonus') == 0) return 'AILou.ybonus';
  if(path.indexOf('globals.lou.yfavor') == 0) return 'AILou.yfavor';
  if(path.indexOf('globals.icult') == 0) return 'global icult';
  return path;
}

function scoreDiagnosticsRecordMutations(report, mutations, context) {
  for(var i = 0; i < mutations.length; i++) {
    var mutation = mutations[i];
    var name = scoreDiagnosticsMutationName(mutation.path);
    if(!report.mutations[name]) report.mutations[name] = {count: 0, samples: []};
    var entry = report.mutations[name];
    entry.count++;
    if(entry.samples.length < 3) {
      entry.samples.push({
        scorer: context.scorer,
        position: context.position,
        round: context.round,
        faction: context.faction,
        candidate: context.candidate,
        actionTypes: context.actionTypes,
        before: mutation.before,
        after: mutation.after
      });
    }
  }
}

function scoreDiagnosticsRecordCoreCorruption(report, mutations, context) {
  var core = [];
  for(var i = 0; i < mutations.length; i++) {
    if(mutations[i].path.replace(/^\./, '').indexOf('game.') == 0) core.push(mutations[i]);
  }
  if(!core.length) return;
  report.realGameStateCorruption.count++;
  report.realGameStateCorruption.byScorer[context.scorer] = (report.realGameStateCorruption.byScorer[context.scorer] || 0) + 1;
  if(report.realGameStateCorruption.samples.length < 5) {
    report.realGameStateCorruption.samples.push({
      position: context.position,
      scorer: context.scorer,
      candidate: context.candidate,
      changes: core
    });
  }
}

function scoreDiagnosticsScoreActionPass(prepared, orderType, orderSeed, selectionSeed, report, position) {
  scoreDiagnosticsRestore(prepared.snapshot, prepared.transient);
  var actor = game.players[prepared.playerIndex].actor;
  var player = game.players[prepared.playerIndex];
  var ordered = scoreDiagnosticsOrder(prepared.candidates, orderType, orderSeed);
  var actionInput = [];
  for(var i = 0; i < ordered.length; i++) actionInput.push(clone(ordered[i].actions));
  var inputBefore = scoreDiagnosticsStable(actionInput);
  var scores = [];
  var byId = {};
  var baseline = scoreDiagnosticsMutableSnapshot(actor);

  for(var j = 0; j < actionInput.length; j++) {
    var before = scoreDiagnosticsMutableSnapshot(actor);
    var score = actor.scoreActionAI_(player, actionInput[j], 0);
    var after = scoreDiagnosticsMutableSnapshot(actor);
    var mutations = [];
    scoreDiagnosticsDiff(before, after, '', mutations, 24);
    scoreDiagnosticsRecordMutations(report, mutations, {
      scorer: 'scoreAction', position: position, round: state.round,
      faction: getFactionCodeName(player.getFaction()), candidate: ordered[j].id,
      actionTypes: ordered[j].types
    });
    scores.push(score);
    byId[ordered[j].id] = score;
  }

  if(inputBefore != scoreDiagnosticsStable(actionInput)) {
    report.integrityFailures.push({position: position, kind: 'candidate action sequence was mutated by scoreAction'});
  }
  var afterPass = scoreDiagnosticsMutableSnapshot(actor);
  var passMutations = [];
  scoreDiagnosticsDiff(baseline, afterPass, '', passMutations, 64);
  scoreDiagnosticsRecordCoreCorruption(report, passMutations, {scorer: 'scoreAction pass', position: position, candidate: orderType});

  Math.random = benchmarkSeededRandom(selectionSeed);
  var bestIndex = AILou.pickWithBestScore(actionInput, scores, false);
  var selected = scores[bestIndex] > 0 ? ordered[bestIndex].id : 'PASS';
  if(selected == 'PASS' && state.round != 6) selected += ':bonus=' + actor.getPreferredBonusTile_(player);
  return {order: orderType, scores: byId, selected: selected, selectedScore: scores[bestIndex], passMutations: passMutations};
}

function scoreDiagnosticsTilePass(prepared, scorerName, items, scorer, orderType, orderSeed, report, position) {
  scoreDiagnosticsRestore(prepared.snapshot, prepared.transient);
  var actor = game.players[prepared.playerIndex].actor;
  var player = game.players[prepared.playerIndex];
  var ordered = scoreDiagnosticsOrder(items, orderType, orderSeed);
  var scores = {};
  var baseline = scoreDiagnosticsMutableSnapshot(actor);
  for(var i = 0; i < ordered.length; i++) {
    var before = scoreDiagnosticsMutableSnapshot(actor);
    var score = scorer(actor, player, ordered[i].value);
    var after = scoreDiagnosticsMutableSnapshot(actor);
    var mutations = [];
    scoreDiagnosticsDiff(before, after, '', mutations, 24);
    scoreDiagnosticsRecordMutations(report, mutations, {
      scorer: scorerName, position: position, round: state.round,
      faction: getFactionCodeName(player.getFaction()), candidate: ordered[i].id,
      actionTypes: []
    });
    scores[ordered[i].id] = score;
  }
  var afterPass = scoreDiagnosticsMutableSnapshot(actor);
  var passMutations = [];
  scoreDiagnosticsDiff(baseline, afterPass, '', passMutations, 64);
  scoreDiagnosticsRecordCoreCorruption(report, passMutations, {scorer: scorerName + ' pass', position: position, candidate: orderType});
  return {scores: scores, passMutations: passMutations};
}

function scoreDiagnosticsTileItems(values) {
  var result = [];
  for(var i = 0; i < values.length; i++) result.push({id: String(values[i]) + '#0', value: values[i]});
  return result;
}

function scoreDiagnosticsCompareTileScorer(prepared, name, values, scorer, seed, report, position) {
  if(!values.length) return;
  var items = scoreDiagnosticsTileItems(values);
  var original = scoreDiagnosticsTilePass(prepared, name, items, scorer, 'original', seed, report, position);
  var reversed = scoreDiagnosticsTilePass(prepared, name, items, scorer, 'reversed', seed, report, position);
  var shuffled = scoreDiagnosticsTilePass(prepared, name, items, scorer, 'shuffled', seed, report, position);
  report.tileScorers[name].candidates += items.length;
  for(var i = 0; i < items.length; i++) {
    var id = items[i].id;
    if(original.scores[id] != reversed.scores[id] || original.scores[id] != shuffled.scores[id]) {
      report.tileScorers[name].affected++;
    }
  }
}

function scoreDiagnosticsShouldProbeTileScorer(report, name, round) {
  if(report.tileScorers[name].probedRounds[round]) return false;
  report.tileScorers[name].probedRounds[round] = true;
  return true;
}

function scoreDiagnosticsIncrement(table, key) {
  table[key] = (table[key] || 0) + 1;
}

function scoreDiagnosticsAnalyzeTurn(playerIndex, position, seed, report) {
  var originalRandom = Math.random;
  var originalSnapshot = saveGameState(game, state, undefined);
  var originalTransient = scoreDiagnosticsTransientSnapshot();
  try {
    var actor = game.players[playerIndex].actor;
    var player = game.players[playerIndex];
    var beforePrepare = scoreDiagnosticsMutableSnapshot(actor);
    actor.updateScoreActionValues_(player, state.round);
    var generated = getPossibleActions(player, actor.restrictions);
    var afterPrepare = scoreDiagnosticsMutableSnapshot(actor);
    var generationMutations = [];
    scoreDiagnosticsDiff(beforePrepare, afterPrepare, '', generationMutations, 32);
    // updateScoreActionValues_ deliberately updates the actor and restrictions;
    // action generation must not alter the game position.
    scoreDiagnosticsRecordCoreCorruption(report, generationMutations, {scorer: 'candidate generation', position: position, candidate: 'all'});

    var prepared = {
      playerIndex: playerIndex,
      snapshot: saveGameState(game, state, undefined),
      transient: scoreDiagnosticsTransientSnapshot(),
      candidates: scoreDiagnosticsCandidates(generated)
    };
    scoreDiagnosticsRestore(prepared.snapshot, prepared.transient);
    var resetActor = game.players[playerIndex].actor;
    var resetBaseline = scoreDiagnosticsMutableSnapshot(resetActor);
    scoreDiagnosticsRestore(prepared.snapshot, prepared.transient);
    var resetAgain = scoreDiagnosticsMutableSnapshot(game.players[playerIndex].actor);
    if(scoreDiagnosticsStable(resetBaseline) != scoreDiagnosticsStable(resetAgain)) {
      report.integrityFailures.push({position: position, kind: 'state reset is not repeatable'});
    }

    var actionFingerprint = scoreDiagnosticsStable(prepared.candidates);
    var original = scoreDiagnosticsScoreActionPass(prepared, 'original', benchmarkMixSeed(seed, position * 11 + 1), benchmarkMixSeed(seed, position * 11 + 2), report, position);
    var reversed = scoreDiagnosticsScoreActionPass(prepared, 'reversed', benchmarkMixSeed(seed, position * 11 + 3), benchmarkMixSeed(seed, position * 11 + 2), report, position);
    var shuffled = scoreDiagnosticsScoreActionPass(prepared, 'shuffled', benchmarkMixSeed(seed, position * 11 + 4), benchmarkMixSeed(seed, position * 11 + 2), report, position);
    if(actionFingerprint != scoreDiagnosticsStable(prepared.candidates)) {
      report.integrityFailures.push({position: position, kind: 'canonical candidate set changed during diagnostic'});
    }

    var faction = getFactionCodeName(game.players[playerIndex].getFaction());
    var round = state.round;
    report.positionsSampled++;
    report.turnsAnalyzed++;
    report.totalCandidates += prepared.candidates.length;
    scoreDiagnosticsIncrement(report.factionsAnalyzed, faction);
    scoreDiagnosticsIncrement(report.roundsAnalyzed, String(round));
    var positionHasScoreChange = false;
    for(var scoreIndex = 0; scoreIndex < prepared.candidates.length; scoreIndex++) {
      var scoreId = prepared.candidates[scoreIndex].id;
      if(original.scores[scoreId] != reversed.scores[scoreId] || original.scores[scoreId] != shuffled.scores[scoreId]) {
        positionHasScoreChange = true;
        break;
      }
    }
    if(original.selected != reversed.selected || original.selected != shuffled.selected) {
      report.selectedActionChanges++;
      if(positionHasScoreChange) report.selectedActionChangesWithScoreChanges++;
      if(report.selectedActionChangeSamples.length < 20) {
        report.selectedActionChangeSamples.push({position: position, faction: faction, round: round, original: original.selected, reversed: reversed.selected, shuffled: shuffled.selected});
      }
    }
    report.positionSelections.push({
      position: position,
      faction: faction,
      round: round,
      scoreAffected: positionHasScoreChange,
      original: original.selected,
      reversed: reversed.selected,
      shuffled: shuffled.selected
    });

    for(var i = 0; i < prepared.candidates.length; i++) {
      var candidate = prepared.candidates[i];
      var baseScore = original.scores[candidate.id];
      var reverseDifference = reversed.scores[candidate.id] - baseScore;
      var shuffleDifference = shuffled.scores[candidate.id] - baseScore;
      if(reverseDifference != 0 || shuffleDifference != 0) {
        report.affectedCandidates++;
        var difference = Math.abs(reverseDifference) >= Math.abs(shuffleDifference) ? reverseDifference : shuffleDifference;
        report.scoreDifferences.push(Math.abs(difference));
        scoreDiagnosticsIncrement(report.affectedFactions, faction);
        scoreDiagnosticsIncrement(report.affectedRounds, String(round));
        for(var j = 0; j < candidate.types.length; j++) scoreDiagnosticsIncrement(report.affectedActionTypes, candidate.types[j]);
        if(report.affectedCandidateSamples.length < 30) {
          report.affectedCandidateSamples.push({
            position: position, faction: faction, round: round, candidate: candidate.id,
            actionTypes: candidate.types, display: candidate.display,
            original: baseScore, reversed: reversed.scores[candidate.id], shuffled: shuffled.scores[candidate.id]
          });
        }
      }
    }

    // These probes are intentionally separate from production selection.  They
    // use the same reset contract and audit the other tile scorers that run
    // after a candidate has been chosen.
    var probePlayer = game.players[playerIndex];
    var bonusTiles = [];
    for(var tile = T_BON_BEGIN + 1; tile < T_BON_END; tile++) if(game.bonustiles[tile]) bonusTiles.push(tile);
    if(scoreDiagnosticsShouldProbeTileScorer(report, 'bonus', state.round)) {
      scoreDiagnosticsCompareTileScorer(prepared, 'bonus', bonusTiles, function(a, p, tile) {
        return a.scoreBonusTile_(p, tile, state.round);
      }, benchmarkMixSeed(seed, position * 17 + 1), report, position);
    }

    var hasFavor = false;
    var hasTown = false;
    for(var c = 0; c < prepared.candidates.length; c++) {
      for(var a = 0; a < prepared.candidates[c].actions.length; a++) {
        hasFavor = hasFavor || prepared.candidates[c].actions[a].favtiles.length > 0;
        hasTown = hasTown || prepared.candidates[c].actions[a].twtiles.length > 0;
      }
    }
    if(hasFavor && scoreDiagnosticsShouldProbeTileScorer(report, 'favor', state.round)) {
      scoreDiagnosticsCompareTileScorer(prepared, 'favor', getPossibleFavorTiles(probePlayer, []), function(a, p, tile) {
        return a.scoreFavorTile_(p, tile, state.round);
      }, benchmarkMixSeed(seed, position * 17 + 2), report, position);
    }
    if(hasTown && scoreDiagnosticsShouldProbeTileScorer(report, 'town', state.round)) {
      scoreDiagnosticsCompareTileScorer(prepared, 'town', getPossibleTownTiles(probePlayer, []), function(a, p, tile) {
        return a.scoreTownTile_(p, tile, state.round);
      }, benchmarkMixSeed(seed, position * 17 + 3), report, position);
    }
  } finally {
    scoreDiagnosticsRestore(originalSnapshot, originalTransient);
    Math.random = originalRandom;
  }
}

function scoreDiagnosticsMedian(values) {
  if(!values.length) return 0;
  var sorted = values.slice(0).sort(function(a, b) { return a - b; });
  var middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function runScoreDiagnostics(options) {
  options = options || {};
  var requestedPositions = options.positions == undefined ? 100 : options.positions;
  var seed = options.seed == undefined ? 1 : options.seed;
  var aiLevel = options.aiLevel == undefined ? 5 : options.aiLevel;
  if(requestedPositions < 1 || requestedPositions != Math.floor(requestedPositions)) throw new Error('positions must be a positive integer');
  if(seed != Math.floor(seed)) throw new Error('seed must be an integer');
  if(aiLevel != 5 && aiLevel != 6) throw new Error('aiLevel must be 5 or 6');

  var report = {
    seed: seed,
    aiLevel: aiLevel,
    requestedPositions: requestedPositions,
    positionsSampled: 0,
    turnsAnalyzed: 0,
    totalCandidates: 0,
    affectedCandidates: 0,
    affectedCandidatePercentage: 0,
    typicalScoreDifference: 0,
    maximumScoreDifference: 0,
    selectedActionChanges: 0,
    selectedActionChangesWithScoreChanges: 0,
    factionsAnalyzed: {},
    roundsAnalyzed: {},
    affectedFactions: {},
    affectedRounds: {},
    affectedActionTypes: {},
    selectedActionChangeSamples: [],
    positionSelections: [],
    affectedCandidateSamples: [],
    scoreDifferences: [],
    mutations: {},
    realGameStateCorruption: {count: 0, byScorer: {}, samples: []},
    tileScorers: {
      bonus: {candidates: 0, affected: 0, probedRounds: {}},
      favor: {candidates: 0, affected: 0, probedRounds: {}},
      town: {candidates: 0, affected: 0, probedRounds: {}}
    },
    integrityFailures: [],
    scenariosUsed: 0,
    runtimeMs: 0
  };
  var started = new Date().getTime();
  var oldDoAction = AILou.prototype.doAction;
  var position = 0;
  var scenarioAction = 0;
  var scenarioTarget = 0;
  var scenarioCaptures = 0;
  var scenarioCaptureLimit = 0;
  try {
    AILou.prototype.doAction = function(playerIndex, callback) {
      if(state.type == S_ACTION) scenarioAction++;
      if(state.type == S_ACTION && scenarioAction >= scenarioTarget && scenarioCaptures < scenarioCaptureLimit && report.positionsSampled < requestedPositions) {
        position++;
        scoreDiagnosticsAnalyzeTurn(playerIndex, position, benchmarkMixSeed(seed, position), report);
        scenarioCaptures++;
        if(options.onProgress) options.onProgress({positionsSampled: report.positionsSampled, requestedPositions: requestedPositions, report: report, elapsedMs: new Date().getTime() - started});
      }
      // scoreDiagnosticsAnalyzeTurn restores a cloned game/actor.  Call the
      // restored actor so the actual benchmark game retains production behavior.
      return oldDoAction.call(game.players[playerIndex].actor, playerIndex, callback);
    };
    while(report.positionsSampled < requestedPositions) {
      var scenarioSeed = benchmarkMixSeed(seed, report.scenariosUsed + 1);
      var scenarioParams = benchmarkDefaultParams();
      // Stratify fresh scenarios by faction so a fixed-size run cannot miss a
      // rare faction-specific scorer such as Nomads' sandstorm branch.
      var firstFaction = report.scenariosUsed % factions.length;
      var secondFaction = (firstFaction + 7) % factions.length;
      while(factionColor(factions[firstFaction]) == factionColor(factions[secondFaction])) {
        secondFaction = (secondFaction + 1) % factions.length;
      }
      scenarioParams.presetfaction = [factions[firstFaction], factions[secondFaction]];
      var scenario = benchmarkCreateScenario(scenarioSeed, scenarioParams);
      report.scenariosUsed++;
      loadGameState(scenario.snapshot);
      benchmarkSetActors([aiLevel, aiLevel]);
      setBenchmarkRandomSeed(scenario.setup.actionSeed);
      // Small batches from deterministic fresh games spread the sample over
      // factions and rounds without spending the whole run replaying every
      // game from its opening to a single position.
      scenarioAction = 0;
      scenarioCaptureLimit = Math.min(5, requestedPositions - report.positionsSampled);
      scenarioTarget = 1 + benchmarkMixSeed(seed, report.scenariosUsed * 0x9E3779B9) % 24;
      // Sandstorm is available before Nomads build their stronghold; probing
      // their early second-round window exercises its candidate scorer.
      if(firstFaction == F_NOMADS) scenarioTarget = 9;
      // Every fifth scenario intentionally probes a later phase of a game.
      if(firstFaction != F_NOMADS && report.scenariosUsed % 5 == 0) scenarioTarget = 45 + benchmarkMixSeed(seed, report.scenariosUsed * 0x85EBCA6B) % 15;
      scenarioCaptures = 0;
      benchmarkDriveUntil(function() { return report.positionsSampled >= requestedPositions || scenarioCaptures >= scenarioCaptureLimit || state.type == S_GAME_OVER; });
    }
  } finally {
    AILou.prototype.doAction = oldDoAction;
  }
  report.affectedCandidatePercentage = report.totalCandidates ? report.affectedCandidates * 100 / report.totalCandidates : 0;
  report.typicalScoreDifference = scoreDiagnosticsMedian(report.scoreDifferences);
  for(var i = 0; i < report.scoreDifferences.length; i++) report.maximumScoreDifference = Math.max(report.maximumScoreDifference, report.scoreDifferences[i]);
  delete report.scoreDifferences;
  report.runtimeMs = new Date().getTime() - started;
  report.trustworthy = report.integrityFailures.length == 0;
  return report;
}
