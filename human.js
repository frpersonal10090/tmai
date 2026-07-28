/*
TM AI

Copyright (C) 2013 by Lode Vandevenne

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

    1. The origin of this software must not be misrepresented; you must not
    claim that you wrote the original software. If you use this software
    in a product, an acknowledgment in the product documentation would be
    appreciated but is not required.

    2. Altered source versions must be plainly marked as such, and must not be
    misrepresented as being the original software.

    3. This notice may not be removed or altered from any source
    distribution.
*/

//Human controller and parts of the UI


var Human = function() {
};
inherit(Human, Actor);

//for the human player
var mapClickFun = null;
var tileClickFun = null;
var cultClickFun = null;
// Optional setup for map-based action modes. The rules engine still performs
// the full action validation on execution; this only avoids obviously wrong
// board clicks and gives the renderer a precise set of useful highlights.
var mapActionTargetFun = null;
var mapActionTargetHelp = '';

function setMapActionTargets(help, fun) {
  mapActionTargetHelp = help;
  mapActionTargetFun = fun;
}

// Keep the setup map affordance tied to the same conditions that the rules
// engine uses. This is deliberately only a UI helper: placeInitialDwelling
// remains the final authority when the click is submitted.
function isInitialDwellingTarget(player, x, y) {
  return player &&
      (player.landdist != 0 || touchesWater(x, y)) &&
      getWorld(x, y) == player.auxcolor &&
      getBuilding(x, y)[0] == B_NONE &&
      player.b_d > 0;
}

//enum for human action states. This is a sub-division of the main game-states for human UI only.
//By locking certain activities into certain states, ruining the game by overwriting the mapClickFun etc... with something different is prevented
var HS_MAIN = 1; //no state means you're choosing action sequence. Only here, the Execute button should be visible (if also gamestate is S_ACTION)
var HS_MAP = 2; //must click the map for something other than dig or normal build (e.g. upgrade, bridge endpoint, mermaids town tile, witches dwelling, ...)
var HS_DIG = 3; //must click the map for dig and/or build
var HS_CULT = 4; //must go on the cult track
var HS_BONUS_TILE = 5;
var HS_FAVOR_TILE = 6;
var HS_TOWN_TILE = 7;
var HS_PRIEST_COLOR = 8;
var HS_OTHER = 9; //custom dialog, ...

var humanstate = HS_MAIN;

var undoGameStates = []; //remember game state from last action
var undoIndex = 0;

function humanStateBusy() {
  return mapClickFun != null || tileClickFun != null || cultClickFun != null;
}

//Sets the game to wait for the human to click on something, e.g. click on the map to choose dig/build location.
//hstate: the HS state, e.g. HS_DIG
//helptext: text shown in the action area of the human
//fun: a callback called with the click result of the human. E.g. the tile coordinates in case of HS_MAP, color in case of HS_PRIEST_COLOR, ...
//NOTE: Typically your callback should call "clearHumanState()" at the end.
function setHumanState(hstate, helptext, fun) {
  if(humanStateBusy()) {
    throw new Error('should not set callback if one is already active');
  }
  humanstate = hstate;
  if(helptext) {
    setHelp(helptext);
  }
  if(hstate == HS_MAP || hstate == HS_DIG) mapClickFun = fun;
  else if(hstate == HS_BONUS_TILE || hstate == HS_FAVOR_TILE || hstate == HS_TOWN_TILE) tileClickFun = fun;
  else if(hstate == HS_CULT) cultClickFun = fun;
  else if(hstate == HS_PRIEST_COLOR) Human.chooseColorDialog(state.currentPlayer, fun);
  drawHud();
}

var onClearHumanState = []; //e.g. for queueHumanState

function clearHumanState() {
  humanstate = HS_MAIN;
  clearHelp();
  mapClickFun = null;
  tileClickFun = null;
  cultClickFun = null;
  mapActionTargetFun = null;
  mapActionTargetHelp = '';
  // Choice modals belong to the paused human input state. Clear them before
  // the HUD redraw so a completed bonus, favor or town choice never lingers.
  popupElement.innerHTML = '';
  if(game.players.length > 0) drawHud();
  // notify the clearHumanState listeners and clear onClearHumanState.
  var temp = onClearHumanState;
  onClearHumanState = [];
  for(var i = 0; i < temp.length; i++) temp[i]();
}

//necessary for those cases where multiple happenings requiring human states are triggered at once
//e.g. when forming town while using multi-spade dig action, where you need to pick town tile, then continue digging
//see setHumanState for documentation on the parameters
function queueHumanState(state, helptext, fun) {
  if(humanStateBusy()) {
    onClearHumanState.push(function() {
      setHumanState(state, helptext, fun);
    });
  }
  else setHumanState(state, helptext, fun);
}

var pactions = []; //your sequence of actions until you press "execute"

function prepareAction(action) {
  if(state.type != S_ACTION) {
    return; //not supposed to do actions while gamestate is in another state
  }

  var player = getCurrentPlayer();

  //burn power if needed, but only if this is the first action, otherwise it's possible that e.g. you actually do have enough power, like from mermaids water town formation
  if(isPowerOctogonAction(action.type) && pactions.length == 0) {
    var power = player.pw2;
    for(var i = 0; i < pactions.length; i++) {
      //ACTUALLY, there are also other things that alter power: mermaids town giving power tile, chaos double action, ...
      //BUT instead it already looks above that this is the first action, so in fact this is redundant. But left for in case it'd be made more advance. Then all power altering actions must be checked.
      if(pactions[i].type == A_BURN) power++;
    }
    var needed = player.getActionCost(action.type)[3];

    while(power < needed) {
      power++;
      pactions.push(new Action(A_BURN));
    }
  }

  //automatically add tunneling/carpet if needed
  if(player.faction == F_FAKIRS || player.faction == F_DWARVES) {
    if(isBuildDwellingAction(action) || isTransformAction(action.type)) {
      var hastunnel = false;
      for(var i = 0; i < pactions.length; i++) {
        if(pactions[i].type == A_TUNNEL || pactions[i].type == A_CARPET) {
          hastunnel = true;
        }
      }
      if(!hastunnel && onlyReachableThroughFactionSpecial(player, action.co[0], action.co[1])) {
        var a = new Action(player.faction == F_DWARVES ? A_TUNNEL : A_CARPET);
        a.co = action.co;
        pactions.push(a);
      }
    }
  }

  pactions.push(action);

  if(player.faction == F_DARKLINGS && action.type == A_UPGRADE_SH) {
    //take the conversions into account
    var testres = testConvertSequence(player, pactions);
    //don't include converting 3pw into workers as well: the AI can extend this action sequence afterwards if it wants to do that.
    var num = Math.min(3, testres[1] - 4);
    num = Math.min(num, player.pp - testres[2]);
    for(var i = 0; i < num; i++) pactions.push(new Action(A_CONVERT_1W_1P));
  }

  actionEl.innerHTML = actionsToString(pactions);
  updateActionPlanSummary();

  var cults = []; //for acolytes
  var cultincome = player.getFaction().getActionIncome(player, action.type)[R_FREECULT];
  var actionincome = player.getFaction().getActionIncome(player, action.type);

  // Recursive because multiple decisions may be required for a single action.
  function tryPrepareAction(action) {
    actionEl.innerHTML = actionsToString(pactions);
    updateActionPlanSummary();
    if(action.type == A_PASS && action.bontile == T_NONE && state.round != 6) {
      var fun = function(tile) {
        if(!isBonusTile(tile)) return;
        action.bontile = tile;
        clearHumanState();
        tryPrepareAction(action);
      };
      queueHumanState(HS_BONUS_TILE, 'choose a bonus tile for passing', fun);
    }
    else if(action.favtiles.length < actionGivesFavorTile(player, action)) {
      setHelp('choose a favor tile', true);
      var fun = function(tile) {
        if(!isFavorTile(tile)) return;
        action.favtiles.push(tile);
        clearHumanState();
        tryPrepareAction(action);
      };
      queueHumanState(HS_FAVOR_TILE, 'choose a favor tile', fun);
    }
    //town tiles MUST be checked after favor tiles! This because there is a favor tile that can turn the action into a town-creation action.
    else if(action.twtiles.length < actionCreatesTown(player, action, pactions)) {
      var fun = function(tile) {
        if(!isTownTile(tile)) return;
        action.twtiles.push(tile);
        updateWToPConversionAfterDarklingsSHTownTile(player, pactions);
        clearHumanState();
        tryPrepareAction(action);
      };
      queueHumanState(HS_TOWN_TILE, 'that will form a town! choose a town tile', fun);
    }
    else if(action.type == A_UPGRADE_SH && player.faction == F_HALFLINGS) {
      letClickMapForHalflingsStrongholdDigs();
    }
    //else if(action.cult == C_NONE && isTransformAction(action.type) && player.getFaction().getTransformActionCost(player, action.type, R)[R_CULT]) {
    else if(action.cult == C_NONE && isTransformAction(action.type) && player.getFaction().getTransformActionCost(player, action.type, R)[R_CULT]) {
      var fun = function(cult) {
        action.cult = cult;
        clearHumanState();
        tryPrepareAction(action);
      };
      queueHumanState(HS_CULT, 'choose cult track for pay with', fun);
    }
    else if(cultincome > cults.length) {
      var fun = function(cult) {
        cults.push(cult);
        clearHumanState();
        pactions.push(makeActionWithCult(A_ACOLYTES_CULT, cult));
        actionEl.innerHTML = actionsToString(pactions);
        updateActionPlanSummary();
        tryPrepareAction(action);
      };
      queueHumanState(HS_CULT, 'choose cult track to increase', fun);
    }
    else if(actionincome[R_BRIDGE]) {
      letClickMapForBridge(actionincome[R_BRIDGE]);
    }
    else if((action.type == A_POWER_1P || action.type == A_CONVERT_5PW_1P) && action.color == N && mayGetPriestAsColor(player)) {
      queueHumanState(HS_PRIEST_COLOR, Texts.priestUnlockText, function(color) {
        action.color = color;
        clearHumanState();
        tryPrepareAction(action);
      });
    }
  }

  tryPrepareAction(action);
}

function letClickMapForHalflingsStrongholdDigs() {
  digAndBuildFun(DBM_BUILD, 'click where to dig for halflings SH bonus')
}

// TODO: do this in tryPrepareAction instead
function letClickMapForBridge(num) {
  var remaining = num * 2;
  var cos = [];
  var clickFun = function(x, y) {
    clearHumanState();
    remaining--;
    cos.push([x,y]);
    if(remaining % 2 == 0) {
      var action = new Action(A_PLACE_BRIDGE);
      action.cos.push(cos[cos.length - 2]);
      action.cos.push(cos[cos.length - 1]);
      prepareAction(action);
    }

    if(remaining > 0) {
      var text = (remaining % 2 == 0 ? 'click bridge start point' : 'click bridge end point')
      queueHumanState(HS_MAP, text, clickFun);
    }
  };
  queueHumanState(HS_MAP, 'click bridge start point', clickFun);
}

// Compact reusable decision panel for choices which used to be a list of text
// links. It stays in the action side of the board so the map remains visible.
function makeChoicePopup(title, subtitle, width, height) {
  resetGameplayPopupPosition();
  popupElement.innerHTML = '';
  var dock = getGameplayPopupDock(width, height);
  var panelX = dock.x;
  var panelY = dock.y;
  var panel = makeSizedDiv(panelX, panelY, width, height, popupElement);
  panel.style.boxSizing = 'border-box';
  panel.style.padding = '11px';
  panel.style.background = 'linear-gradient(145deg, #fff7df, #e5c58c)';
  panel.style.border = '3px solid #69472d';
  panel.style.borderRadius = '11px';
  panel.style.boxShadow = '0 5px 12px rgba(40,25,12,.34), inset 0 0 0 1px rgba(255,255,255,.6)';
  panel.style.zIndex = 2001;

  var heading = makeText(panelX + 13, panelY + 11, title, popupElement);
  heading.style.color = '#4d3020';
  heading.style.fontFamily = 'Georgia, serif';
  heading.style.fontSize = '17px';
  heading.style.fontWeight = 'bold';
  heading.style.zIndex = 2002;
  if(subtitle) {
    var hint = makeText(panelX + 14, panelY + 33, subtitle, popupElement);
    hint.style.color = '#70513c';
    hint.style.fontSize = '10px';
    hint.style.zIndex = 2002;
  }
  makeGameplayPopupDragHandle(panelX, panelY, width);
  return {panel: panel, x: panelX, y: panelY, width: width, height: height};
}

function makeChoicePopupButton(panelInfo, x, y, width, label, color, click) {
  var button = makeSizedDiv(x, y, width, 34, popupElement);
  button.style.boxSizing = 'border-box';
  button.style.padding = '8px 7px 7px 39px';
  button.style.background = 'linear-gradient(145deg, #fffaf0, #ead7ac)';
  button.style.border = '1px solid #8d6945';
  button.style.borderRadius = '6px';
  button.style.boxShadow = '0 1px 2px rgba(62,39,18,.2), inset 0 1px 0 rgba(255,255,255,.65)';
  button.style.color = '#482f20';
  button.style.cursor = 'pointer';
  button.style.fontSize = '11px';
  button.style.fontWeight = 'bold';
  button.style.textAlign = 'left';
  button.style.userSelect = 'none';
  button.style.zIndex = 2002;
  button.title = 'Choose ' + label;
  button.innerHTML = label;

  var swatch = makeSizedDiv(x + 8, y + 7, 20, 20, popupElement);
  swatch.style.boxSizing = 'border-box';
  swatch.style.background = color;
  swatch.style.border = '2px solid rgba(65,42,25,.65)';
  swatch.style.borderRadius = '50%';
  swatch.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,.42)';
  swatch.style.pointerEvents = 'none';
  swatch.style.zIndex = 2003;
  button.onclick = click;
  button.onmouseover = function() { button.style.transform = 'translateY(-1px)'; };
  button.onmouseout = function() { button.style.transform = 'translateY(0)'; };
  return button;
}

function chooseActionColor(action) {
  var already = getNoShiftColors(getCurrentPlayer());
  var colors = [];
  for(var i = CIRCLE_BEGIN; i <= CIRCLE_END; i++) {
    if(!already[i]) colors.push(i);
  }
  var colorRows = Math.ceil(colors.length / 2);
  var popup = makeChoicePopup('Shift terrain', 'Choose the new terrain color for this action.', 438, 70 + colorRows * 39);
  var clickFun = function(color) {
    clearHumanState();
    action.color = color;
    prepareAction(action);
  };
  for(var j = 0; j < colors.length; j++) {
    var column = j % 2;
    var row = Math.floor(j / 2);
    makeChoicePopupButton(popup, popup.x + 13 + column * 206, popup.y + 56 + row * 39, 194,
        getColorName(colors[j]), getImageColor(colors[j]), bind(clickFun, colors[j]));
  }
  queueHumanState(HS_MAP, 'choose color', null);
}

function isHandlingActionInput() {
  return state.type == S_ACTION && humanstate == HS_MAIN && getCurrentPlayer().human && !showingNextButtonPanel;
}

var executeButtonFun_ = null;

// Presentation-only placement for the faction chooser. It deliberately does
// not enter the game state or save data.
var factionChooserPosition = {x: GAMEPLAY_POPUP_DOCK_X, y: GAMEPLAY_POPUP_DOCK_Y};

var executeButtonFun = function() {
  if(executeButtonFun_) executeButtonFun_();
};

var executeButtonClearFun_ = null;

var executeButtonClearFun = function() {
  if(executeButtonClearFun_) executeButtonClearFun_();
};

// The turn-plan controls are kept in the top action bar. Clearing is intentionally
// separate from the legacy "undo last" callback: on touch devices it is much
// easier to discard a whole draft turn than to repeatedly remove one action.
var clearPlannedActions = function() {
  if(!pactions.length) return;
  if(humanStateBusy()) {
    setHelp('Finish or cancel the current selection before clearing the turn plan.');
    return;
  }
  pactions = [];
  updateActionPlanSummary();
  setHelp('Turn plan cleared.');
};

function saveUndoState(undoGameState) {
  if(undoIndex + 1 < undoGameStates.length) undoGameStates.length = undoIndex + 1; //lose the redo states
  if(undoGameStates.length > 100) undoGameStates = undoGameStates.splice(50, 1); //ensure it doesn't grow too extreme
  undoGameStates.push(undoGameState);
  undoIndex = undoGameStates.length - 1;
}

Human.prototype.doAction = function(playerIndex, callback) {
  executeButtonFun_ = function() {
    var undoGameState = saveGameState(game, state, logText)
    actionEl.innerHTML = '';
    var error = callback(playerIndex, pactions);
    pactions = [];
    updateActionPlanSummary();
    if(error != '') {
      setHelp('Execute action error: ' + error);
    } else {
      executeButtonFun_ = null;
      executeButtonClearFun_ = null;
      saveUndoState(undoGameState);
    }
  };
  executeButtonClearFun_ = function() {
    pactions.pop();
    actionEl.innerHTML = actionsToString(pactions);
    updateActionPlanSummary();
  };
};


Human.prototype.chooseInitialBonusTile = function(playerIndex, callback) {
  var fun = function(tile) {
    var error = callback(playerIndex, tile);
    if(error == '') clearHumanState();
    else setHelp('invalid bonus tile, please try again');
  }
  queueHumanState(HS_BONUS_TILE, null, fun);
};


Human.prototype.chooseInitialFavorTile = function(playerIndex, callback) {
  var fun = function(tile) {
    var error = callback(playerIndex, tile);
    if(error == '') clearHumanState();
    else setHelp('invalid favor tile, please try again');
  }
  queueHumanState(HS_FAVOR_TILE, null, fun);
};

Human.prototype.chooseInitialDwelling = function(playerIndex, callback) {
  var fun = function(x, y) {
    var player = game.players[playerIndex];
    // The map overlay also filters these clicks, but keep this guard here so
    // programmatic or stale clicks get the same friendly behaviour.
    if(!isInitialDwellingTarget(player, x, y)) return;
    undoGameState = saveGameState(game, state, undefined);
    var error = callback(playerIndex, [x, y]);
    if(error == '') {
      clearHumanState();
      saveUndoState(undoGameState);
    }
    else setHelp('could not place initial dwelling: ' + error + ' - Please try again');
  };
  queueHumanState(HS_MAP, null, fun);
};

Human.prototype.chooseFaction = function(playerIndex, callback) {
  var buttonClickFun = function(faction) {
    var error = callback(playerIndex, faction);
    if(error != '') setHelp('invalid faction: ' + error + ' - Please try again');
  };

  var factions = getPossibleFactionChoices();
  var grouped = {};
  for(var i = 0; i < factions.length; i++) {
    var color = factionColor(factions[i]);
    // Shapeshifters and Riverwalkers use the two variable-terrain colours on
    // opposite sides of their faction boards, but belong in one choice group.
    var groupColor = (color == X || color == Z) ? X : color;
    if(!grouped[groupColor]) grouped[groupColor] = [];
    grouped[groupColor].push(factions[i]);
  }

  var colors = [];
  for(var color = FACTION_COLOR_BEGIN; color <= FACTION_COLOR_END; color++) {
    if(grouped[color]) colors.push(color);
  }

  // Use the same decision dock as every other gameplay choice.
  resetGameplayPopupPosition();
  popupElement.innerHTML = '';
  var panelW = 300;
  var panelH = 38 + colors.length * 34;
  var factionDock = getGameplayPopupDock(panelW, panelH);
  factionChooserPosition.x = factionDock.x;
  factionChooserPosition.y = factionDock.y;
  var panelX = factionChooserPosition.x;
  var panelY = factionChooserPosition.y;
  var chooserLayer = makeSizedDiv(panelX, panelY, panelW, panelH, popupElement);
  chooserLayer.style.zIndex = 2001;
  var panel = makeSizedDiv(0, 0, panelW, panelH, chooserLayer);
  panel.style.boxSizing = 'border-box';
  panel.style.background = 'linear-gradient(145deg, rgba(255,247,222,.96), rgba(234,213,166,.96))';
  panel.style.border = '2px solid #6e4b2d';
  panel.style.borderRadius = '12px';
  panel.style.boxShadow = '0 5px 14px rgba(29,18,9,.34), inset 0 0 0 1px rgba(255,255,255,.55)';
  panel.style.pointerEvents = 'none';

  var title = makeText(13, 9, 'Choose a faction', chooserLayer);
  title.style.fontFamily = 'Georgia, serif';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '17px';
  title.style.color = '#432a18';
  title.style.zIndex = 2002;

  var dragHandle = makeSizedDiv(214, 6, 76, 22, chooserLayer);
  dragHandle.style.boxSizing = 'border-box';
  dragHandle.style.padding = '5px 4px';
  dragHandle.style.background = 'rgba(103,72,43,.12)';
  dragHandle.style.border = '1px solid #9b7750';
  dragHandle.style.borderRadius = '5px';
  dragHandle.style.color = '#5d3e26';
  dragHandle.style.cursor = 'grab';
  dragHandle.style.fontSize = '9px';
  dragHandle.style.fontWeight = 'bold';
  dragHandle.style.letterSpacing = '.4px';
  dragHandle.style.textAlign = 'center';
  dragHandle.style.touchAction = 'none';
  dragHandle.style.userSelect = 'none';
  dragHandle.style.zIndex = 2003;
  dragHandle.style.display = 'none';
  dragHandle.innerHTML = '⠿ MOVE';
  dragHandle.title = 'Drag to place the faction chooser anywhere on screen.';
  dragHandle.onpointerdown = function(event) {
    var originX = event.clientX;
    var originY = event.clientY;
    var startX = factionChooserPosition.x;
    var startY = factionChooserPosition.y;
    dragHandle.style.cursor = 'grabbing';
    function move(moveEvent) {
      var maxX = Math.max(0, window.innerWidth - panelW);
      var maxY = Math.max(0, window.scrollY + window.innerHeight - panelH);
      factionChooserPosition.x = Math.max(0, Math.min(maxX, startX + moveEvent.clientX - originX));
      factionChooserPosition.y = Math.max(0, Math.min(maxY, startY + moveEvent.clientY - originY));
      chooserLayer.style.left = factionChooserPosition.x + 'px';
      chooserLayer.style.top = factionChooserPosition.y + 'px';
    }
    function end() {
      dragHandle.style.cursor = 'grab';
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    event.preventDefault();
  };

  makeGameplayPopupDragHandle(panelX, panelY, panelW);

  for(var g = 0; g < colors.length; g++) {
    var groupColor = colors[g];
    var groupX = 9;
    var groupY = 34 + g * 34;
    var group = makeSizedDiv(groupX, groupY, 282, 28, chooserLayer);
    group.style.boxSizing = 'border-box';
    group.style.background = 'rgba(255, 252, 240, 0.74)';
    group.style.border = '1px solid #9c7750';
    group.style.borderRadius = '6px';
    group.style.boxShadow = '0 1px 2px rgba(67, 43, 22, 0.14)';
    group.style.overflow = 'hidden';
    group.style.zIndex = 2002;

    var groupHeader = makeSizedDiv(groupX, groupY, 76, 28, chooserLayer);
    groupHeader.style.boxSizing = 'border-box';
    groupHeader.style.padding = '6px 5px';
    groupHeader.style.background = getImageColor(groupColor);
    groupHeader.style.borderRadius = '5px 0 0 5px';
    groupHeader.style.color = getHighContrastColor(getImageColor(groupColor));
    groupHeader.style.fontSize = '9px';
    groupHeader.style.fontWeight = 'bold';
    groupHeader.style.letterSpacing = '0.3px';
    groupHeader.style.textAlign = 'center';
    groupHeader.style.zIndex = 2003;
    groupHeader.innerHTML = groupColor == X ? 'VARIABLE' : getColorName(groupColor).toUpperCase();

    for(var f = 0; f < grouped[groupColor].length; f++) {
      var faction = grouped[groupColor][f];
      var card = makeSizedDiv(groupX + 81 + f * 98, groupY + 3, 94, 22, chooserLayer);
      card.style.boxSizing = 'border-box';
      card.style.padding = '4px 3px';
      card.style.background = '#fffaf0';
      card.style.border = '1px solid #b99567';
      card.style.borderRadius = '4px';
      card.style.boxShadow = '0 1px 2px rgba(55, 35, 18, 0.12)';
      card.style.color = '#3e2818';
      card.style.cursor = 'pointer';
      card.style.fontFamily = 'Georgia, serif';
      card.style.fontSize = '10px';
      card.style.fontWeight = 'bold';
      card.style.lineHeight = '11px';
      card.style.textAlign = 'center';
      card.style.zIndex = 2003;
      card.innerHTML = getFactionName(faction);
      card.title = 'Choose ' + getFactionName(faction);
      card.onclick = bind(buttonClickFun, faction);
      card.onmouseover = function() {
        this.style.background = '#fff1c9';
        this.style.transform = 'translateY(-1px)';
      };
      card.onmouseout = function() {
        this.style.background = '#fffaf0';
        this.style.transform = 'translateY(0)';
      };
    }
  }
};

// callback receives chosen color
Human.chooseColorDialog = function(playerIndex, callback) {
  var player = game.players[playerIndex];
  var buttonClickFun = function(color) {
    popupElement.innerHTML = '';
    callback(color);
  };

  var ispriestcolor = false;
  if(player.color == Z && player.colors[player.woodcolor - R]) ispriestcolor = true;

  var colors = [];
  for(var i = CIRCLE_BEGIN; i <= CIRCLE_END; i++) {
    if(!ispriestcolor && auxColorToPlayerMap[i] == undefined && colorToPlayerMap[i] == undefined) colors.push(i);
    if(ispriestcolor && !player.colors[i - R]) colors.push(i);
  }

  var colorRows = Math.ceil(colors.length / 2);
  var title = ispriestcolor ? 'Choose priest or terrain' : 'Choose terrain color';
  var subtitle = ispriestcolor ? 'Unlock a terrain color, or use the priest option.' : 'Choose an available terrain color for this faction.';
  var popup = makeChoicePopup(title, subtitle, 438, ispriestcolor ? 108 + colorRows * 39 : 70 + colorRows * 39);
  for(var i = 0; i < colors.length; i++) {
    var column = i % 2;
    var row = Math.floor(i / 2);
    makeChoicePopupButton(popup, popup.x + 13 + column * 206, popup.y + 56 + row * 39, 194,
        getColorName(colors[i]), getImageColor(colors[i]), bind(buttonClickFun, colors[i]));
  }
  if(ispriestcolor) {
    var priestRow = colorRows;
    makeChoicePopupButton(popup, popup.x + 13, popup.y + 56 + priestRow * 39, 194,
        'AS PRIEST', '#d9d5c6', bind(buttonClickFun, Z));
  }
};

Human.prototype.chooseAuxColor = function(playerIndex, callback) {
  Human.chooseColorDialog(playerIndex, function(color) {
    var error = callback(playerIndex, color);
    if(error != '') setHelp('invalid color: ' + error + ' - Please try again');
  });
};

var autoLeech = false;
var autoLeech1 = false;
var autoLeechNo = false;//for debug
var autoLeechAccept = false;

var leechYesFun = null; //for shortcuts
var leechNoFun = null; //for shortcuts

Human.prototype.leechPower = function(playerIndex, fromPlayer, amount, vpcost, roundnum, already, still, callback) {
  var doAutoLeech = function() {
    // Let an AI do the decisions for you.
    newAI().leechPower(playerIndex, fromPlayer, amount, vpcost, roundnum, already, still, callback);
    return;
  }

  if(autoLeechNo) {
    callback(playerIndex, false);
    return;
  }

  if(autoLeechAccept) {
    callback(playerIndex, true);
    return;
  }

  if(autoLeech) {
    doAutoLeech();
    return;
  }

  if(autoLeech1 && amount <= 1 && game.players[fromPlayer].race != F_CULTISTS) {
    callback(playerIndex, true);
    return;
  }

  resetGameplayPopupPosition();
  popupElement.innerHTML = '';
  var panelW = 590;
  var panelH = 225;
  var leechDock = getGameplayPopupDock(panelW, panelH);
  var panelX = leechDock.x;
  var panelY = leechDock.y;
  var panel = makeSizedDiv(panelX, panelY, panelW, panelH, popupElement);
  panel.style.boxSizing = 'border-box';
  panel.style.padding = '20px';
  panel.style.background = 'linear-gradient(145deg, #fff8e4, #e8d1a0)';
  panel.style.border = '3px solid #67452c';
  panel.style.borderRadius = '18px';
  panel.style.boxShadow = '0 5px 12px rgba(30, 18, 9, 0.32), inset 0 0 0 2px rgba(255,255,255,0.5)';
  panel.style.zIndex = 2001;
  makeGameplayPopupDragHandle(panelX, panelY, panelW);

  var heading = makeText(panelX + 24, panelY + 18, 'Power leech', popupElement);
  heading.style.color = '#432a18';
  heading.style.fontFamily = 'Georgia, serif';
  heading.style.fontSize = '25px';
  heading.style.fontWeight = 'bold';
  heading.style.zIndex = 2002;
  var from = makeText(panelX + 24, panelY + 52, getFullName(game.players[fromPlayer]) + ' triggered a neighbouring building.', popupElement);
  from.style.color = '#70543a';
  from.style.fontSize = '13px';
  from.style.zIndex = 2002;

  var power = makeSizedDiv(panelX + 24, panelY + 79, 122, 42, popupElement);
  power.style.boxSizing = 'border-box';
  power.style.padding = '8px 12px';
  power.style.background = 'radial-gradient(circle at 35% 30%, #cda6f0, #72509d)';
  power.style.border = '2px solid #4d326d';
  power.style.borderRadius = '21px';
  power.style.boxShadow = 'inset 0 1px 2px rgba(255,255,255,0.65), 0 2px 3px rgba(53,31,75,0.28)';
  power.style.color = '#fff';
  power.style.fontWeight = 'bold';
  power.style.textAlign = 'center';
  power.style.zIndex = 2002;
  power.innerHTML = '+' + amount + ' POWER';
  var cost = makeText(panelX + 162, panelY + 92, vpcost > 0 ? 'Cost: ' + vpcost + ' VP' : 'No VP cost', popupElement);
  cost.style.color = '#5c422b';
  cost.style.fontSize = '15px';
  cost.style.fontWeight = 'bold';
  cost.style.zIndex = 2002;

  var finish = function(accept, always) {
    if(always) autoLeechAccept = true;
    leechNoFun = null;
    leechYesFun = null;
    popupElement.innerHTML = '';
    callback(playerIndex, accept);
  };
  leechYesFun = function() { finish(true, false); };
  leechNoFun = function() { finish(false, false); };

  var makeChoice = function(x, label, detail, background, border, click, emphasis) {
    var choice = makeSizedDiv(x, panelY + 132, 166, 68, popupElement);
    choice.style.boxSizing = 'border-box';
    choice.style.padding = '10px 8px';
    choice.style.background = background;
    choice.style.border = (emphasis ? '3px' : '2px') + ' solid ' + border;
    choice.style.borderRadius = '9px';
    choice.style.boxShadow = emphasis ? '0 3px 6px rgba(20,72,38,.36), inset 0 1px 1px rgba(255,255,255,.28)' : '0 2px 3px rgba(54,34,16,.26), inset 0 1px 1px rgba(255,255,255,.22)';
    choice.style.color = '#fffdf1';
    choice.style.cursor = 'pointer';
    choice.style.textAlign = 'center';
    choice.style.zIndex = 2002;
    choice.style.fontSize = '14px';
    choice.style.lineHeight = '18px';
    choice.style.userSelect = 'none';
    choice.innerHTML = '<b>' + label + '</b><br><span style="font-size:11px">' + detail + '</span>';
    choice.onclick = click;
    choice.onmouseover = function() { this.style.transform = 'translateY(-2px)' + (emphasis ? ' scale(1.02)' : ''); };
    choice.onmouseout = function() { this.style.transform = 'translateY(0)'; };
    return choice;
  };
  makeChoice(panelX + 24, 'Decline', 'Keep your VP',
      'linear-gradient(145deg, #d9695a, #9f352e)', '#76251f', leechNoFun);
  makeChoice(panelX + 212, 'Accept once', 'Take +' + amount + ' power',
      'linear-gradient(145deg, #72bb7b, #347847)', '#245936', leechYesFun);
  makeChoice(panelX + 400, 'Always accept', 'Auto-accept future leeches',
      'linear-gradient(145deg, #3fbe6a, #08713f)', '#07512f', function() { finish(true, true); }, true);

  var keys = makeText(panelX + 24, panelY + 207, 'Keyboard: Y accepts once · N declines', popupElement);
  keys.style.color = '#7a6045';
  keys.style.fontSize = '11px';
  keys.style.zIndex = 2002;
};


//Similar to transformDirAction, except returns A_TRANSFORM_CW if the tile is already your color, for the human UI dig controls (not applicable to giants)
function humanTransformDirAction(player, fromcolor, tocolor) {
  var result = transformDirAction(player, fromcolor, tocolor);
  return result.length == 0 ? [A_TRANSFORM_CW] : result;
}

//Returns opposite direction of humanTransformDirAction (not applicable to giants)
function humanAntiTransformDirAction(player, fromcolor, tocolor) {
  var result = humanTransformDirAction(player, fromcolor, tocolor);
  var dir = result[0] == A_TRANSFORM_CW ? A_TRANSFORM_CCW : A_TRANSFORM_CW;
  for(var i = 0; i < result.length; i++) {
    result[i] = dir;
  }
  return result;
}

Human.prototype.doRoundBonusSpade = function(playerIndex, callback) {
  var player = game.players[playerIndex];
  var num = player.spades;
  if(num < 2 && player.faction == F_GIANTS) {
    callback(playerIndex, []);
    return;
  }

  var result = [];

  actionEl.innerHTML = 'rounddig';

  var clickedmap = {};

  var currentNum = num;
  var done = 0;
  var fun = function(x, y) {
    var ckey = '' + x + ',' + y;
    clickedmap[ckey] = undef0(clickedmap[ckey]) + 1;
    if(currentNum <= 0) return;
    var type = A_NONE;
    if(player.faction == F_GIANTS) type = A_GIANTS_TRANSFORM;
    else if(digAndBuildMode == DBM_ONE) {
      var types = humanTransformDirAction(player, getWorld(x, y), player.getMainDigColor());
      var j = clickedmap[ckey] - 1;//num - currentNum;
      if(j >= types.length) j = types.length - 1;
      type = types[j]; //TODO: this is not FULLY correct. Fix this to always have the right types required for transformation in the right order.
    }
    else if(digAndBuildMode == DBM_ANTI) type = humanAntiTransformDirAction(player, getWorld(x, y), player.getMainDigColor())[0];
    result.push([type,x,y]);
    actionEl.innerHTML = 'rounddig ';
    for(var i = 0; i < result.length; i++) {
      actionEl.innerHTML += printCo(result[i][1], result[i][2]);
      if(i < result.length - 1) actionEl.innerHTML += ', ';
    }
    currentNum--;
  };
  digAndBuildMode = player.faction == F_GIANTS ? DBM_COLOR : DBM_ONE;
  queueHumanState(HS_DIG, 'You got ' + num + '  bonus spades from the cult track. Click on map to dig, press execute when done.', fun);

  executeButtonFun_ = function() {
    var error = callback(playerIndex, result);
    if(error != '') {
      setHelp('Round bonus spade error: ' + error);
      result = [];
      actionEl.innerHTML = 'rounddig';
      currentNum = num;
    } else {
      clearHumanState();
      executeButtonFun_ = null;
      executeButtonClearFun_ = null;
      actionEl.innerHTML = '';
    }
  };

  executeButtonClearFun_ = function() {
    result.pop();
    actionEl.innerHTML = 'rounddig ' + printCos(result);
  };
};

Human.prototype.chooseShapeshiftersConversion = function(playerIndex, callback) {
  var fun = function(yes) {
    var error = callback(playerIndex, yes);
    clearHumanState();
  };
  Human.chooseShapeshiftersConversionDialog(playerIndex, callback);
  queueHumanState(HS_OTHER, 'convert 1vp to power token?', fun);
};

Human.chooseShapeshiftersConversionDialog = function(playerIndex, callback) {
  var buttonClickFun = function(yes) {
    popupElement.innerHTML = '';
    clearHumanState();
    callback(playerIndex, yes);
  };
  var popup = makeChoicePopup('Convert victory point?', 'Spend 1 VP to gain 1 power token.', 438, 119);
  var makeDecision = function(x, label, background, border, click) {
    var button = makeSizedDiv(x, popup.y + 57, 194, 43, popupElement);
    button.style.boxSizing = 'border-box';
    button.style.padding = '12px';
    button.style.background = background;
    button.style.border = '2px solid ' + border;
    button.style.borderRadius = '7px';
    button.style.boxShadow = '0 2px 4px rgba(47,29,16,.26), inset 0 1px 1px rgba(255,255,255,.22)';
    button.style.color = '#fffdf1';
    button.style.cursor = 'pointer';
    button.style.fontSize = '12px';
    button.style.fontWeight = 'bold';
    button.style.textAlign = 'center';
    button.style.userSelect = 'none';
    button.style.zIndex = 2002;
    button.innerHTML = label;
    button.onclick = click;
  };
  makeDecision(popup.x + 13, 'KEEP VP', 'linear-gradient(145deg, #d9695a, #9f352e)', '#76251f', bind(buttonClickFun, false));
  makeDecision(popup.x + 231, 'CONVERT', 'linear-gradient(145deg, #72bb7b, #347847)', '#245936', bind(buttonClickFun, true));
};

Human.prototype.chooseCultistTrack = function(playerIndex, callback) {
  var fun = function(cult) {
    var error = callback(playerIndex, cult);
    if(error == '') clearHumanState();
    else {
      setHelp('invalid cult. Please try again');
    }
  };
  queueHumanState(HS_CULT, 'click on which cult track to increase', fun);
};

//dig&build mode
var DBM_BUILD = 0; //dig to your color if needed (as DBM_COLOR), and put a dwelling on it
var DBM_COLOR = 1; //dig all the way to your color (either with as much spades as needed, or sandstorm, or giants)
var DBM_ONE = 2; //dig once in your direction (or clockwise if it's your color)
var DBM_ANTI = 3; //dig once in opposite direction (or counterclockwise if it's your color)

var digAndBuildMode = DBM_BUILD;


function getFreeSpades(player, actions) {
  var result = 0;
  for(var i = 0; i < actions.length; i++) {
    result += spadesDifference(player, actions[i]);
  }
  return result;
}

//If this is called after e.g. a power dig or bonus dig or so, that action must already have been edded.
//This function will add extra A_SPADE actions if needed (to bring a full terrain to your color).
//If it's about round bonus spades, then not of course.
function digAndBuildFun(initialMode, helpText) {
  var player = getCurrentPlayer();

  digAndBuildMode = initialMode;

  var ptype = pactions.length > 0 ? pactions[pactions.length - 1].type : A_NONE; //previous action type
  var roundend = state.type == S_ROUND_END_DIG;
  var halflingssh = (ptype == A_UPGRADE_SH && player.faction == F_HALFLINGS);
  var cansplit = ptype == A_POWER_2SPADE || halflingssh;
  var canaddspades = !roundend && ptype != A_SANDSTORM && ptype != A_TRANSFORM_SPECIAL2 && !halflingssh;

  var fun = function(x, y) {
    clearHumanState();
    if(digAndBuildMode == DBM_BUILD || digAndBuildMode == DBM_COLOR) {
      if(ptype == A_SANDSTORM) {
        pactions[pactions.length - 1].co = [x, y];
      } else {
        var tactions = getAutoTransformActions(player, x, y, player.getMainDigColor(), getFreeSpades(player, pactions), 999);
        for(var i = 0; i < tactions.length; i++) prepareAction(tactions[i]);
      }
      if(digAndBuildMode == DBM_BUILD) {
        var action = new Action(A_BUILD);
        action.co = [x, y];
        prepareAction(action);
      }
    } else {
      // single dig where player chooses particular direction (e.g. anti-dig)
      var type = A_NONE;
      if(player.faction == F_GIANTS) type = A_GIANTS_TRANSFORM;
      else if(digAndBuildMode == DBM_ONE) type = humanTransformDirAction(player, getWorld(x, y), player.getMainDigColor())[0];
      else if(digAndBuildMode == DBM_ANTI) type = humanAntiTransformDirAction(player, getWorld(x, y), player.getMainDigColor())[0];
      if(getFreeSpades(player, pactions) < 1) prepareAction(new Action(A_SPADE));
      var action = new Action(type);
      action.co = [x, y];
      prepareAction(action);
    }

    if(getFreeSpades(player, pactions) > 0) {
      if(digAndBuildMode != DBM_ANTI) digAndBuildMode = DBM_ONE;
      queueHumanState(HS_DIG, helpText, fun);
      drawHud();
    }
  }

  queueHumanState(HS_DIG, helpText, fun);
}

//Gets the building at the x, y coordinate, but in case of chaos magicians
//double action, takes into account that this building may be built or upgraded
//from a previous action even though it's not on the map yet.
function getBuildingForUpgradeClick(x, y) {
  var b = getBuilding(x, y)[0];
  for(var i = 0; i < pactions.length; i++) {
    var action = pactions[i];
    if(action.co && action.co[0] == x && action.co[1] == y) {
      if(action.type == A_BUILD || action.type == A_WITCHES_D) b = B_D;
      else if(action.type == A_UPGRADE_TP || action.type == A_SWARMLINGS_TP) b = B_TP;
      else if(action.type == A_UPGRADE_TE) b = B_TE;
      else if(action.type == A_UPGRADE_SH) b = B_SH;
      else if(action.type == A_UPGRADE_SA) b = B_SA;
    }
  }
  return b;
}

function upgrade1fun() {
  var player = getCurrentPlayer();
  setMapActionTargets('Highlighted buildings can be upgraded to TP or SH.', function(x, y) {
    var building = getBuildingForUpgradeClick(x, y);
    if(getBuilding(x, y)[1] != player.woodcolor) return false;
    return (building == B_D && player.b_tp > 0) || (building == B_TP && player.b_sh > 0);
  });
  var fun = function(x, y) {
    clearHumanState();
    //Commented out because e.g. chaos magician double action may have turned it to your color before, this just doesn't detect that yet
    //var tile = getWorld(x, y);
    //if(tile != getCurrentPlayer().color) return;
    var b = getBuildingForUpgradeClick(x, y);
    var action = new Action(A_NONE);
    if(b == B_D) action.type = A_UPGRADE_TP;
    else if(b == B_TP) action.type = A_UPGRADE_SH;
    else return;
    action.co = [x, y];
    prepareAction(action);
  };
  queueHumanState(HS_MAP, 'click where to upgrade to TP/SH', fun);
}

function upgrade2fun() {
  var player = getCurrentPlayer();
  setMapActionTargets('Highlighted buildings can be upgraded to TE or SA.', function(x, y) {
    var building = getBuildingForUpgradeClick(x, y);
    if(getBuilding(x, y)[1] != player.woodcolor) return false;
    return (building == B_TP && player.b_te > 0) || (building == B_TE && player.b_sa > 0);
  });
  var fun = function(x, y) {
    clearHumanState();
    //Commented out because e.g. chaos magician double action may have turned it to your color before, this just doesn't detect that yet
    //var tile = getWorld(x, y);
    //if(tile != getCurrentPlayer().color) return;
    var b = getBuildingForUpgradeClick(x, y);
    var action = new Action(A_NONE);
    if(b == B_TP) action.type = A_UPGRADE_TE;
    else if(b == B_TE) action.type = A_UPGRADE_SA;
    else return;
    action.co = [x, y];
    prepareAction(action);
  };
  queueHumanState(HS_MAP, 'click where to upgrade to TE/SA', fun);
}

// A single building-first upgrade flow is easier to use on a touch screen.
// Most buildings have exactly one legal destination, while a trading post can
// become either a temple or stronghold; only that genuine choice gets a popup.
function getUpgradeChoicesForBuilding(player, building) {
  var choices = [];
  if(building == B_D && player.b_tp > 0) choices.push({type: A_UPGRADE_TP, label: 'TRADING POST', short: 'TP'});
  if(building == B_TP && player.b_te > 0) choices.push({type: A_UPGRADE_TE, label: 'TEMPLE', short: 'TE'});
  if(building == B_TP && player.b_sh > 0) choices.push({type: A_UPGRADE_SH, label: 'STRONGHOLD', short: 'SH'});
  if(building == B_TE && player.b_sa > 0) choices.push({type: A_UPGRADE_SA, label: 'SANCTUARY', short: 'SA'});
  return choices;
}

// The board shortcut should offer only upgrades the player can actually pay
// for right now. The full Upgrade action still lists buildable destinations so
// a player can inspect costs while planning a later turn.
function getAffordableUpgradeChoicesForBuilding(player, x, y, building) {
  var choices = getUpgradeChoicesForBuilding(player, building);
  var affordable = [];
  for(var i = 0; i < choices.length; i++) {
    var choice = choices[i];
    var output = getUpgradeActionOutputBuilding({type: choice.type});
    var adjacent = choice.type == A_UPGRADE_TP && hasNeighbor(x, y, player.woodcolor);
    var cost = player.getFaction().getBuildingCost(output, adjacent);
    if(canConsume(player, cost)) affordable.push(choice);
  }
  return affordable;
}

function showAffordableUpgradeChoicePopup(player, x, y) {
  var building = getBuildingForUpgradeClick(x, y);
  var choices = getAffordableUpgradeChoicesForBuilding(player, x, y, building);
  if(choices.length == 0) return false;
  showUpgradeChoicePopup([x, y], building, choices);
  return true;
}

function showUpgradeChoicePopup(co, building, choices) {
  resetGameplayPopupPosition();
  popupElement.innerHTML = '';
  var backdrop = makeSizedDiv(0, 0, 1085, 900, popupElement);
  backdrop.style.background = 'rgba(34, 25, 18, .08)';
  backdrop.style.zIndex = 2000;
  backdrop.onclick = function() {
    popupElement.innerHTML = '';
    setHelp('Upgrade selection cancelled.');
  };

  var panelW = 522;
  var panelH = 102;
  var upgradeDock = getGameplayPopupDock(panelW, panelH);
  var panelX = upgradeDock.x;
  var panelY = upgradeDock.y;
  var panel = makeSizedDiv(panelX, panelY, panelW, 102, popupElement);
  panel.style.boxSizing = 'border-box';
  panel.style.background = 'linear-gradient(145deg, #fff5d8, #e3c185)';
  panel.style.border = '3px solid #69472d';
  panel.style.borderRadius = '10px';
  panel.style.boxShadow = '0 5px 12px rgba(40,25,12,.34), inset 0 0 0 1px rgba(255,255,255,.6)';
  panel.style.zIndex = 2001;
  makeGameplayPopupDragHandle(panelX, panelY, 420);

  var names = {};
  names[B_TP] = 'Trading Post';
  names[B_D] = 'Dwelling';
  names[B_TE] = 'Temple';
  var heading = makeText(panelX + 14, panelY + 11, 'Upgrade ' + (names[building] || 'building'), popupElement);
  heading.style.color = '#4d3020';
  heading.style.fontFamily = 'Georgia, serif';
  heading.style.fontSize = '17px';
  heading.style.fontWeight = 'bold';
  heading.style.zIndex = 2002;
  var hint = makeText(panelX + 170, panelY + 15, 'Choose its destination.', popupElement);
  hint.style.color = '#70513c';
  hint.style.fontSize = '10px';
  hint.style.zIndex = 2002;

  var cancel = makeSizedDiv(panelX + 430, panelY + 9, 76, 23, popupElement);
  cancel.style.boxSizing = 'border-box';
  cancel.style.padding = '5px';
  cancel.style.background = '#f3e1b9';
  cancel.style.border = '1px solid #795838';
  cancel.style.borderRadius = '5px';
  cancel.style.color = '#4f3320';
  cancel.style.cursor = 'pointer';
  cancel.style.fontSize = '10px';
  cancel.style.fontWeight = 'bold';
  cancel.style.textAlign = 'center';
  cancel.style.userSelect = 'none';
  cancel.style.zIndex = 2002;
  cancel.innerHTML = 'CANCEL';
  cancel.onclick = backdrop.onclick;

  for(var i = 0; i < choices.length; i++) {
    var choice = choices[i];
    var width = choices.length == 1 ? 240 : 230;
    var x = choices.length == 1 ? panelX + 140 : panelX + 22 + i * 248;
    var card = makeSizedDiv(x, panelY + 43, width, 46, popupElement);
    card.style.boxSizing = 'border-box';
    card.style.padding = '8px 11px';
    card.style.background = 'linear-gradient(145deg, #4c8da6, #2d5c70)';
    card.style.border = '2px solid #234553';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 2px 4px rgba(27,61,73,.31), inset 0 1px 1px rgba(255,255,255,.22)';
    card.style.color = '#fff8e5';
    card.style.cursor = 'pointer';
    card.style.fontSize = '13px';
    card.style.fontWeight = 'bold';
    card.style.textAlign = 'center';
    card.style.userSelect = 'none';
    card.style.zIndex = 2002;
    card.innerHTML = choice.label + ' <span style="font-size:10px">(' + choice.short + ')</span><div style="font-size:9px;font-weight:normal">Add to turn plan</div>';
    card.onclick = (function(selected) { return function() {
      popupElement.innerHTML = '';
      var action = new Action(selected.type);
      action.co = [co[0], co[1]];
      prepareAction(action);
    }; })(choice);
  }
}

function upgradeBuildingFun() {
  var player = getCurrentPlayer();
  setMapActionTargets('Tap a highlighted building to upgrade it.', function(x, y) {
    if(getBuilding(x, y)[1] != player.woodcolor) return false;
    return getUpgradeChoicesForBuilding(player, getBuildingForUpgradeClick(x, y)).length > 0;
  });
  queueHumanState(HS_MAP, 'tap a highlighted building to upgrade', function(x, y) {
    var building = getBuildingForUpgradeClick(x, y);
    var choices = getUpgradeChoicesForBuilding(player, building);
    clearHumanState();
    if(choices.length == 0) return;
    if(choices.length == 1) {
      var action = new Action(choices[0].type);
      action.co = [x, y];
      prepareAction(action);
    } else {
      showUpgradeChoicePopup([x, y], building, choices);
    }
  });
}

registerKeyHandler(88 /*X*/, function() {
  if(humanStateBusy()) return; // do not let this shortcut work if human must click something (map, cult track, ...). Note however that this misses the case of end round bonus dig, where execute button is visible. TODO: use better criterium so that bonus dig support 'x' shortcut too.
  executeButtonFun();
});
registerKeyHandler(13 /*enter*/, executeButtonFun);
registerKeyHandler(66 /*B*/, function() {
  if(isHandlingActionInput()) digAndBuildFun(DBM_BUILD, 'click where to dig&build');
});
registerKeyHandler(78 /*N*/, function() {
  if(nextButtonFun) nextButtonFun();
  else if(leechNoFun) leechNoFun();
});
registerKeyHandler(89 /*Y*/, function() {
  if(leechYesFun) leechYesFun();
});
registerKeyHandler(70 /*F*/, function() {
  if(fastButtonFun) fastButtonFun();
});
registerKeyHandler(71 /*G*/, function() {
  if(fastestButtonFun) fastestButtonFun();
});
registerKeyHandler(85 /*U*/, function() {
  if(isHandlingActionInput()) upgrade1fun();
});
registerKeyHandler(86 /*V*/, function() {
  if(isHandlingActionInput()) upgrade2fun();
});
