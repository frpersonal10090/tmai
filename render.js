/* render8.js
TM AI

Copyright (C) 2013-2014 by Lode Vandevenne

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

//Everything related to drawing and UI

var BOARD_MAP_LEFT = 90;
var BOARD_MAP_WIDTH = 860;
var BOARD_MAP_HEIGHT = 462;
var CULT_PANEL_LEFT = BOARD_MAP_LEFT + BOARD_MAP_WIDTH + 10;
var GAMEPLAY_WIDTH = CULT_PANEL_LEFT + 255;
var TOP_PLAY_CONTENT_Y = 50;
var mapElement = makeSizedDiv(BOARD_MAP_LEFT, TOP_PLAY_CONTENT_Y, BOARD_MAP_WIDTH, BOARD_MAP_HEIGHT, document.body);
document.body.appendChild(mapElement);

// Decision panels open in the middle of the board. They can then be dragged
// as a unit, so a player can uncover any part of the board they need.
var GAMEPLAY_POPUP_DOCK_X = 300;
var GAMEPLAY_POPUP_DOCK_Y = 120;
// Keep a single visual offset for the gameplay popup layer.  The old drag
// code only applied a temporary CSS transform; every HUD redraw cleared it,
// which made a moved picker snap back to the centre.  A transform is still
// used because it is composited (and therefore does not resize/reflow the
// page), but its value now survives redraws and successive choice panels.
var gameplayPopupOffset = {x: 0, y: 0};
function getGameplayPopupDock(width, height) {
  width = width || 440;
  height = height || 180;
  return {
    x: BOARD_MAP_LEFT + Math.round((BOARD_MAP_WIDTH - width) / 2),
    y: TOP_PLAY_CONTENT_Y + Math.max(0, Math.round((BOARD_MAP_HEIGHT - height) / 2))
  };
}

function resetGameplayPopupPosition() {
  popupElement.style.transform = 'translate3d(' + gameplayPopupOffset.x + 'px, ' + gameplayPopupOffset.y + 'px, 0)';
}

function makeGameplayPopupDragHandle(px, py, width) {
  var handle = makeSizedDiv(px, py, width, 28, popupElement);
  handle.style.cursor = 'grab';
  handle.style.touchAction = 'none';
  handle.style.zIndex = 2010;
  handle.title = 'Drag this panel to move it.';
  handle.onpointerdown = function(event) {
    var originX = event.clientX;
    var originY = event.clientY;
    var startX = gameplayPopupOffset.x;
    var startY = gameplayPopupOffset.y;
    handle.style.cursor = 'grabbing';
    function move(moveEvent) {
      gameplayPopupOffset.x = startX + moveEvent.clientX - originX;
      gameplayPopupOffset.y = startY + moveEvent.clientY - originY;
      resetGameplayPopupPosition();
    }
    function end() {
      handle.style.cursor = 'grab';
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    event.preventDefault();
  };
  return handle;
}

function makeStandalonePanelDragHandle(panel, width) {
  var handle = makeSizedDiv(0, 0, width, 28, panel);
  handle.style.cursor = 'grab';
  handle.style.touchAction = 'none';
  handle.style.zIndex = 2010;
  handle.title = 'Drag this panel to move it.';
  handle.onpointerdown = function(event) {
    var originX = event.clientX;
    var originY = event.clientY;
    var startX = parseInt(panel.style.left) || 0;
    var startY = parseInt(panel.style.top) || 0;
    handle.style.cursor = 'grabbing';
    function move(moveEvent) {
      panel.style.left = (startX + moveEvent.clientX - originX) + 'px';
      panel.style.top = (startY + moveEvent.clientY - originY) + 'px';
    }
    function end() {
      handle.style.cursor = 'grab';
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    event.preventDefault();
  };
  return handle;
}

//UI that never changes
var uiElement =  document.createElement('div');
document.body.appendChild(uiElement);

//UI that gets redrawn all the time
var hudElement =  document.createElement('div');
document.body.appendChild(hudElement);


var helpEl = makeDiv(563, 500, document.body);
helpEl.style.fontWeight = 'bold';
var actionEl = makeDiv(563, 518, document.body);
var logEl = makeDiv(5, 1920, document.body);

//UI that pops up temporarily sometimes
var popupElement =  document.createElement('div');
popupElement.style.position = 'absolute';
popupElement.style.left = '0px';
popupElement.style.top = '0px';
popupElement.style.width = '0px';
popupElement.style.height = '0px';
popupElement.style.willChange = 'transform';
document.body.appendChild(popupElement);
resetGameplayPopupPosition();

function showGreyDialog(text, px, py) {
  var popupDock = getGameplayPopupDock(400, 180);
  if(px == undefined) px = popupDock.x;
  if(py == undefined) py = popupDock.y;

  text = text.replace(/(?:\r\n|\r|\n)/g, '<br />');
  var div = makeDiv(px, py, uiElement);
  div.style.backgroundColor = '#bbb';
  div.style.border = '1px solid black';
  div.style.zIndex = 1000;
  div.style.padding = '8px';
  div.innerHTML = text;
  makeStandalonePanelDragHandle(div, 365);
  var div2 = makeElement(div, 'div');
  div2.innerHTML = 'x';
  div2.style.position = 'absolute';
  div2.style.right = '3px';
  div2.style.top = '1px';
  div2.style.cursor = 'pointer';
  div2.onclick = function() {
    uiElement.removeChild(div);
  };
};

function showGreyDialogAtMouse(text, e) {
  showGreyDialog(text);
}

//hex grid coordinates to pixel coordinates
//the result is the center of where the hex cell should be
//hex grid uses the type of coordinate system where odd and even rows are different
function pixelCo(x, y) {
  var togglemod = (game.btoggle ? 0 : 1);
  x++;
  y++;
  var xsize = 63;
  var ysize = 64;
  var px = x * xsize;
  if(y % 2 == togglemod) px -= Math.floor(xsize / 2);
  //var py = y * ysize * 21 / 23;
  var py = y * ysize * 11 / 15;
  return [px, py - 24];
}

var logText = '';
var lastLogLine = '';
var logUpsideDown = false;
var logColored = false; //coloredlog

function addLog(text) {
  if(logUpsideDown) logText = text + '<br/>' + logText;
  else logText += '<br/>' + text;
  lastLogLine = text;
}

function displayLog() {
  logEl.innerHTML = logText;
}

//removes last log entry
function popLog() {
  var br = logText.indexOf('<br/>');
  logText = logText.substring(br + 5);
  logEl.innerHTML = logText;
  actionEl.innerHTML = '';
}

function setHelp(text, extravisible) {
  helpEl.innerHTML = text ? '<span style="display:inline-block;box-sizing:border-box;padding:2px 6px;margin:-5px 8px 0 -4px;border:1px solid #35404d;border-radius:4px;background:linear-gradient(90deg,#4e5967,#79899a);color:#fff4d6;font-size:8px;font-weight:bold;letter-spacing:.5px">GAME MESSAGE</span>' + text : '';
  if(extravisible) helpEl.style.color = 'red';
  else helpEl.style.color = 'black';
}

function clearHelp() {
  helpEl.innerHTML = '';
}

// TODO: more of the game texts here
function Texts() {
};
Texts.shift1title = function() { var shiftcost = state.fireiceerrata ? 5 : 3; return 'Shapeshift to new color (' + shiftcost + 'pw cost)'; };
Texts.shift2title = function() { var shiftcost = state.fireiceerrata ? 5 : 3; return 'Shapeshift to new color (' + shiftcost + ' power tokens cost)'; };
Texts.priestUnlockText = 'choose priest or color to unlock';

function drawTileMapElement(px, py, tilex, tiley, parent) {
  var tilesize = 64;
  var el =  makeDiv(px - tilesize/2, py - tilesize/3, parent);
  el.style.width = '' + tilesize + 'px';
  el.style.height = '' + tilesize + 'px';
  if(tilex >= 0 && tiley >= 0) {
    el.className = 'tiles';
    el.style.backgroundPosition = '' + (-tilesize * tilex) + 'px ' + (-tilesize * tiley) + 'px';
  }
  return el;
}

function drawTileMapElementOnGrid(x, y, tilex, tiley, parent) {
  var co = pixelCo(x, y);
  var px = co[0];
  var py = co[1];
  return drawTileMapElement(px, py, tilex, tiley, parent);
}

function drawHexagon(x, y, color) {
  return drawTileMapElementOnGrid(x, y, 0, color - I, mapElement);
}


function drawBuilding(x, y, building, color, parent) {
  return drawTileMapElementOnGrid(x, y, building == B_MERMAIDS ? 9 : building, color - I, parent);
}

function drawIcon(px, py, symbol, color, parent) {
  return drawTileMapElement(px, py, symbol, color - I, parent);
}

//draw a small player color token somewhere
function drawOrb(px, py, color) {
  return drawIcon(px, py + 64/3 - 64/2, 9, color, hudElement);
}

function drawGridSymbol(x, y, text) {
  var co = pixelCo(x, y);
  el = makeSizedDiv(co[0]-30, co[1] + 18, 60, 16, mapElement);
  el.innerHTML = text;
  el.style.textAlign = 'center';
  if(isInTown(x, y)) {
    el.style.fontWeight = 'bold';
    el.style.color = highc[game.world[arCo(x, y)]];
  } else {
    el.style.color = lowc[game.world[arCo(x, y)]];
  }
}

function drawBridge(x0, y0, x1, y1, color) {
  if(y0 < y1) {
    var temp;
    temp = x0; x0 = x1; x1 = temp;
    temp = y0; y0 = y1; y1 = temp;
  }
  var co = pixelCo(x0, y0);
  var dir = getBridgeDir(x0, y0, x1, y1, game.btoggle);

  var tilesize = 64;
  if(dir == D_NE) {
    drawIcon(co[0] + (5*tilesize/7), co[1] - (5*tilesize/13), 7, color, mapElement);
  }
  else if(dir == D_NW) {
    drawIcon(co[0] - (5*tilesize/7), co[1] - (5*tilesize/13), 8, color, mapElement);
  }
  else if(dir == D_N) {
    drawIcon(co[0], co[1] - (3*tilesize/4), 6, color, mapElement);
  }
}

function drawBridges() {
  for(var y = 0; y < game.bh; y++)
  for(var x = 0; x < game.bw; x++)
  {
    var bridges = game.bridges[arCo(x, y)];
    if(!bridges) continue;
    if(bridges[0] != N) {
      drawBridge(x, y, x, y - 2, bridges[0]);
    }
    if(bridges[1] != N) {
      var co = bridgeCo(x , y, D_NE, game.btoggle);
      drawBridge(x, y, co[0], co[1], bridges[1]);
    }
    if(bridges[2] != N) {
      var co = bridgeCo(x, y, D_SE, game.btoggle);
      drawBridge(x, y, co[0], co[1], bridges[2]);
    }
  }
}

//given the tile color, return the RGB color as used in the tiles.png image
function getImageColor(color) {
  if(color == I) return '#daecf6';
  if(color == N) return '#ffffff';
  if(color == R) return '#ee1c24';
  if(color == Y) return '#fff200';
  if(color == U) return '#9c612a';
  if(color == K) return '#252525';
  if(color == B) return '#009ce5';
  if(color == G) return '#2bda2c';
  if(color == S) return '#959595';
  if(color == W) return '#eeeeff';
  if(color == O) return '#ff911d';
  if(color == X) return '#ffeeee';
  if(color == Z) return '#ffeeee';
}

//given a CSS hex RGB color, get a high contrast color (= either white or black)
function getHighContrastColor(color) {
  var r = parseInt(color.substring(1, 3), 16);
  var g = parseInt(color.substring(3, 5), 16);
  var b = parseInt(color.substring(5, 7), 16);
  //var lightness = (r + g + b) / 3;
  var lightness = (0.3 * r + 0.59 * g + 0.11 * b); //luma
  return lightness < 140 ? '#ffffff' : '#000000';
}

//given a CSS hex RGB color, get a color that is just readable with it
//color must be a string of 7 characters
//this is for non-ugly text on tiles
function getLowContrastColor(color) {
  var r = parseInt(color.substring(1, 3), 16);
  var g = parseInt(color.substring(3, 5), 16);
  var b = parseInt(color.substring(5, 7), 16);
  var lightness = (r + g + b) / 3;
  var r2 = lightness > 128 ? 0 : 255;
  var g2 = lightness > 128 ? 0 : 255;
  var b2 = lightness > 128 ? 0 : 255;
  var N = (lightness < 64 || lightness > 128) ? 4 : 2;
  r = ((N - 1) * r + r2) / N;
  g = ((N - 1) * g + g2) / N;
  b = ((N - 1) * b + b2) / N;
  return RGBToCssColor([r, g, b]);
}

//alpha in range 0-255
function getTranslucentColor(cssColor, alpha) {
  var rgba = cssColorToRGB(cssColor);
  //rgba[3] = alpha;

  // Because IE doesn't support CSS alpha colors, set alpha to 100% and instead blend with white
  rgba[3] = 255;
  if(alpha < 255) {
    rgba[0] = Math.floor((rgba[0] * alpha + 255 * (255 - alpha)) / 255.0);
    rgba[1] = Math.floor((rgba[1] * alpha + 255 * (255 - alpha)) / 255.0);
    rgba[2] = Math.floor((rgba[2] * alpha + 255 * (255 - alpha)) / 255.0);
  }


  return RGBToCssColor(rgba);
}

//alpha in range 0-255, lower makes color lighter
function getLighterColor(cssColor, alpha) {
  var rgba = cssColorToRGB(cssColor);

  rgba[3] = 255;
  if(alpha < 255) {
    rgba[0] = Math.floor((rgba[0] * alpha + 255 * (255 - alpha)) / 255.0);
    rgba[1] = Math.floor((rgba[1] * alpha + 255 * (255 - alpha)) / 255.0);
    rgba[2] = Math.floor((rgba[2] * alpha + 255 * (255 - alpha)) / 255.0);
  }

  return RGBToCssColor(rgba);
}

//precalculate the map contrast colors
var lowc = [];
for(var i = COLOR_BEGIN; i <= COLOR_END; i++) lowc[i] = getLowContrastColor(getImageColor(i));
var highc = [];
for(var i = COLOR_BEGIN; i <= COLOR_END; i++) highc[i] = getHighContrastColor(getImageColor(i));

var altco = false; //have coordinates like 0,0 instead of A1 on the map (for debugging)
var showBoardCoordinates = false;

function styleMapWorkspace(active) {
  mapElement.style.boxSizing = 'border-box';
  mapElement.style.border = active ? '3px solid #4c3524' : '0';
  mapElement.style.borderRadius = active ? '13px' : '0';
  // Keep the unseen cells around the printed map light and neutral. A dark
  // fill makes them read like extra terrain spaces rather than a frame.
  mapElement.style.background = active ? 'linear-gradient(145deg, #e7eee6, #cbdad4)' : 'transparent';
  mapElement.style.outline = active ? '2px solid rgba(239,211,151,.86)' : '0';
  mapElement.style.outlineOffset = active ? '2px' : '0';
  mapElement.style.boxShadow = active ? '0 0 0 6px rgba(75,52,31,.72), 0 9px 19px rgba(55,39,24,.34), inset 0 0 0 2px rgba(255,245,215,.22)' : 'none';
  mapElement.style.filter = active ? 'saturate(.80) brightness(.98) contrast(.96)' : 'none';
}

function drawMap() {
  styleMapWorkspace(true);
  mapElement.style.left = BOARD_MAP_LEFT + 'px';
  var drawMapTile = function(x, y) {
    var tile = getWorld(x, y);
    if(tile != N) {
      drawHexagon(x, y, tile);
      if(tile != I) {
        if(altco) drawGridSymbol(x, y, x + ',' + y);
        else if(showBoardCoordinates) drawGridSymbol(x, y, printCo(x, y));
      }
    }
    var building = getBuilding(x, y);
    if(building && building[0] != B_NONE) {
      drawBuilding(x, y, building[0], building[1], mapElement);
    }
  };

  mapElement.innerHTML = '';
  // This order of drawing gives slightly better looking hex tile overlaps
  for(var y = 0; y < game.bh; y++)
  for(var x = 0; x < game.bw; x++)
  {
    drawMapTile(x, y);
  }
  drawBridges();
}

function getCultColor(cult) {
  if(cult == C_F) return '#f64';
  if(cult == C_W) return '#99f';
  if(cult == C_E) return '#a70';
  if(cult == C_A) return '#ddd';
}

//aka "renderCultTracks"
function drawCultTracks(px, py) {
  var trackwidth = 58;
  var trackheight = 450;
  var cultNames = {};
  cultNames[C_F] = 'FIRE';
  cultNames[C_W] = 'WATER';
  cultNames[C_E] = 'EARTH';
  cultNames[C_A] = 'AIR';
  var powerRewards = {3: 1, 5: 2, 7: 2};

  function drawTrack(x, y, cult) {
    var color = getCultColor(cult);
    var track = makeSizedDiv(x, y, trackwidth, trackheight, hudElement);
    track.style.boxSizing = 'border-box';
    track.style.border = '2px solid #59422e';
    track.style.borderRadius = '7px';
    track.style.background = 'linear-gradient(180deg, rgba(255,255,255,.92), rgba(235,220,183,.96))';
    track.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,.65), 0 2px 4px rgba(59,40,23,.22)';

    var header = makeSizedDiv(x + 2, y + 2, trackwidth - 4, 20, hudElement);
    header.style.boxSizing = 'border-box';
    header.style.padding = '5px 1px';
    header.style.borderRadius = '4px';
    header.style.background = color;
    header.style.color = getHighContrastColor(color);
    header.style.fontSize = '8px';
    header.style.fontWeight = 'bold';
    header.style.letterSpacing = '.35px';
    header.style.textAlign = 'center';
    header.innerHTML = cultNames[cult];

    for(var i = 0; i < 11; i++) {
      var levelY = y + 25 + i * 34;
      var level = makeSizedDiv(x + 3, levelY, trackwidth - 6, 33, hudElement);
      level.style.boxSizing = 'border-box';
      level.style.borderTop = i ? '1px solid rgba(91,65,40,.24)' : '0';
      level.style.background = i % 2 ? 'rgba(255,255,255,.28)' : 'rgba(112,82,48,.06)';
      level.style.color = '#5c4028';
      level.style.fontSize = '10px';
      level.style.fontWeight = 'bold';
      level.style.padding = '9px 4px';
      var levelValue = 10 - i;
      level.innerHTML = levelValue;
      if(powerRewards[levelValue]) {
        for(var powerLineIndex = 0; powerLineIndex < powerRewards[levelValue]; powerLineIndex++) {
          // Overlay the divider below the reached step: 2/3, 4/5, and 6/7.
          var powerLine = makeSizedDiv(x + 3, levelY + 33 + powerLineIndex * 3, trackwidth - 6, 1, hudElement);
          powerLine.style.background = '#8052a2';
          powerLine.style.boxShadow = '0 1px 0 rgba(255,255,255,.55)';
          powerLine.style.pointerEvents = 'none';
          powerLine.title = '+' + powerRewards[levelValue] + ' power when you reach this cult step.';
        }
      }
    }
    for(var i = 0; i < game.players.length; i++) {
      var player = game.players[i];
      if(player.color == I || player.color == N) continue;
      var num = player.cult[cult];
      var markerX = x + 20 + Math.floor(i * (trackwidth - 34) / Math.max(1, game.players.length - 1));
      var marker = makeSizedDiv(markerX, y + 34 + (10 - num) * 34, 14, 14, hudElement);
      marker.style.boxSizing = 'border-box';
      marker.style.border = player.human ? '2px solid #f7dc80' : '2px solid #4c3524';
      marker.style.borderRadius = '50%';
      marker.style.background = getImageColor(player.woodcolor);
      marker.style.boxShadow = '0 1px 2px rgba(45,28,15,.44), inset 0 1px 1px rgba(255,255,255,.45)';
      marker.title = getFullName(player) + ': ' + num + ' on ' + cultNames[cult].toLowerCase() + '.';
    }
    for(var i = 0; i < 4; i++) {
      var x2 = x + 4 + i * 13;
      var priestSpot = makeSizedDiv(x2, y + 407, 11, 28, hudElement);
      priestSpot.style.boxSizing = 'border-box';
      priestSpot.style.border = '1px solid #806348';
      priestSpot.style.borderRadius = '5px';
      priestSpot.style.background = game.cultp[cult][i] == N ? '#d6c9ad' : getImageColor(game.cultp[cult][i]);
      priestSpot.style.color = game.cultp[cult][i] == N ? '#5c4530' : getHighContrastColor(getImageColor(game.cultp[cult][i]));
      priestSpot.style.fontSize = '7px';
      priestSpot.style.fontWeight = 'bold';
      priestSpot.style.paddingTop = '3px';
      priestSpot.style.textAlign = 'center';
      priestSpot.innerHTML = i == 0 ? '3' : '2';
    }

    var ui = makeSameSizeDiv(track, hudElement);
    ui.style.height = trackheight + 'px';
    ui.style.cursor = 'pointer';
    ui.onclick = bind(function(cult) {
      if(cultClickFun) {
        cultClickFun(cult);
      } else if(executeButtonFun_ /*the way to check a human is doing action. TODO: improve that way*/) {
        // Shortcut: click on cult track immediately to send priest there, rather than on the 'cult' button in the action links
        var type = getAutoSendPriestCultAction(getCurrentPlayer(), cult);
        prepareAction(makeActionWithCult(type, cult));
      }
    }, cult);
  }

  drawTrack(px + trackwidth * 0, py, C_F);
  drawTrack(px + trackwidth * 1, py, C_W);
  drawTrack(px + trackwidth * 2, py, C_E);
  drawTrack(px + trackwidth * 3, py, C_A);

  var keyPlayer = getCurrentPlayer();
  for(var key = 0; key < 3; key++) {
    var keyLine = makeSizedDiv(px + 2, py + 58 + key * 3, trackwidth * 4 - 4, 1, hudElement);
    keyLine.style.background = keyPlayer && keyPlayer.keys > 2 - key ? '#463323' : '#b13a32';
    keyLine.style.pointerEvents = 'none';
  }
}

function renderTownTile(px, py, tile, details, onTileClick, parent) {
  parent = parent || hudElement;
  // Town tiles use a compact, square plaque: distinct from the bonus scrolls,
  // but built from the same small vocabulary of rewards and point medals.
  var el = makeSizedDiv(px, py, 52, 50, parent);
  el.style.boxSizing = 'border-box';
  el.style.border = '2px solid #58402f';
  el.style.borderRadius = '7px';
  el.style.background = 'linear-gradient(135deg, #8f6a49, #d8b979 16%, #f7e8bb 52%, #bd8b52 100%)';
  el.style.boxShadow = '0 2px 3px rgba(48,31,17,.42), inset 0 0 0 1px #fff3cf';

  var inner = makeSizedDiv(px + 4, py + 4, 44, 42, parent);
  inner.style.boxSizing = 'border-box';
  inner.style.border = '1px solid rgba(104,71,38,.58)';
  inner.style.borderRadius = '4px';
  inner.style.background = 'linear-gradient(90deg, rgba(150,103,56,.13), rgba(255,250,220,.22) 48%, rgba(150,103,56,.14))';
  inner.style.pointerEvents = 'none';

  drawVPBadge(px + 17, py + 5, details.vp, parent);

  if(details.reward || details.cultAmount || details.shipping) {
    var divider = makeSizedDiv(px + 9, py + 27, 34, 1, parent);
    divider.style.background = 'rgba(103,70,38,.46)';
    divider.style.pointerEvents = 'none';
  }
  if(details.reward) {
    drawBonusResourceAmount(px + 17, py + 30, details.reward, parent, false);
  } else if(details.cultAmount) {
    drawCultSetReward(px + 7, py + 31, details.cultAmount, parent);
  } else if(details.shipping) {
    // The promotion's shipping reward is clearer as a compact named badge
    // than as a tiny abstract water glyph.
    var shippingLabel = makeSizedDiv(px + 10, py + 30, 32, 12, parent);
    shippingLabel.style.boxSizing = 'border-box';
    shippingLabel.style.border = '1px solid #3c6475';
    shippingLabel.style.borderRadius = '6px';
    shippingLabel.style.background = 'linear-gradient(#e0f1f4, #82b6c4)';
    shippingLabel.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,.75)';
    styleBonusTileText(shippingLabel, 6, 'bold', '#244653');
    shippingLabel.style.display = 'flex';
    shippingLabel.style.alignItems = 'center';
    shippingLabel.style.justifyContent = 'center';
    shippingLabel.innerHTML = 'SHIP +1';
  }

  if(onTileClick) {
    var elui = makeSameSizeDiv(el, parent);
    elui.style.cursor = 'pointer';
    elui.onclick = function() { onTileClick(tile); };
    IEClickHack(elui);
    elui.title = tileToHelpString(tile, true);
  }

  return [53, 51];
}

function drawTownTile(px, py, tile, onTileClick, parent) {
  var details = {vp: 0};
  if(tile == T_TW_2VP_2CULT) details = {vp: 2, cultAmount: 2};
  else if(tile == T_TW_4VP_SHIP) details = {vp: 4, shipping: true};
  else if(tile == T_TW_5VP_6C) details = {vp: 5, reward: {icon: 'coin', amount: 6}};
  else if(tile == T_TW_6VP_8PW) details = {vp: 6, reward: {icon: 'power', amount: 8}};
  else if(tile == T_TW_7VP_2W) details = {vp: 7, reward: {icon: 'worker', amount: 2}};
  else if(tile == T_TW_8VP_CULT) details = {vp: 8, cultAmount: 1};
  else if(tile == T_TW_9VP_P) details = {vp: 9, reward: {icon: 'priest', amount: 1}};
  else if(tile == T_TW_11VP) details = {vp: 11};
  return renderTownTile(px, py, tile, details, onTileClick, parent);
}

// Kept as an isolated switch so the first board-game-inspired tile pass can be
// compared with the legacy renderer while the rest of the UI remains untouched.
var USE_SCROLL_BONUS_TILES = true;

// This small vocabulary intentionally uses CSS and text, rather than game art.
// It can later be shared by round, favor and town tiles without copying assets.
var BONUS_GLYPHS = {
  spade: '♠', cult: '✦', ship: '≋', priest: 'P', dwelling: 'D',
  tradingpost: 'TP', stronghold: 'SH'
};

function styleBonusTileText(el, size, weight, color) {
  el.style.fontSize = size + 'px';
  el.style.fontFamily = 'Georgia, "Times New Roman", serif';
  el.style.fontWeight = weight;
  el.style.color = color;
  el.style.lineHeight = '1';
  el.style.textAlign = 'center';
  el.style.pointerEvents = 'none';
}

// Shared tile vocabulary. New component renderers should use these helpers so
// a coin, worker, cult requirement or VP award always reads the same way.
function drawTileIcon(px, py, icon, parent, compact) {
  return drawBonusGlyph(px, py, icon, parent, compact);
}

function drawVPBadge(px, py, amount, parent) {
  var badge = makeSizedDiv(px, py, 19, 19, parent);
  badge.style.boxSizing = 'border-box';
  badge.style.border = '1px solid #6b3f30';
  badge.style.borderRadius = '50%';
  badge.style.background = 'radial-gradient(circle at 35% 28%, #f7d794, #b66d43 68%, #75412f)';
  badge.style.boxShadow = 'inset 0 0 0 2px rgba(255,232,170,.45)';
  styleBonusTileText(badge, 11, 'bold', '#40251d');
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.lineHeight = '1';
  badge.innerHTML = amount;
  return badge;
}

function drawCultRequirement(px, py, cult, threshold, parent) {
  var badge = makeSizedDiv(px, py, 14, 14, parent);
  badge.style.boxSizing = 'border-box';
  badge.style.border = '1px solid #5b5142';
  badge.style.borderRadius = '50%';
  badge.style.background = getCultColor(cult);
  badge.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,.62)';
  styleBonusTileText(badge, 8, 'bold', cult == C_A ? '#39404a' : '#fff');
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.lineHeight = '1';
  badge.innerHTML = threshold;
  return badge;
}

// A town reward advances every cult track, so show the complete set rather
// than a vague "cult" label. One horizontal row makes the four tracks easier
// to scan in their familiar fire, water, earth, air order.
function drawCultSetReward(px, py, amount, parent) {
  var cults = [C_F, C_W, C_E, C_A];
  for(var i = 0; i < cults.length; i++) {
    var badge = makeSizedDiv(px + i * 10, py, 9, 9, parent);
    badge.style.boxSizing = 'border-box';
    badge.style.border = '1px solid #5b5142';
    badge.style.borderRadius = '50%';
    badge.style.background = getCultColor(cults[i]);
    badge.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,.58)';
    styleBonusTileText(badge, 5, 'bold', cults[i] == C_A ? '#39404a' : '#fff');
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.lineHeight = '1';
    badge.innerHTML = amount;
  }
}

function drawTileArrow(px, py, parent) {
  var arrow = makeSizedDiv(px, py, 8, 12, parent);
  styleBonusTileText(arrow, 10, 'bold', '#e9dfc0');
  arrow.style.lineHeight = '10px';
  arrow.innerHTML = '›';
  return arrow;
}

function drawTileReward(px, py, reward, parent) {
  if(reward.icon == 'spade' && reward.amount == 1) {
    var spadeLabel = makeSizedDiv(px, py, 12, 12, parent);
    styleBonusTileText(spadeLabel, 6, 'bold', '#f3e3bd');
    spadeLabel.style.display = 'flex';
    spadeLabel.style.alignItems = 'center';
    spadeLabel.style.justifyContent = 'center';
    spadeLabel.innerHTML = 'SPD';
    return spadeLabel;
  }
  return drawBonusResourceAmount(px, py, reward, parent, true);
}

function drawBonusGlyph(px, py, glyph, parent, compact) {
  var size = compact ? 12 : 17;
  var el = makeSizedDiv(px, py, size, size, parent);
  el.style.boxSizing = 'border-box';
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';

  // Resource tokens are deliberately drawn from simple geometry rather than
  // borrowing component art: a worker cube, power disc and coin each read at a glance.
  if(glyph == 'worker') {
    el.style.width = (size - 3) + 'px';
    el.style.height = (size - 3) + 'px';
    el.style.left = (px + 2) + 'px';
    el.style.top = (py + 2) + 'px';
    el.style.border = '1px solid #777168';
    el.style.borderRadius = '1px';
    el.style.background = 'linear-gradient(135deg, #ffffff 0%, #e9e6dc 58%, #c8c2b4 100%)';
    el.style.boxShadow = '2px 2px 0 rgba(91,78,59,.24), inset 1px 1px 0 #fff';
    el.style.transform = 'skewY(-5deg)';
  } else if(glyph == 'power') {
    el.style.border = '1px solid #4b2b65';
    el.style.borderRadius = '50%';
    el.style.background = 'radial-gradient(circle at 34% 28%, #c789d0, #7b438e 58%, #4b285f 100%)';
    el.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,.75), 0 1px 1px rgba(62,33,72,.35)';
  } else if(glyph == 'coin') {
    el.style.border = '1px solid #8b6720';
    el.style.borderRadius = '50%';
    el.style.background = 'radial-gradient(circle at 34% 28%, #ffe89a, #d6a52d 60%, #9c6d18 100%)';
    el.style.boxShadow = 'inset 0 0 0 2px rgba(255,238,153,.42), 0 1px 1px rgba(80,54,14,.3)';
  } else if(glyph == 'priest') {
    // A compact hooded figure gives priests a stronger silhouette than a
    // letter badge while remaining distinct from the white worker cube.
    var priestHood = makeSizedDiv(px + size * 0.23, py + 1, size * 0.54, size * 0.52, parent);
    priestHood.style.border = '1px solid #654130';
    priestHood.style.borderRadius = '50% 50% 42% 42%';
    priestHood.style.background = 'linear-gradient(135deg, #9c654b, #5d362c)';
    var priestHead = makeSizedDiv(px + size * 0.35, py + size * 0.12, size * 0.30, size * 0.30, parent);
    priestHead.style.border = '1px solid #755843';
    priestHead.style.borderRadius = '50%';
    priestHead.style.background = 'radial-gradient(circle at 36% 28%, #f7e7bf, #c99770)';
    var priestBody = makeSizedDiv(px + size * 0.19, py + size * 0.43, size * 0.62, size * 0.49, parent);
    priestBody.style.border = '1px solid #654130';
    priestBody.style.borderRadius = '45% 45% 15% 15%';
    priestBody.style.background = 'linear-gradient(90deg, #724334, #f0d9ae 45%, #89523d)';
    var priestStole = makeSizedDiv(px + size * 0.45, py + size * 0.47, size * 0.10, size * 0.39, parent);
    priestStole.style.borderRadius = '1px';
    priestStole.style.background = '#b48232';
  } else if(glyph == 'spade' || glyph == 'cult') {
    el.style.border = '1px solid #84522a';
    el.style.borderRadius = '2px';
    el.style.clipPath = 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)';
    el.style.background = 'linear-gradient(135deg, #f6c56d, #c77a32)';
    el.style.boxShadow = 'inset 0 1px 1px rgba(255,248,210,.7)';
    styleBonusTileText(el, glyph == 'cult' ? (compact ? 4 : 5) : (compact ? 6 : 7), 'bold', '#593518');
    el.style.lineHeight = (size - 1) + 'px';
    el.innerHTML = glyph == 'spade' ? 'SPD' : 'CULT';
  } else if(glyph == 'ship') {
    el.style.border = '1px solid #3c6475';
    el.style.borderRadius = '50% 50% 42% 42%';
    el.style.background = 'linear-gradient(#d6eff5, #7fb3c4)';
    styleBonusTileText(el, compact ? 7 : 11, 'bold', '#244653');
    el.style.lineHeight = (size - 1) + 'px';
    el.innerHTML = BONUS_GLYPHS[glyph];
  } else if(glyph == 'dwelling' || glyph == 'tradingpost' || glyph == 'stronghold' ||
            glyph == 'temple' || glyph == 'sanctuary') {
    var buildingLabels = {dwelling: 'D', tradingpost: 'TP', stronghold: 'SH', temple: 'TE', sanctuary: 'SA'};
    el.style.border = '1px solid #705039';
    el.style.borderRadius = '3px';
    el.style.background = 'linear-gradient(#ecd3a0, #bb8754)';
    el.style.boxShadow = 'inset 0 1px 1px rgba(255,246,212,.72)';
    styleBonusTileText(el, compact ? 5 : 7, 'bold', '#482e20');
    el.style.lineHeight = (size - 1) + 'px';
    el.innerHTML = buildingLabels[glyph];
  } else if(glyph == 'town') {
    el.style.border = '1px solid #705039';
    el.style.borderRadius = '3px';
    el.style.background = 'linear-gradient(#d5bb86, #9b704d)';
    styleBonusTileText(el, compact ? 4 : 5, 'bold', '#412c21');
    el.style.lineHeight = (size - 1) + 'px';
    el.innerHTML = 'TOWN';
  } else {
    el.style.border = '1px solid #855b2f';
    el.style.borderRadius = glyph == 'cult' ? '50%' : '3px';
    el.style.background = '#f7e3a7';
    el.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,.8)';
    styleBonusTileText(el, glyph == 'tradingpost' ? 6 : 10, 'bold', '#51351c');
    el.style.lineHeight = (size - 1) + 'px';
    el.innerHTML = BONUS_GLYPHS[glyph] || glyph;
  }
  return el;
}

function drawBonusReward(px, py, reward, parent) {
  return drawBonusResourceAmount(px, py, reward, parent, false);
}

function drawBonusResourceAmount(px, py, reward, parent, compact) {
  var size = compact ? 12 : 17;
  var glyph = drawBonusGlyph(px, py, reward.icon, parent, compact);
  var offset = reward.icon == 'worker' ? 2 : 0;
  var label = makeSizedDiv(px + offset, py, size - offset, size, parent);
  styleBonusTileText(label, compact ? 7 : 10, 'bold', reward.icon == 'power' ? '#fff7ec' : '#523514');
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.justifyContent = 'center';
  label.style.lineHeight = '1';

  // A lone worker cube is its own clear "one worker" pictogram; other amounts
  // sit directly on their token instead of consuming precious tile space.
  if((reward.icon == 'worker' || reward.icon == 'priest') && reward.amount == 1) label.innerHTML = '';
  else label.innerHTML = reward.amount;
  return glyph;
}

function drawBonusRewardPair(px, py, first, second, parent) {
  var rewards = [first, second];
  for(var i = 0; i < rewards.length; i++) {
    drawBonusResourceAmount(px + 14, py + i * 23, rewards[i], parent, false);
  }
}

function renderLegacyBonusTile(px, py, tile, text1, text2, text3, onTileClick, parent) {
  parent = parent || hudElement;
  var el = makeDiv(px, py, parent);
  el.style.border = '1px solid #55a';
  el.style.width = 47;
  el.style.height = 62;
  el.style.backgroundColor = '#ffeebb';
  makeText(px + 2, py + 5, text1, parent);
  makeText(px + 2, py + 21, text2, parent);
  makeText(px + 2, py + 37, text3, parent);
  if (game.bonustilecoins[tile]) makeText(px, py-12, '+' + game.bonustilecoins[tile] + 'c', parent);

  if(onTileClick) {
    var elui = makeSameSizeDiv(el, parent);
    elui.style.cursor = 'pointer';
    elui.onclick = function() { onTileClick(tile); };
    IEClickHack(elui);
    elui.title = tileToHelpString(tile, true);
  }
  return [48, 63];
}

function renderBonusTile(px, py, tile, details, onTileClick, parent) {
  parent = parent || hudElement;
  if(!USE_SCROLL_BONUS_TILES) {
    return renderLegacyBonusTile(px, py, tile, details.legacy1, details.legacy2, details.legacy3, onTileClick, parent);
  }

  // A tall parchment scroll stays within the legacy 48x63 layout slot.
  var el = makeSizedDiv(px + 2, py, 43, 62, parent);
  el.style.boxSizing = 'border-box';
  el.style.border = '1px solid #785936';
  el.style.borderRadius = '4px';
  el.style.background = 'linear-gradient(90deg, #d3ae70 0%, #f8e7b5 13%, #fff5d6 50%, #ecd194 87%, #c39757 100%)';
  el.style.boxShadow = '0 2px 3px rgba(55,33,13,.42), inset 0 0 0 1px #fff5d2';

  var inner = makeSizedDiv(px + 6, py + 6, 35, 50, parent);
  inner.style.boxSizing = 'border-box';
  inner.style.borderLeft = '1px solid rgba(119,79,39,.40)';
  inner.style.borderRight = '1px solid rgba(119,79,39,.40)';
  inner.style.pointerEvents = 'none';

  // Rolled paper ends create the silhouette without relying on an image asset.
  var topRoll = makeSizedDiv(px + 1, py + 1, 45, 6, parent);
  topRoll.style.border = '1px solid #795733';
  topRoll.style.borderRadius = '4px';
  topRoll.style.background = 'linear-gradient(#f9e9b7, #b98344 48%, #f6d99a)';
  topRoll.style.boxShadow = '0 1px 1px rgba(78,47,20,.32)';
  topRoll.style.pointerEvents = 'none';
  var bottomRoll = makeSizedDiv(px + 1, py + 55, 45, 6, parent);
  bottomRoll.style.border = '1px solid #795733';
  bottomRoll.style.borderRadius = '4px';
  bottomRoll.style.background = 'linear-gradient(#f8dda0, #b98344 52%, #f7e7ba)';
  bottomRoll.style.boxShadow = '0 -1px 1px rgba(78,47,20,.22)';
  bottomRoll.style.pointerEvents = 'none';

  if(details.resourceOnly) {
    drawBonusResourceAmount(px + 13, py + 21, details.reward, parent, false);
  } else if(details.resourcePair) {
    drawBonusRewardPair(px, py + 9, details.reward, details.reward2, parent);
  } else {
    drawBonusGlyph(px + 14, py + 11, details.icon, parent, false);
    if(details.boost) {
      var boost = makeSizedDiv(px + 29, py + 10, 10, 9, parent);
      boost.style.border = '1px solid #496b77';
      boost.style.borderRadius = '50%';
      boost.style.background = '#e5f3f2';
      styleBonusTileText(boost, 7, 'bold', '#2a5360');
      boost.style.lineHeight = '8px';
      boost.innerHTML = '+1';
    }
    if(details.pass) {
      var passMark = makeSizedDiv(px + 5, py + 9, 9, 9, parent);
      styleBonusTileText(passMark, 10, 'bold', '#79502e');
      passMark.style.lineHeight = '8px';
      passMark.innerHTML = '↩';
    }
    if(details.score) {
      var score = makeSizedDiv(px + 5, py + 30, 37, 8, parent);
      styleBonusTileText(score, 8, 'bold', '#804025');
      score.innerHTML = details.score;
    }
    if(details.reward && details.score) drawBonusResourceAmount(px + 16, py + 39, details.reward, parent, true);
    else if(details.reward) drawBonusReward(px + 13, py + 32, details.reward, parent);
  }

  if(game.bonustilecoins[tile]) {
    var coins = makeSizedDiv(px + 4, py - 11, 39, 10, parent);
    styleBonusTileText(coins, 8, 'bold', '#6f481f');
    coins.innerHTML = '● +' + game.bonustilecoins[tile];
  }

  if(onTileClick) {
    var elui = makeSameSizeDiv(el, parent);
    elui.style.cursor = 'pointer';
    elui.onclick = function() { onTileClick(tile); };
    IEClickHack(elui);
    elui.title = tileToHelpString(tile, true);
  }
  return [48, 63];
}

function drawBonusTile(px, py, tile, onTileClick, parent) {
  var details = {kind: 'INCOME', icon: 'coin', title: 'COINS', reward: null,
                 legacy1: '', legacy2: '', legacy3: ''};
  if(tile == T_BON_SPADE_2C) {
    details = {kind: 'ACTION', icon: 'spade', title: 'FREE DIG', reward: {icon: 'coin', amount: 2}, legacy1: 'act:dig', legacy2: '', legacy3: '+2c'};
  } else if(tile == T_BON_CULT_4C) {
    details = {kind: 'ACTION', icon: 'cult', title: 'CULT STEP', reward: {icon: 'coin', amount: 4}, legacy1: 'act:cult', legacy2: '', legacy3: '+4c'};
  } else if(tile == T_BON_6C) {
    details.reward = {icon: 'coin', amount: 6}; details.resourceOnly = true; details.legacy3 = '+6c';
  } else if(tile == T_BON_3PW_SHIP) {
    details = {kind: 'REACH', icon: 'ship', title: 'SHIPPING', boost: true, reward: {icon: 'power', amount: 3}, legacy1: '+ship', legacy2: '', legacy3: '+3pw'};
  } else if(tile == T_BON_3PW_1W) {
    details = {kind: 'INCOME', icon: 'worker', title: 'WORKER', reward: {icon: 'power', amount: 3}, reward2: {icon: 'worker', amount: 1}, resourcePair: true, legacy1: '', legacy2: '+1w', legacy3: '+3pw'};
  } else if(tile == T_BON_PASSDVP_2C) {
    details = {kind: 'PASS', icon: 'dwelling', title: 'DWELLING', pass: true, score: '1 VP', reward: {icon: 'coin', amount: 2}, legacy1: 'pass:', legacy2: 'D 1vp', legacy3: '+2c'};
  } else if(tile == T_BON_PASSTPVP_1W) {
    details = {kind: 'PASS', icon: 'tradingpost', title: 'TRADING POST', pass: true, score: '2 VP', reward: {icon: 'worker', amount: 1}, legacy1: 'pass:', legacy2: 'TP 2vp', legacy3: '+1w'};
  } else if(tile == T_BON_PASSSHSAVP_2W) {
    details = {kind: 'PASS', icon: 'stronghold', title: 'SH / SA', pass: true, score: '4 VP', reward: {icon: 'worker', amount: 2}, legacy1: 'pass:', legacy2: 'S 4vp', legacy3: '+2w'};
  } else if(tile == T_BON_1P) {
    details = {kind: 'INCOME', icon: 'priest', title: 'PRIEST', reward: {icon: 'priest', amount: 1}, resourceOnly: true, legacy1: '', legacy2: '', legacy3: '+1p'};
  } else if(tile == T_BON_PASSSHIPVP_3PW) {
    details = {kind: 'PASS', icon: 'ship', title: 'SHIPPING', pass: true, score: '3 VP', reward: {icon: 'power', amount: 3}, legacy1: 'pass:', legacy2: 'shipvp', legacy3: '+3pw'};
  }
  return renderBonusTile(px, py, tile, details, onTileClick, parent);
}

function drawFavorCultSteps(px, py, cult, amount, parent) {
  var diameter = 10;
  var gap = 2;
  var height = amount * diameter + (amount - 1) * gap;
  var startY = py + (34 - height) / 2;
  for(var i = 0; i < amount; i++) {
    var pip = makeSizedDiv(px, startY + i * (diameter + gap), diameter, diameter, parent);
    pip.style.boxSizing = 'border-box';
    pip.style.border = '1px solid #574a3d';
    pip.style.borderRadius = '50%';
    pip.style.background = 'radial-gradient(circle at 35% 28%, rgba(255,255,255,.66), ' + getCultColor(cult) + ' 64%, rgba(53,42,29,.32))';
    pip.style.boxShadow = 'inset 0 0 0 1px rgba(255,246,211,.35), 0 1px 1px rgba(66,47,25,.25)';
  }
}

function drawFavorText(px, py, width, height, value, size, parent) {
  var label = makeSizedDiv(px, py, width, height, parent);
  styleBonusTileText(label, size, 'bold', '#543722');
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.justifyContent = 'center';
  label.style.lineHeight = '1';
  label.innerHTML = value;
  return label;
}

function drawFavorReward(px, py, details, parent) {
  if(details.kind == 'resource') {
    drawBonusResourceAmount(px + 8, py + 16, details.reward, parent, false);
  } else if(details.kind == 'resources') {
    drawBonusResourceAmount(px + 10, py + 6, details.reward, parent, true);
    drawBonusResourceAmount(px + 10, py + 28, details.reward2, parent, true);
  } else if(details.kind == 'town') {
    drawFavorText(px + 2, py + 10, 32, 10, 'TOWN', 7, parent);
    drawFavorText(px + 2, py + 25, 32, 10, 'SIZE 6', 7, parent);
  } else if(details.kind == 'cultAction') {
    drawFavorText(px + 2, py + 9, 32, 10, 'CULT', 7, parent);
    var actionBadge = makeSizedDiv(px + 5, py + 22, 26, 13, parent);
    actionBadge.style.boxSizing = 'border-box';
    actionBadge.style.border = '1px solid #84522a';
    actionBadge.style.borderRadius = '3px';
    actionBadge.style.background = 'linear-gradient(135deg, #f6c56d, #c77a32)';
    styleBonusTileText(actionBadge, 7, 'bold', '#593518');
    actionBadge.style.display = 'flex';
    actionBadge.style.alignItems = 'center';
    actionBadge.style.justifyContent = 'center';
    actionBadge.innerHTML = 'ACT +1';
  } else if(details.kind == 'score') {
    drawTileIcon(px + 12, py + 8, details.building, parent, true);
    drawFavorText(px + 3, py + 25, 30, 12, details.vp + ' VP', 8, parent);
  } else if(details.kind == 'passScore') {
    drawFavorText(px + 2, py + 6, 32, 10, 'TP PASS', 6, parent);
    drawFavorText(px + 1, py + 19, 34, 10, '2/3/3/4', 7, parent);
    drawFavorText(px + 2, py + 30, 32, 8, 'VP', 6, parent);
  }
}

function renderFavorTile(px, py, tile, details, onTileClick, parent) {
  parent = parent || hudElement;
  var el = makeSizedDiv(px, py, 70, 50, parent);
  el.style.boxSizing = 'border-box';
  el.style.border = '2px solid #5a4736';
  el.style.borderRadius = '3px';
  el.style.background = 'linear-gradient(135deg, #a77b42, #e8ca7c 15%, #f8e8af 54%, #b78549)';
  el.style.boxShadow = '0 2px 3px rgba(52,35,18,.4), inset 0 0 0 1px #fff3c9';

  var inner = makeSizedDiv(px + 4, py + 4, 62, 42, parent);
  inner.style.boxSizing = 'border-box';
  inner.style.border = '1px solid rgba(106,74,42,.55)';
  inner.style.pointerEvents = 'none';

  if(details.cultOnly) {
    // These tiles solely advance a cult three spaces, so their centered
    // vertical stack is the entire component's visual hierarchy.
    drawFavorCultSteps(px + 30, py + 8, details.cult, 3, parent);
  } else {
    drawFavorCultSteps(px + 12, py + 8, details.cult, details.cultAmount, parent);
    var divider = makeSizedDiv(px + 34, py + 7, 1, 36, parent);
    divider.style.background = 'rgba(101,68,37,.45)';
    divider.style.pointerEvents = 'none';
    drawFavorReward(px + 35, py, details, parent);
  }

  if(onTileClick) {
    var elui = makeSameSizeDiv(el, parent);
    elui.style.cursor = 'pointer';
    elui.onclick = function() { onTileClick(tile); };
    IEClickHack(elui);
    elui.title = tileToHelpString(tile, true);
  }

  return [71, 51];
}

function drawFavorTile(px, py, tile, onTileClick, parent) {
  var details;
  if(tile == T_FAV_3F) details = {cult: C_F, cultOnly: true};
  else if(tile == T_FAV_3W) details = {cult: C_W, cultOnly: true};
  else if(tile == T_FAV_3E) details = {cult: C_E, cultOnly: true};
  else if(tile == T_FAV_3A) details = {cult: C_A, cultOnly: true};
  else if(tile == T_FAV_2F_6TW) details = {cult: C_F, cultAmount: 2, kind: 'town'};
  else if(tile == T_FAV_2W_CULT) details = {cult: C_W, cultAmount: 2, kind: 'cultAction'};
  else if(tile == T_FAV_2E_1PW1W) details = {cult: C_E, cultAmount: 2, kind: 'resources', reward: {icon: 'power', amount: 1}, reward2: {icon: 'worker', amount: 1}};
  else if(tile == T_FAV_2A_4PW) details = {cult: C_A, cultAmount: 2, kind: 'resource', reward: {icon: 'power', amount: 4}};
  else if(tile == T_FAV_1F_3C) details = {cult: C_F, cultAmount: 1, kind: 'resource', reward: {icon: 'coin', amount: 3}};
  else if(tile == T_FAV_1W_TPVP) details = {cult: C_W, cultAmount: 1, kind: 'score', building: 'tradingpost', vp: 3};
  else if(tile == T_FAV_1E_DVP) details = {cult: C_E, cultAmount: 1, kind: 'score', building: 'dwelling', vp: 2};
  else if(tile == T_FAV_1A_PASSTPVP) details = {cult: C_A, cultAmount: 1, kind: 'passScore'};
  else return [0, 0];
  return renderFavorTile(px, py, tile, details, onTileClick, parent);
}

// The rules engine already pauses on these states. This visual layer presents
// that paused decision as a focused picker instead of asking the player to
// locate a small tile elsewhere on the board.
// These preferences deliberately apply only to the visual dock and live for
// the current page session; they never affect game state or saved games.
var tileChoiceDockPosition = {x: GAMEPLAY_POPUP_DOCK_X, y: GAMEPLAY_POPUP_DOCK_Y};
var tileChoiceDockCompact = false;

function makeTileChoiceDockControl(x, y, width, label, title, click, parent) {
  var control = makeSizedDiv(x, y, width, 25, parent);
  control.style.boxSizing = 'border-box';
  control.style.padding = '5px 4px';
  control.style.background = 'rgba(255,248,222,.72)';
  control.style.border = '1px solid #785435';
  control.style.borderRadius = '5px';
  control.style.boxShadow = '0 1px 2px rgba(51,32,16,.22)';
  control.style.color = '#4d321f';
  control.style.cursor = 'pointer';
  control.style.fontSize = '10px';
  control.style.fontWeight = 'bold';
  control.style.textAlign = 'center';
  control.style.userSelect = 'none';
  control.style.zIndex = 2004;
  control.title = title;
  control.innerHTML = label;
  if(click) control.onclick = click;
  return control;
}

function drawTileChoiceModal(choice, player) {
  resetGameplayPopupPosition();
  popupElement.innerHTML = '';

  var titles = {
    bonus: 'Choose a bonus tile',
    favor: 'Choose a favor tile',
    town: 'Choose a town reward'
  };
  var subtitles = {
    bonus: 'Passing: choose one available bonus tile for the next round.',
    favor: 'Choose one available favor tile.',
    town: 'Your town is formed: choose one available town reward.'
  };
  var favorColumns = [
    [T_FAV_3F, T_FAV_2F_6TW, T_FAV_1F_3C],
    [T_FAV_3W, T_FAV_2W_CULT, T_FAV_1W_TPVP],
    [T_FAV_3E, T_FAV_2E_1PW1W, T_FAV_1E_DVP],
    [T_FAV_3A, T_FAV_2A_4PW, T_FAV_1A_PASSTPVP]
  ];
  var bonusCount = 0;
  var townCount = 0;
  for(var countTile = T_BON_BEGIN + 1; countTile < T_BON_END; countTile++) {
    if(game.bonustiles[countTile] > 0) bonusCount++;
  }
  for(var townCountTile = T_TW_BEGIN + 1; townCountTile < T_TW_END; townCountTile++) {
    if(game.towntiles[townCountTile] > 0) townCount++;
  }
  // All in-game choices use the same right-hand decision dock.
  var compact = tileChoiceDockCompact;
  var panelW = compact ? 405 : 515;
  var tileScale = choice == 'favor' ? (compact ? 1 : 1.18) : (compact ? .95 : 1.3);
  var contentHeight;
  var bonusColumns = Math.max(1, Math.floor(((panelW - 28) / tileScale - 8 + 16) / 62));
  if(choice == 'bonus') contentHeight = Math.max(62, Math.ceil(bonusCount / bonusColumns) * 70 - 8);
  else if(choice == 'town') contentHeight = Math.max(50, Math.ceil(townCount / 4) * 58 - 8);
  else contentHeight = 166; // Four favor columns by three rows.
  // The parchment grows to its real tile grid. This keeps every choice inside
  // its frame even with a full bonus or town supply.
  var panelH = 74 + Math.ceil(contentHeight * tileScale);
  var popupDock = getGameplayPopupDock(panelW, panelH);
  tileChoiceDockPosition.x = popupDock.x;
  tileChoiceDockPosition.y = popupDock.y;
  var panelX = tileChoiceDockPosition.x;
  var panelY = tileChoiceDockPosition.y;

  var dockLayer = makeSizedDiv(panelX, panelY, panelW, panelH, popupElement);
  dockLayer.style.zIndex = 2001;
  var panel = makeSizedDiv(0, 0, panelW, panelH, dockLayer);
  panel.style.boxSizing = 'border-box';
  panel.style.border = '3px solid #553d2b';
  panel.style.borderRadius = '10px';
  panel.style.background = 'linear-gradient(135deg, #8e673f, #e2c17e 9%, #fff0c6 52%, #b77f43)';
  panel.style.boxShadow = '0 5px 12px rgba(25,17,10,.35), inset 0 0 0 2px rgba(255,247,214,.7)';
  makeGameplayPopupDragHandle(panelX, panelY, panelW - 77);

  var title = makeSizedDiv(18, 14, panelW - 180, 22, dockLayer);
  title.style.zIndex = 2002;
  styleBonusTileText(title, 16, 'bold', '#4b3020');
  title.style.textAlign = 'left';
  title.innerHTML = titles[choice];
  var subtitle = makeSizedDiv(18, 39, panelW - 36, 14, dockLayer);
  subtitle.style.zIndex = 2002;
  styleBonusTileText(subtitle, 8, 'normal', '#60442d');
  subtitle.style.textAlign = 'left';
  subtitle.innerHTML = subtitles[choice];

  makeTileChoiceDockControl(panelW - 77, 12, 62,
      compact ? 'LARGE +' : 'SMALL −',
      compact ? 'Use larger tile choices.' : 'Use a smaller choice dock.',
      function() { tileChoiceDockCompact = !tileChoiceDockCompact; drawTileChoiceModal(choice, player); }, dockLayer);

  // Tile renderers create several absolute children. A local scaled layer
  // gives their existing compact footprint a generous tablet-sized hit area.
  var choicesLayer = makeSizedDiv(14, 62, panelW - 28, panelH - 68, dockLayer);
  choicesLayer.style.zIndex = 2003;
  choicesLayer.style.transformOrigin = '0 0';
  choicesLayer.style.transform = 'scale(' + tileScale + ')';

  function choose(tile) {
    return function() {
      if(tileClickFun) tileClickFun(tile);
    };
  }

  if(choice == 'bonus') {
    var bonusX = 8;
    var bonusY = 0;
    var bonusIndex = 0;
    for(var bonus = T_BON_BEGIN + 1; bonus < T_BON_END; bonus++) {
      if(game.bonustiles[bonus] > 0) {
        drawBonusTile(bonusX + (bonusIndex % bonusColumns) * 62,
            bonusY + Math.floor(bonusIndex / bonusColumns) * 70, bonus, choose(bonus), choicesLayer);
        bonusIndex++;
      }
    }
  } else if(choice == 'town') {
    var townX = 6;
    var townY = 0;
    var townIndex = 0;
    for(var town = T_TW_BEGIN + 1; town < T_TW_END; town++) {
      if(game.towntiles[town] > 0) {
        drawTownTile(townX + (townIndex % 4) * 88, townY + Math.floor(townIndex / 4) * 58,
            town, choose(town), choicesLayer);
        townIndex++;
      }
    }
  } else {
    for(var column = 0; column < favorColumns.length; column++) {
      for(var row = 0; row < favorColumns[column].length; row++) {
        var favor = favorColumns[column][row];
        if(game.favortiles[favor] > 0 && !player.favortiles[favor]) {
          drawFavorTile(4 + column * 94, row * 58,
              favor, choose(favor), choicesLayer);
        }
      }
    }
  }
}

function getRoundTileDetails(tile) {
  if(tile == T_ROUND_DIG2VP_1E1C) return {trigger: 'spade', vp: 2, cult: C_E, threshold: 1, reward: {icon: 'coin', amount: 1}};
  if(tile == T_ROUND_TW5VP_4E1DIG) return {trigger: 'town', vp: 5, cult: C_E, threshold: 4, reward: {icon: 'spade', amount: 1}};
  if(tile == T_ROUND_D2VP_4W1P) return {trigger: 'dwelling', vp: 2, cult: C_W, threshold: 4, reward: {icon: 'priest', amount: 1}};
  if(tile == T_ROUND_SHSA5VP_2F1W) return {trigger: 'stronghold', vp: 5, cult: C_F, threshold: 2, reward: {icon: 'worker', amount: 1}};
  if(tile == T_ROUND_D2VP_4F4PW) return {trigger: 'dwelling', vp: 2, cult: C_F, threshold: 4, reward: {icon: 'power', amount: 4}};
  if(tile == T_ROUND_TP3VP_4W1DIG) return {trigger: 'tradingpost', vp: 3, cult: C_W, threshold: 4, reward: {icon: 'spade', amount: 1}};
  if(tile == T_ROUND_SHSA5VP_2A1W) return {trigger: 'stronghold', vp: 5, cult: C_A, threshold: 2, reward: {icon: 'worker', amount: 1}};
  if(tile == T_ROUND_TP3VP_4A1DIG) return {trigger: 'tradingpost', vp: 3, cult: C_A, threshold: 4, reward: {icon: 'spade', amount: 1}};
  if(tile == T_ROUND_TE4VP_P2C) return {trigger: 'temple', vp: 4, cult: 'priest', reward: {icon: 'coin', amount: 2}};
  return null;
}

function renderRoundTile(px, py, tile, details, index) {
  var el = makeSizedDiv(px, py, 70, 60, hudElement);
  el.style.boxSizing = 'border-box';
  el.style.border = (index == state.round && state.type != S_GAME_OVER) ? '3px solid #d3aa4a' : '2px solid #322d3d';
  el.style.borderRadius = '4px';
  if(index > state.round) el.style.background = 'linear-gradient(135deg, #77758d, #4f506b)';
  else if(index == state.round && state.type != S_GAME_OVER) el.style.background = 'linear-gradient(135deg, #9a9a57, #6d7244)';
  else el.style.background = 'linear-gradient(135deg, #595561, #34323b)';
  el.style.boxShadow = (index == state.round && state.type != S_GAME_OVER) ? '0 0 0 2px rgba(255,237,165,.62), 0 3px 6px rgba(72,56,23,.38), inset 0 0 0 1px rgba(255,248,204,.48)' : '0 2px 3px rgba(20,17,25,.38), inset 0 0 0 1px rgba(238,224,180,.38)';
  el.title = tileToHelpString(tile, true);

  var inner = makeSizedDiv(px + 4, py + 4, 62, 52, hudElement);
  inner.style.boxSizing = 'border-box';
  inner.style.border = '1px solid rgba(238,224,180,.48)';
  inner.style.pointerEvents = 'none';

  drawTileIcon(px + 7, py + 6, details.trigger, hudElement, false);
  if(details.triggerLabel) {
    var triggerLabel = makeSizedDiv(px + 4, py + 21, 24, 7, hudElement);
    styleBonusTileText(triggerLabel, 5, 'bold', '#f5ecd1');
    triggerLabel.innerHTML = details.triggerLabel;
  }
  drawTileArrow(px + 29, py + 9, hudElement);
  drawVPBadge(px + 43, py + 6, details.vp, hudElement);

  var divider = makeSizedDiv(px + 6, py + 29, 58, 1, hudElement);
  divider.style.background = 'rgba(238,224,180,.58)';
  divider.style.fontSize = '0%';

  if(details.cult == 'priest') {
    drawTileIcon(px + 8, py + 35, 'priest', hudElement, true);
    var priestLabel = makeSizedDiv(px + 20, py + 38, 13, 8, hudElement);
    styleBonusTileText(priestLabel, 7, 'bold', '#f6efd9');
    priestLabel.style.textAlign = 'left';
    priestLabel.innerHTML = '×';
  } else {
    drawCultRequirement(px + 7, py + 34, details.cult, details.threshold, hudElement);
  }
  drawTileArrow(px + 35, py + 36, hudElement);
  drawTileReward(px + 47, py + 34, details.reward, hudElement);

  var roundLabel = makeSizedDiv(px + 2, py - 12, 66, 10, hudElement);
  styleBonusTileText(roundLabel, 8, 'bold', '#493f38');
  roundLabel.style.textAlign = 'left';
  roundLabel.innerHTML = 'ROUND ' + index;

  return [71, 61];
}

function drawRoundTile(px, py, tile, index) {
  var details = getRoundTileDetails(tile);
  if(!details) return [0, 0];
  return renderRoundTile(px, py, tile, details, index);
}

//returns draw width
function drawTile(px, py, tile, onTileClick, index) {
  if(tile > T_FAV_BEGIN && tile < T_FAV_END) return drawFavorTile(px, py, tile, onTileClick);
  else if(tile > T_BON_BEGIN && tile < T_BON_END) return drawBonusTile(px, py, tile, onTileClick);
  else if(tile > T_TW_BEGIN && tile < T_TW_END) return drawTownTile(px, py, tile, onTileClick);
  else if(tile > T_ROUND_BEGIN && tile < T_ROUND_END) return drawRoundTile(px, py, tile, index);
  else return [0,0];
}

//returns draw width
//ui: whether it's the clickable ones that need ui click elements on them
function drawTilesMap(px, py, tiles, maxWidth, startX, onTileClick) {
  var px2 = 0;
  var py2 = 0;
  var i = 0;
  for (var tile in tiles) {
    if (tiles.hasOwnProperty(tile) && tiles[tile] > 0) {
      if (tiles[tile] > 1) makeText(px + px2, py + py2 - 12, tiles[tile] + 'x', hudElement);
      var size = drawTile(px + px2, py + py2, tile, onTileClick, i);
      if(px2 + size[0] + 5 > maxWidth) {
        px2 = (startX - px);
        py2 += size[1] + 14;
      } else {
        px2 += size[0] + (size[0] == 0 ? 0 : 5);
      }
      i++;
    }
  }
  return [px2, py2];
}

// Favor tiles have a fixed 4-by-3 family layout: each cult is a column,
// ordered fire, water, earth, air; each row is the 3-, 2-, then 1-step tile.
// Keeping slots stable makes the available choices much quicker to scan.
function drawFavorTilesGrid(px, py, tiles, onTileClick) {
  var columns = [
    [T_FAV_3F, T_FAV_2F_6TW, T_FAV_1F_3C],
    [T_FAV_3W, T_FAV_2W_CULT, T_FAV_1W_TPVP],
    [T_FAV_3E, T_FAV_2E_1PW1W, T_FAV_1E_DVP],
    [T_FAV_3A, T_FAV_2A_4PW, T_FAV_1A_PASSTPVP]
  ];
  for(var column = 0; column < columns.length; column++) {
    for(var row = 0; row < columns[column].length; row++) {
      var tile = columns[column][row];
      var amount = tiles[tile] || 0;
      if(amount > 0) {
        var tileX = px + column * 75;
        var tileY = py + row * 54;
        drawFavorTile(tileX, tileY, tile, onTileClick);
        if(amount > 1) {
          var count = makeSizedDiv(tileX + 52, tileY + 3, 13, 8, hudElement);
          styleBonusTileText(count, 6, 'bold', '#543722');
          count.style.display = 'flex';
          count.style.alignItems = 'center';
          count.style.justifyContent = 'center';
          count.style.borderRadius = '3px';
          count.style.background = 'rgba(255,244,201,.78)';
          count.innerHTML = amount + '×';
        }
      }
    }
  }
  return [295, 158];
}

// The public supply only shows tiles that remain available. Keep a compact
// visual ledger of claimed tiles as well, so it is always clear who holds a
// bonus, favor, or town reward.
function drawOwnedTileMini(parent, px, py, tile, scale, amount) {
  var layer = makeSizedDiv(px, py, 72, 64, parent);
  layer.style.transformOrigin = '0 0';
  layer.style.transform = 'scale(' + scale + ')';
  layer.style.zIndex = 2;
  layer.title = tileToHelpString(tile, true);
  if(tile > T_BON_BEGIN && tile < T_BON_END) drawBonusTile(0, 0, tile, null, layer);
  else if(tile > T_FAV_BEGIN && tile < T_FAV_END) drawFavorTile(0, 0, tile, null, layer);
  else if(tile > T_TW_BEGIN && tile < T_TW_END) drawTownTile(0, 0, tile, null, layer);

  if(amount > 1) {
    var count = makeSizedDiv(px + Math.round(46 * scale), py + Math.round(43 * scale), 15, 11, parent);
    count.style.boxSizing = 'border-box';
    count.style.paddingTop = '1px';
    count.style.border = '1px solid #68472d';
    count.style.borderRadius = '5px';
    count.style.background = '#fff5d0';
    count.style.color = '#4b3020';
    count.style.fontSize = '7px';
    count.style.fontWeight = 'bold';
    count.style.textAlign = 'center';
    count.style.zIndex = 3;
    count.innerHTML = amount + '×';
  }
}

function drawClaimedTilesLedger(px, py, width, players) {
  drawTileSectionHeader(px, py, width, 'TILES HELD BY PLAYERS');
  var gap = 6;
  var cardWidth = Math.floor((width - gap * (players.length - 1)) / players.length);
  for(var i = 0; i < players.length; i++) {
    var player = players[i];
    var cardX = px + i * (cardWidth + gap);
    var compactTiles = cardWidth < 270;
    var favorX = compactTiles ? 70 : 84;
    var favorScale = compactTiles ? .32 : .41;
    var favorStep = compactTiles ? 23 : 29;
    var townX = compactTiles ? 35 : 45;
    var townScale = compactTiles ? .42 : .52;
    var townStep = compactTiles ? 24 : 29;
    var card = makeSizedDiv(cardX, py + 24, cardWidth, 142, hudElement);
    card.style.boxSizing = 'border-box';
    card.style.border = player.index == state.currentPlayer ? '2px solid #8d6332' : '1px solid #765439';
    card.style.borderRadius = '8px';
    card.style.background = 'linear-gradient(145deg, #fffaf0, #e7cf9f)';
    card.style.boxShadow = '0 2px 4px rgba(70,45,24,.16), inset 0 0 0 1px rgba(255,255,255,.65)';
    card.style.overflow = 'hidden';

    var factionColor = getImageColor(player.woodcolor);
    var name = makeSizedDiv(4, 4, cardWidth - 8, 18, card);
    name.style.boxSizing = 'border-box';
    name.style.padding = '3px 6px';
    name.style.borderRadius = '4px';
    name.style.background = factionColor;
    name.style.color = getHighContrastColor(factionColor);
    name.style.fontSize = '9px';
    name.style.fontWeight = 'bold';
    name.style.overflow = 'hidden';
    name.style.whiteSpace = 'nowrap';
    name.style.textOverflow = 'ellipsis';
    name.title = getFullName(player);
    name.innerHTML = getFullName(player).toUpperCase();

    var bonusLabel = makeText(6, 33, 'BONUS', card);
    bonusLabel.style.color = '#63472d';
    bonusLabel.style.fontSize = '7px';
    bonusLabel.style.fontWeight = 'bold';
    if(player.bonustile != T_NONE) drawOwnedTileMini(card, 45, 25, player.bonustile, .62, 1);
    else {
      var none = makeText(45, 34, 'none', card);
      none.style.color = '#94755a';
      none.style.fontSize = '8px';
    }

    var favorLabel = makeText(favorX, 27, 'FAVOR', card);
    favorLabel.style.color = '#63472d';
    favorLabel.style.fontSize = '7px';
    favorLabel.style.fontWeight = 'bold';
    var favorIndex = 0;
    for(var favor = T_FAV_BEGIN + 1; favor < T_FAV_END; favor++) {
      var favorAmount = player.favortiles[favor] || 0;
      if(!favorAmount) continue;
      drawOwnedTileMini(card, favorX + (favorIndex % 7) * favorStep, 37 + Math.floor(favorIndex / 7) * (compactTiles ? 18 : 23), favor, favorScale, favorAmount);
      favorIndex++;
    }
    if(!favorIndex) {
      var noFavor = makeText(favorX + 40, 47, 'none', card);
      noFavor.style.color = '#94755a';
      noFavor.style.fontSize = '8px';
    }

    var townLabel = makeText(6, 92, 'TOWN', card);
    townLabel.style.color = '#63472d';
    townLabel.style.fontSize = '7px';
    townLabel.style.fontWeight = 'bold';
    var townIndex = 0;
    for(var town = T_TW_BEGIN + 1; town < T_TW_END; town++) {
      var townAmount = player.towntiles[town] || 0;
      if(!townAmount) continue;
      drawOwnedTileMini(card, townX + (townIndex % 8) * townStep, 83 + Math.floor(townIndex / 8) * (compactTiles ? 23 : 28), town, townScale, townAmount);
      townIndex++;
    }
    if(!townIndex) {
      var noTown = makeText(townX, 93, 'none', card);
      noTown.style.color = '#94755a';
      noTown.style.fontSize = '8px';
    }
  }
}

function drawTilesArray(px, py, tiles, maxWidth, startX, onTileClick) {
  var px2 = 0;
  var py2 = 0;
  for (var i = 0; i < tiles.length; i++) {
    var size = drawTile(px + px2, py + py2, tiles[i], onTileClick, i);
    if(px2 + size[0] + 5 > maxWidth) {
      px2 = (startX - px);
      py2 += size[1] + 14;
    } else {
      px2 += size[0] + (size[0] == 0 ? 0 : 5);
    }
  }
  return [px2, py2];
}

function renderFinalScoringTile(px, py, text1, text2, text3, text4, text5, text6, title) {
  var width = 120;
  var height = 70;
  var el = makeSizedDiv(px, py, width, height, hudElement);
  el.style.boxSizing = 'border-box';
  el.style.border = '2px solid #5b432d';
  el.style.borderRadius = '7px';
  el.style.background = 'linear-gradient(145deg, #8c6742, #efd391 16%, #fff1c8 55%, #bd8950)';
  el.style.boxShadow = '0 2px 4px rgba(54,34,17,.32), inset 0 0 0 1px rgba(255,247,213,.75)';
  el.title = title;

  drawSharedHeader(px + 3, py + 3, width - 6, 'FINAL', hudElement);
  var rows = [
    {label: text1 == 'cults:' ? 'CULT' : text1.replace(':', '').toUpperCase(), value: text2},
    {label: text3 == 'network:' ? 'NET' : text3.replace(':', '').toUpperCase(), value: text4},
    {label: text5 == 'settlements:' ? 'SET' : text5.replace(':', '').toUpperCase(), value: text6}
  ];
  for(var i = 0; i < rows.length; i++) {
    if(!rows[i].label) continue;
    var row = makeSizedDiv(px + 7, py + 23 + i * 14, width - 14, 12, hudElement);
    row.style.boxSizing = 'border-box';
    row.style.borderTop = i ? '1px solid rgba(96,65,36,.22)' : '0';
    row.style.color = '#56371f';
    row.style.fontSize = '8px';
    row.style.fontWeight = 'bold';
    row.innerHTML = rows[i].label + '<span style="float:right">' + rows[i].value + '</span>';
  }

  return [width + 1, height + 1];
}

function drawFinalScoringTile(px, py, index) {
  var text1 = 'cults:';
  var text2 = '8/4/2';
  var text3 = 'network:';
  var text4 = '18/12/6';
  var text5 = finalScoringCodeNames[index] + ':';
  var text6 = '18/12/6';
  if(text5 == 'none:') text5 = text6 = '';
  var title = finalScoringCodeNames[index];
  return renderFinalScoringTile(px, py, text1, text2, text3, text4, text5, text6, title);
}

//convert a cost array to a string, ignoring things that are 0.
function costToString(cost) {
  var result = '';
  if(cost[4] != 0) result += cost[4] + 'vp ';
  if(cost[3] != 0) result += cost[3] + 'pw ';
  if(cost[2] != 0) result += cost[2] + 'p ';
  if(cost[1] != 0) result += cost[1] + 'w ';
  if(cost[0] != 0) result += cost[0] + 'c ';
  return result;
}

function incomeToStringWithPluses(cost) {
  var result = '';
  function signed(num) {
    return num < 0 ? '' + num : '+' + num;
  }
  if(cost[0] != 0) result += signed(cost[0]) + 'c ';
  if(cost[1] != 0) result += signed(cost[1]) + 'w ';
  if(cost[2] != 0) result += signed(cost[2]) + 'p ';
  if(cost[3] != 0) result += signed(cost[3]) + 'pw ';
  if(cost[4] != 0) result += signed(cost[4]) + 'vp ';
  if(result.length > 0 && result.charAt(result.length - 1) == ' ') result = result.substring(0, result.length - 1);
  return result;
}

//for displaying TP cost
function costAlternativesToString(cost1, cost2) {
  var result = '';
  if(cost1[4] != cost2[4]) result += cost1[4] + '/' + cost2[1] + 'vp ';
  else if(cost1[4] != 0) result += cost1[4] + 'vp ';
  if(cost1[3] != cost2[3]) result += cost1[3] + '/' + cost2[1] + 'pw ';
  else if(cost1[3] != 0) result += cost1[3] + 'pw ';
  if(cost1[2] != cost2[2]) result += cost1[2] + '/' + cost2[1] + 'p ';
  else if(cost1[2] != 0) result += cost1[2] + 'p ';
  if(cost1[1] != cost2[1]) result += cost1[1] + '/' + cost2[1] + 'w ';
  else if(cost1[1] != 0) result += cost1[1] + 'w ';
  if(cost1[0] != cost2[0]) result += cost1[0] + '/' + cost2[0] + 'c ';
  else if(cost1[0] != 0) result += cost1[0] + 'c ';
  return result;
}

function getFullVPDetailsText(player) {
  var vpbreakdown = '';
  var arr = [];
  for(name in player.vp_detail) {
    //vpbreakdown += name + ':' + player.vp_detail[name] + ' \n';
    arr.push([name, player.vp_detail[name]]);
  }

  arr.sort(function(a, b) {
    return b[1] - a[1];
  });

  for(var i = 0; i < arr.length; i++) {
    vpbreakdown += arr[i][0] + ': ' + arr[i][1] + '\n';
  }

  return 'VP: ' + player.vp + '\n' + vpbreakdown;
}

function dangerColor(danger, text) {
  return danger ? '<font color="red">' + text + '</font>' : text;
}

function getPlayerResourcesString(player, markup) {
  var result = player.c + 'c, ' + player.w + 'w, '
      + player.p + '/' + player.pp + ' p, ';
  var pw = '' + player.pw0 + '/' + player.pw1 + '/' + player.pw2 + ' pw';
  if(markup) result += '<font color="#909">' + pw + '</font>';
  else result += pw;
  return result;
}

function drawPlayerDashboardToken(px, py, icon, text, labelWidth) {
  drawBonusGlyph(px, py, icon, hudElement, true);
  var label = makeSizedDiv(px + 14, py + 2, labelWidth || 38, 11, hudElement);
  label.style.color = '#49311f';
  label.style.fontSize = '9px';
  label.style.fontWeight = 'bold';
  label.style.whiteSpace = 'nowrap';
  label.innerHTML = text;
}

function drawHumanColorWheel() {
  var human = null;
  for(var i = 0; i < game.players.length; i++) {
    if(game.players[i].human) { human = game.players[i]; break; }
  }
  if(!human || human.woodcolor < CIRCLE_BEGIN || human.woodcolor > CIRCLE_END) return;

  var wheel = makeSizedDiv(505, 3, 178, 29, hudElement);
  wheel.style.zIndex = 101;
  wheel.style.pointerEvents = 'none';
  wheel.title = 'Terrain color wheel. Your terrain color is outlined.';

  var centerX = 89;
  var centerY = 14;
  for(var color = CIRCLE_BEGIN; color <= CIRCLE_END; color++) {
    var offset = color - CIRCLE_BEGIN;
    var angle = -Math.PI / 2 + offset * 2 * Math.PI / 7;
    var pip = makeSizedDiv(centerX + Math.round(Math.cos(angle) * 12) - 6, centerY + Math.round(Math.sin(angle) * 12) - 6, 12, 12, wheel);
    pip.style.boxSizing = 'border-box';
    pip.style.border = (color == human.woodcolor ? '2px solid #f7df8a' : '1px solid #4d3523');
    pip.style.borderRadius = '50%';
    pip.style.background = getImageColor(color);
    pip.style.boxShadow = (color == human.woodcolor ? '0 0 0 1px #57391f, 0 1px 2px rgba(47,29,16,.42)' : 'inset 0 1px 1px rgba(255,255,255,.55), 0 1px 1px rgba(46,29,17,.28)');
  }
}

function drawCompactPlayerPanel(px, py, width, player) {
  var current = player.index == state.currentPlayer;
  var factionColor = getImageColor(player.woodcolor);
  var factionText = getHighContrastColor(factionColor);
  var bg = makeSizedDiv(px, py, width, 112, hudElement);
  bg.style.boxSizing = 'border-box';
  bg.style.border = current ? '3px solid #8d6332' : '1px solid #765439';
  bg.style.borderRadius = '9px';
  bg.style.background = player.passed ? 'linear-gradient(145deg, #eee7dd, #d4c9bb)' : 'linear-gradient(145deg, #fffaf0, #e7cf9f)';
  bg.style.boxShadow = current ? '0 3px 7px rgba(70,45,24,.28), inset 0 0 0 1px rgba(255,255,255,.74)' : '0 2px 4px rgba(70,45,24,.18), inset 0 0 0 1px rgba(255,255,255,.65)';

  var header = makeSizedDiv(px + 3, py + 3, width - 6, 24, hudElement);
  header.style.boxSizing = 'border-box';
  header.style.padding = '3px 7px';
  header.style.borderRadius = '5px';
  header.style.background = factionColor;
  header.style.color = factionText;
  header.style.fontWeight = 'bold';
  header.style.overflow = 'hidden';
  header.style.whiteSpace = 'nowrap';
  header.title = getFullName(player);
  header.innerHTML = player.faction == undefined || player.faction == F_NONE ? 'UNASSIGNED' : getFactionCodeName(player.getFaction()).toUpperCase();

  var status = player.passed ? 'PASSED' : (player.index == state.startPlayer ? 'START' : '');
  if(status) {
    var statusBadge = makeSizedDiv(px + 7, py + 29, 42, 10, hudElement);
    statusBadge.style.color = player.passed ? '#765346' : '#52633e';
    statusBadge.style.fontSize = '7px';
    statusBadge.style.fontWeight = 'bold';
    statusBadge.innerHTML = status;
  }

  var vp = makeSizedDiv(px + width - 39, py + 29, 31, 20, hudElement);
  vp.style.boxSizing = 'border-box';
  vp.style.padding = '3px 1px';
  vp.style.border = '1px solid #74452d';
  vp.style.borderRadius = '10px';
  vp.style.background = 'radial-gradient(circle at 36% 28%, #f7d794, #b66d43 70%, #75412f)';
  vp.style.color = '#3f251b';
  vp.style.cursor = 'pointer';
  vp.style.fontSize = '11px';
  vp.style.fontWeight = 'bold';
  vp.style.lineHeight = '12px';
  vp.style.textAlign = 'center';
  vp.title = getFullVPDetailsText(player);
  vp.innerHTML = player.vp;
  vp.onclick = bind(showGreyDialogAtMouse, getFullVPDetailsText(player));

  drawPlayerDashboardToken(px + 8, py + 43, 'coin', player.c + ' C', 32);
  drawPlayerDashboardToken(px + 52, py + 43, 'worker', player.w + ' W', 32);
  drawPlayerDashboardToken(px + 98, py + 43, 'priest', player.p + '/' + player.pp + ' P', 40);
  drawPlayerDashboardToken(px + 153, py + 43, 'power', player.pw0 + '/' + player.pw1 + '/' + player.pw2 + ' PW', 58);

  var buildings = makeSizedDiv(px + 8, py + 60, width - 16, 12, hudElement);
  buildings.style.color = '#51351f';
  buildings.style.fontSize = '8px';
  buildings.style.fontWeight = 'bold';
  buildings.innerHTML = 'D ' + built_d(player) + '/8 · TP ' + built_tp(player) + '/4 · TE ' + built_te(player) + '/3 · SH ' + built_sh(player) + '/1 · SA ' + built_sa(player) + '/1';

  var advances = makeSizedDiv(px + 8, py + 73, width - 16, 11, hudElement);
  advances.style.color = '#63472d';
  advances.style.fontSize = '8px';
  advances.style.fontWeight = 'bold';
  var travel = player.maxtunnelcarpetdistance > 0 ? 'RANGE ' + player.tunnelcarpetdistance + '/' + player.maxtunnelcarpetdistance : 'SHIP ' + getShipping(player, false) + '/' + player.maxshipping;
  advances.innerHTML = 'DIG ' + player.digging + '/' + player.maxdigging + ' · ' + travel;

  var income = getIncome(player, player.passed, state.round);
  var dangerp = income[2] > player.pp - player.p;
  var dangerpw = income[3] > player.pw0 * 2 + player.pw1;
  var incomeBar = makeSizedDiv(px + 4, py + 88, width - 8, 19, hudElement);
  incomeBar.style.boxSizing = 'border-box';
  incomeBar.style.padding = '4px 6px';
  incomeBar.style.border = '1px solid #577244';
  incomeBar.style.borderRadius = '5px';
  incomeBar.style.background = 'linear-gradient(145deg, #dceec8, #9fbe7e)';
  incomeBar.style.color = '#294522';
  incomeBar.style.fontSize = '8px';
  incomeBar.style.fontWeight = 'bold';
  incomeBar.innerHTML = 'NEXT +' + income[0] + ' C  +' + income[1] + ' W  +' +
      dangerColor(dangerp, income[2] + ' P') + '  +' + dangerColor(dangerpw, income[3] + ' PW');
}

function drawPlayerPanel(px, py, player, scoreProjection, compactWidth) {
  if(compactWidth) {
    drawCompactPlayerPanel(px, py, compactWidth, player);
    return;
  }
  var bg = makeSizedDiv(px - 5, py - 5, 1073, 185, hudElement)
  bg.style.border = player.index == state.currentPlayer ? '2px solid black' : '1px solid black';
  bg.style.backgroundColor = '#fff0e0';

  function drawDigCircle(px, py) {
    if(player.color == Z) {
      var colors = player.colors;
      if(colors[S - R]) drawOrb(px + 0, py + 39 - 0, S);
      if(colors[G - R]) drawOrb(px + 16, py + 39 - 8, G);
      if(colors[R - R]) drawOrb(px - 16, py + 39 - 8, R);
      if(colors[B - R]) drawOrb(px + 20, py + 39 - 25, B);
      if(colors[Y - R]) drawOrb(px - 20, py + 39 - 25, Y);
      if(colors[K - R]) drawOrb(px + 9, py + 39 - 39, K);
      if(colors[U - R]) drawOrb(px - 9, py + 39 - 39, U);
    } else {
      var num = CIRCLE_END - CIRCLE_BEGIN + 1;
      var b = CIRCLE_BEGIN;
      var color = player.auxcolor;
      if(!(color >= CIRCLE_BEGIN && color <= CIRCLE_END)) color = player.woodcolor;
      if(!(color >= CIRCLE_BEGIN && color <= CIRCLE_END)) return;
      drawOrb(px + 0, py + 0, color);
      drawOrb(px + 16, py + 8, b + (color + 1 - b) % num);
      drawOrb(px + -16, py + 8, b + (color + 6 - b) % num);
      drawOrb(px + 20, py + 25, b + (color + 2 - b) % num);
      drawOrb(px + -20, py + 25, b + (color + 5 - b) % num);
      drawOrb(px + 9, py + 39, b + (color + 3 - b) % num);
      drawOrb(px + -9, py + 39, b + (color + 4 - b) % num);
    }
  }
  var name = getFullName(player);
  var playertext = makeText(px, py, name, hudElement);
  var imColor = getImageColor(player.woodcolor);
  if(player.passed) {
    playertext.style.backgroundColor = getTranslucentColor(imColor, 64);
    playertext.style.color = getTranslucentColor(getHighContrastColor(imColor), 128);
  } else {
    playertext.style.backgroundColor = imColor;
    playertext.style.color = getHighContrastColor(imColor);
  }


  var vptext = makeText(px, py + 15, 'VP: ' + player.vp, hudElement);
  vptext.title = getFullVPDetailsText(player);
  vptext.onclick = bind(showGreyDialogAtMouse, getFullVPDetailsText(player));
  vptext.style.cursor = 'pointer';
  vptext.style.fontWeight = 'bold';
  var passedtext = ''
  if(player.passed && player.index == state.startPlayer) passedtext += 'passed, start';
  else if(player.passed) passedtext += 'passed';
  else if(player.index == state.startPlayer) passedtext += 'start';
  makeText(name.length > 18 ? px + 170 : px + 130, py , passedtext, hudElement);
  makeText(px, py + 30, 'res: <b>' + getPlayerResourcesString(player, true) + '</b>', hudElement);

  makeText(px, py + 45, 'D: <b>' + dangerColor(player.b_d == 0, built_d(player) + '/8</b>') + ' cost: ' + costToString(player.getFaction().getBuildingCost(B_D, false)) +
      ' next: ' + costToString(getIncomeForNextBuilding(player, B_D)), hudElement);
  makeText(px, py + 60, 'TP: <b>' + dangerColor(player.b_tp == 0, built_tp(player) + '/4</b>') + ' cost: ' +
      costAlternativesToString(player.getFaction().getBuildingCost(B_TP, true), player.getFaction().getBuildingCost(B_TP, false)) +
      ' next: ' + costToString(getIncomeForNextBuilding(player, B_TP)), hudElement);
  makeText(px, py + 75, 'TE: <b>' + dangerColor(player.b_te == 0, built_te(player) + '/3</b>') + ' cost: ' + costToString(player.getFaction().getBuildingCost(B_TE, true)) +
      ' next: ' + costToString(getIncomeForNextBuilding(player, B_TE)), hudElement);
  makeText(px, py + 90, 'SH: <b>' + built_sh(player) + '/1</b> cost: ' + costToString(player.getFaction().getBuildingCost(B_SH, true)) +
      ' next: ' + costToString(getIncomeForNextBuilding(player, B_SH)), hudElement);
  makeText(px, py + 105, 'SA: <b>' + built_sa(player) + '/1</b> cost: ' + costToString(player.getFaction().getBuildingCost(B_SA, true)) +
      ' next: ' + costToString(getIncomeForNextBuilding(player, B_SA)), hudElement);


  if(player.maxdigging > 0) makeText(px, py + 120, 'digging: <b>' + player.digging + '</b> (' + player.digging + '/' + player.maxdigging + ') advcost: ' + costToString(player.getActionCost(A_ADV_DIG)), hudElement);
  else if(player.maxdigging == 0) makeText(px, py + 120, 'digging: 0/0', hudElement);
  else makeText(px, py + 120, 'digging: N/A', hudElement);
  if(player.maxshipping > 0) makeText(px, py + 135, 'shipping: <b>' + getShipping(player, false) + '</b> (' + player.shipping + '/' + player.maxshipping + (player.bonusshipping ? ' + ' + player.bonusshipping : '') + ') advcost: ' + costToString(player.getActionCost(A_ADV_SHIP)), hudElement);
  else if(player.maxtunnelcarpetdistance > 0) makeText(px, py + 135, 'range: <b>' + player.tunnelcarpetdistance + '/' + player.maxtunnelcarpetdistance, hudElement);
  else if(player.maxshipping == 0) makeText(px, py + 135, 'shipping: 0/0', hudElement);
  else makeText(px, py + 135, 'shipping: N/A', hudElement);

  if(state.round == 6 && state.type != S_GAME_OVER) {
    var p = scoreProjection[player.index];
    makeText(px, py + 150, 'projected end vp: <b>' + p[0] + '</b> (current: ' + player.vp + ', cult: ' + p[1] + ', netw: ' + p[2] + ', fin: ' + p[3] + ', res: ' + p[4] + ', pass: ' + p[5] + ')', hudElement);
  } else {
    var income = getIncome(player, player.passed /*display bonus tile income only when passed*/, state.round);
    var dangerp = income[2] > player.pp - player.p;
    var dangerpw = income[3] > player.pw0 * 2 + player.pw1;

    makeText(px, py + 150, 'income: <B>' + income[0] + 'c, ' + income[1] + 'w, ' +
        dangerColor(dangerp, income[2] + 'p') + ', ' + dangerColor(dangerpw, income[3] + 'pw</b>'), hudElement);
  }

  makeText(px, py + 165, 'octogons: ', hudElement).title = 'the actions with an action token this player has exclusive access to (striked through when already used this round)';
  var actionsText = '';
  function addActionText(octogon) {
    var name = getActionName(octogon);
    var taken = player.octogons[octogon];
    actionsText += (taken ? '<span style="text-decoration: line-through">' + name + '</span>' : name) + ' ';
  }
  if(player.bonustile == T_BON_SPADE_2C) addActionText(A_BONUS_SPADE);
  if(player.bonustile == T_BON_CULT_4C) addActionText(A_BONUS_CULT);
  if(player.favortiles[T_FAV_2W_CULT]) addActionText(A_FAVOR_CULT);
  if(built_sh(player)) {
    if(player.faction == F_CHAOS) addActionText(A_DOUBLE);
    if(player.faction == F_GIANTS) addActionText(A_GIANTS_2SPADE);
    if(player.faction == F_NOMADS) addActionText(A_SANDSTORM);
    if(player.faction == F_SWARMLINGS) addActionText(A_SWARMLINGS_TP);
    if(player.faction == F_AUREN) addActionText(A_AUREN_CULT);
    if(player.faction == F_WITCHES) addActionText(A_WITCHES_D);
  }
  makeText(px + 70, py + 165, actionsText, hudElement);

  if(player.color != I && player.color != N) drawDigCircle(px + 280, py + 20);

  var bonustiles = {};
  if(player.bonustile) bonustiles[player.bonustile] = 1;

  var px2 = 0;
  var py2 = 0;
  var co;

  co = drawTilesMap(px + 320 + px2, py + 10 + py2, bonustiles, 600 - px2, px + 320, null);
  px2 += co[0] + 5;
  if(co[1] != 0 && py2 == 0) { py2 = 80; }

  co = drawTilesMap(px + 320 + px2, py + 10 + py2, player.favortiles, 600 - px2, px + 320, null);
  px2 += co[0] + 5;
  if(co[1] != 0 && py2 == 0) { py2 = 80;}

  co = drawTilesMap(px + 320 + px2, py + 10 + py2, player.towntiles, 600 - px2, px + 320, null);
}

// The board and the live faction state form the primary play surface. Public
// tiles stay below it as a reference shelf instead of competing for attention.
var PLAYER_PANEL_TOP = 530;
var PLAYER_PANEL_HEIGHT = 112;
var GAMEPLAY_BOTTOM = 2030;

// Base-game faction boards, sourced from the individual faction pages linked
// by Gaming Strategy. Keep this map keyed by the game constants so factions
// chosen during setup immediately show the matching physical player board.
var FACTION_BOARD_IMAGES = {};
FACTION_BOARD_IMAGES[F_CHAOS] = 'faction-boards/chaos.jpg';
FACTION_BOARD_IMAGES[F_GIANTS] = 'faction-boards/giants.jpg';
FACTION_BOARD_IMAGES[F_FAKIRS] = 'faction-boards/fakirs.jpg';
FACTION_BOARD_IMAGES[F_NOMADS] = 'faction-boards/nomads.jpg';
FACTION_BOARD_IMAGES[F_HALFLINGS] = 'faction-boards/halflings.jpg';
FACTION_BOARD_IMAGES[F_CULTISTS] = 'faction-boards/cultists.jpg';
FACTION_BOARD_IMAGES[F_ALCHEMISTS] = 'faction-boards/alchemists.jpg';
FACTION_BOARD_IMAGES[F_DARKLINGS] = 'faction-boards/darklings.jpg';
FACTION_BOARD_IMAGES[F_MERMAIDS] = 'faction-boards/mermaids.jpg';
FACTION_BOARD_IMAGES[F_SWARMLINGS] = 'faction-boards/swarmlings.jpg';
FACTION_BOARD_IMAGES[F_AUREN] = 'faction-boards/auren.jpg';
FACTION_BOARD_IMAGES[F_WITCHES] = 'faction-boards/witches.jpg';
FACTION_BOARD_IMAGES[F_ENGINEERS] = 'faction-boards/engineers.jpg';
FACTION_BOARD_IMAGES[F_DWARVES] = 'faction-boards/dwarves.jpg';

function getUserFactionBoardPlayer() {
  for(var i = 0; i < game.players.length; i++) {
    if(game.players[i].human) return game.players[i];
  }
  return null;
}

function drawFactionBoardStatus(parent, player) {
  var travelLabel = player.maxtunnelcarpetdistance > 0 ? 'Range' : 'Shipping';
  var travelValue = player.maxtunnelcarpetdistance > 0 ?
      player.tunnelcarpetdistance + '/' + player.maxtunnelcarpetdistance :
      getShipping(player, false) + '/' + player.maxshipping;
  var diggingValue = player.maxdigging < 0 ? 'N/A' : player.digging + '/' + player.maxdigging;
  var rows = [
    ['D', built_d(player) + '/8'],
    ['TP', built_tp(player) + '/4'],
    ['TE', built_te(player) + '/3'],
    ['SH', built_sh(player) + '/1'],
    ['SA', built_sa(player) + '/1'],
    ['Digging', diggingValue],
    [travelLabel, travelValue]
  ];

  var status = makeSizedDiv(28, 88, 220, 210, parent);
  status.style.boxSizing = 'border-box';
  status.style.padding = '12px 14px';
  status.style.border = '2px solid #6d4a2f';
  status.style.borderRadius = '9px';
  status.style.background = 'linear-gradient(145deg, rgba(255,250,232,.94), rgba(225,197,139,.90))';
  status.style.boxShadow = '0 3px 7px rgba(55,39,24,.22), inset 0 1px 0 rgba(255,255,255,.66)';

  var heading = makeText(0, 0, 'LIVE STATUS', status);
  heading.style.color = '#51351f';
  heading.style.fontSize = '10px';
  heading.style.fontWeight = 'bold';
  heading.style.letterSpacing = '.5px';

  for(var i = 0; i < rows.length; i++) {
    var row = makeSizedDiv(0, 27 + i * 23, 190, 19, status);
    row.style.boxSizing = 'border-box';
    row.style.padding = '3px 4px';
    row.style.borderTop = i ? '1px solid rgba(97,67,38,.22)' : '0';
    row.style.color = '#4c3120';
    row.style.fontSize = '11px';
    row.style.fontWeight = 'bold';
    row.innerHTML = rows[i][0] + ':<span style="float:right">' + rows[i][1] + '</span>';
  }
}

function drawUserFactionBoard(px, py, width) {
  var player = getUserFactionBoardPlayer();
  var hasFaction = player && player.faction != undefined && player.faction != F_NONE;
  var image = player ? FACTION_BOARD_IMAGES[player.faction] : null;
  var factionName = hasFaction ? getFactionName(player.getFaction()).toUpperCase() : 'CHOOSE A FACTION';
  drawTileSectionHeader(px, py, width, 'YOUR FACTION BOARD · ' + factionName);

  var boardPanel = makeSizedDiv(px, py + 23, width, 402, hudElement);
  boardPanel.style.boxSizing = 'border-box';
  boardPanel.style.border = '2px solid #624936';
  boardPanel.style.borderRadius = '12px';
  boardPanel.style.background = 'linear-gradient(145deg, rgba(255,248,225,.94), rgba(221,193,143,.90))';
  boardPanel.style.boxShadow = '0 5px 12px rgba(55,39,24,.20), inset 0 0 0 1px rgba(255,255,255,.60)';

  if(!image) {
    var emptyBoard = makeSizedDiv(0, 0, width, 400, boardPanel);
    emptyBoard.style.display = 'flex';
    emptyBoard.style.alignItems = 'center';
    emptyBoard.style.justifyContent = 'center';
    emptyBoard.style.color = '#684625';
    emptyBoard.style.fontFamily = 'Georgia, "Times New Roman", serif';
    emptyBoard.style.fontSize = '18px';
    emptyBoard.style.fontWeight = 'bold';
    emptyBoard.innerHTML = hasFaction ?
        factionName + ' is an expansion faction; this reference includes the 14 original factions.' :
        'Choose your faction to reveal its board.';
    return;
  }

  var boardImage = makeElement(boardPanel, 'img');
  boardImage.src = image;
  boardImage.alt = getFactionName(player.getFaction()) + ' faction board';
  boardImage.title = getFactionName(player.getFaction()) + ' faction board';
  boardImage.style.position = 'absolute';
  boardImage.style.left = Math.floor((width - 600) / 2) + 'px';
  boardImage.style.top = '7px';
  boardImage.style.width = '600px';
  boardImage.style.height = '386px';
  boardImage.style.objectFit = 'contain';
  boardImage.style.filter = 'drop-shadow(0 3px 4px rgba(55,39,24,.26))';
  drawFactionBoardStatus(boardPanel, player);
}

//if onTileClick not null, added as onclick for the tile elements. Gets the tile as argument.
function drawHud2(players, onTileClickMain) {
  hudElement.innerHTML = '';
  drawBoardWorkspaceSurfaces();
  drawPowerActionRail();
  drawHumanColorWheel();
  var scoreProjection;
  if(state.round == 6) scoreProjection = projectEndGameScores();
  var playerGap = 6;
  var dashboardWidth = Math.floor((GAMEPLAY_WIDTH - 10 - playerGap * (players.length - 1)) / players.length);
  for(var i = 0; i < players.length; i++) {
    drawPlayerPanel(5 + i * (dashboardWidth + playerGap), PLAYER_PANEL_TOP, players[i], scoreProjection, dashboardWidth);
  }

  // Everything below the board flows in one vertical reading order. This
  // prevents the action area, turn plan and reference shelves from competing
  // for the same horizontal band on narrower screens.
  drawHumanUI(5, 660, state.showResourcesPlayer);
  drawCurrentRoundFocus(537, 755, 520);

  // Keep the player's physical board directly above the public scoring
  // reference, mirroring the order in which it is used during play.
  drawUserFactionBoard(5, 840, GAMEPLAY_WIDTH - 10);

  // A single heading covers both related pieces; the final-scoring tile does
  // not repeat its own heading inside the section.
  drawTileSectionHeader(5, 1265, GAMEPLAY_WIDTH - 10, 'ROUND & FINAL SCORING');
  drawTilesArray(5, 1297, game.roundtiles, 450, 5, onTileClickMain);
  drawFinalScoringTile(462, 1297, game.finalscoring);
  drawTileSectionHeader(5, 1400, GAMEPLAY_WIDTH - 10, 'AVAILABLE BONUS TILES');
  drawTilesMap(5, 1431, game.bonustiles, GAMEPLAY_WIDTH - 12, 5, onTileClickMain);
  drawTileSectionHeader(5, 1525, GAMEPLAY_WIDTH - 10, 'TOWN REWARDS');
  drawTilesMap(5, 1566, game.towntiles, GAMEPLAY_WIDTH - 12, 5, onTileClickMain);
  drawTileSectionHeader(5, 1650, GAMEPLAY_WIDTH - 10, 'FAVOR TILES');
  drawFavorTilesGrid(5, 1675, game.favortiles, onTileClickMain);
  drawClaimedTilesLedger(5, 1845, GAMEPLAY_WIDTH - 10, players);

  drawCultTracks(CULT_PANEL_LEFT + 7, TOP_PLAY_CONTENT_Y);
  if(state.type == S_GAME_OVER) drawEndGameScoring(ACTIONPANELX, ACTIONPANELY, 0 /*playerIndex*/);
}

// The terrain sprites remain deliberately unchanged, but the surrounding play
// area now uses the same tabletop and parchment language as the newer dialogs.
// These surfaces sit only in the open areas around the board, so they never
// interfere with existing map click targets.
function drawBoardWorkspaceSurfaces() {
  var powerPanel = makeSizedDiv(3, 43, 82, 474, hudElement);
  powerPanel.style.boxSizing = 'border-box';
  powerPanel.style.border = '2px solid #47335d';
  powerPanel.style.borderRadius = '12px';
  powerPanel.style.background = 'linear-gradient(145deg, rgba(241,232,249,.94), rgba(181,160,203,.94))';
  powerPanel.style.boxShadow = '0 6px 14px rgba(55,39,24,.24), inset 0 0 0 1px rgba(255,255,255,.55)';
  powerPanel.style.pointerEvents = 'none';

  var cultPanelX = CULT_PANEL_LEFT;
  var cultPanel = makeSizedDiv(cultPanelX, 43, 255, 474, hudElement);
  cultPanel.style.boxSizing = 'border-box';
  cultPanel.style.border = '2px solid #624936';
  cultPanel.style.borderRadius = '12px';
  cultPanel.style.background = 'linear-gradient(145deg, rgba(255,247,219,.88), rgba(221,190,133,.88))';
  cultPanel.style.boxShadow = '0 6px 14px rgba(55,39,24,.24), inset 0 0 0 1px rgba(255,255,255,.55)';
  cultPanel.style.pointerEvents = 'none';

  var dashboardPanel = makeSizedDiv(0, 520, GAMEPLAY_WIDTH, 132, hudElement);
  dashboardPanel.style.boxSizing = 'border-box';
  dashboardPanel.style.border = '2px solid #624936';
  dashboardPanel.style.borderRadius = '12px';
  dashboardPanel.style.background = 'linear-gradient(145deg, rgba(255,248,225,.88), rgba(221,193,143,.84))';
  dashboardPanel.style.boxShadow = '0 5px 12px rgba(55,39,24,.18), inset 0 0 0 1px rgba(255,255,255,.55)';
  dashboardPanel.style.pointerEvents = 'none';

  var supplyPanel = makeSizedDiv(0, 830, GAMEPLAY_WIDTH, 1050, hudElement);
  supplyPanel.style.boxSizing = 'border-box';
  supplyPanel.style.border = '2px solid #624936';
  supplyPanel.style.borderRadius = '12px';
  supplyPanel.style.background = 'linear-gradient(145deg, rgba(255,248,225,.82), rgba(221,193,143,.78))';
  supplyPanel.style.boxShadow = '0 6px 14px rgba(55,39,24,.20), inset 0 0 0 1px rgba(255,255,255,.55)';
  supplyPanel.style.pointerEvents = 'none';
}

function getRoundTriggerText(trigger) {
  if(trigger == 'spade') return 'USE A SPADE';
  if(trigger == 'town') return 'FORM A TOWN';
  if(trigger == 'dwelling') return 'BUILD A DWELLING';
  if(trigger == 'stronghold') return 'UPGRADE SH / SA';
  if(trigger == 'tradingpost') return 'UPGRADE A TP';
  if(trigger == 'temple') return 'UPGRADE A TE';
  return trigger.toUpperCase();
}

function getRoundTriggerShortText(trigger) {
  if(trigger == 'spade') return 'SPADE';
  if(trigger == 'town') return 'TOWN';
  if(trigger == 'dwelling') return 'D';
  if(trigger == 'stronghold') return 'SH / SA';
  if(trigger == 'tradingpost') return 'TP';
  if(trigger == 'temple') return 'TE';
  return trigger.toUpperCase();
}

function getRoundRewardText(reward) {
  var names = {coin: 'COIN', worker: 'WORKER', priest: 'PRIEST', power: 'POWER', spade: 'SPADE'};
  return reward.amount + ' ' + names[reward.icon];
}

function getRoundRewardAbbreviation(reward) {
  var names = {coin: 'C', worker: 'W', priest: 'P', power: 'PW', spade: 'SPD'};
  return (reward.amount > 1 ? reward.amount + ' ' : '') + names[reward.icon];
}

function drawCurrentRoundCultFormula(px, py, details) {
  var offset = 0;
  if(details.cult == 'priest') {
    drawTileIcon(px, py, 'priest', hudElement, true);
    offset = 17;
  } else {
    for(var i = 0; i < details.threshold; i++) {
      var pip = makeSizedDiv(px + i * 13, py + 1, 11, 11, hudElement);
      pip.style.boxSizing = 'border-box';
      pip.style.border = '1px solid #5b5142';
      pip.style.borderRadius = '50%';
      pip.style.background = getCultColor(details.cult);
      pip.style.boxShadow = 'inset 0 1px 1px rgba(255,255,255,.62)';
      pip.style.pointerEvents = 'none';
    }
    offset = details.threshold * 13 + 3;
  }

  var arrow = makeSizedDiv(px + offset, py - 1, 12, 15, hudElement);
  styleBonusTileText(arrow, 12, 'bold', '#684625');
  arrow.style.lineHeight = '13px';
  arrow.innerHTML = '&gt;';

  var rewardX = px + offset + 15;
  drawBonusGlyph(rewardX, py, details.reward.icon, hudElement, true);
  var rewardLabel = makeSizedDiv(rewardX + 15, py + 2, 35, 10, hudElement);
  styleBonusTileText(rewardLabel, 8, 'bold', '#53351f');
  rewardLabel.style.textAlign = 'left';
  rewardLabel.innerHTML = getRoundRewardAbbreviation(details.reward);
}

function drawCurrentRoundFocus(px, py, width) {
  var tile = game.roundtiles[state.round];
  var details = getRoundTileDetails(tile);

  var card = makeSizedDiv(px, py, width, 64, hudElement);
  card.style.boxSizing = 'border-box';
  card.style.padding = '7px 10px';
  card.style.border = '3px solid #a98335';
  card.style.borderRadius = '10px';
  card.style.background = 'linear-gradient(135deg, #fff3c7, #d9bb70 55%, #b78e42)';
  card.style.boxShadow = '0 3px 7px rgba(77,55,22,.28), inset 0 0 0 1px rgba(255,250,219,.72)';
  card.title = tileToHelpString(tile, true);

  drawTileSectionHeader(px + 9, py + 6, 205, details ? 'CURRENT ROUND ' + state.round + ' / 6' : 'GAME SETUP');

  if(!details) {
    var setupHint = makeSizedDiv(px + 14, py + 32, width - 28, 18, hudElement);
    setupHint.style.color = '#684625';
    setupHint.style.fontSize = '11px';
    setupHint.style.fontWeight = 'bold';
    setupHint.innerHTML = 'Choose factions and place initial dwellings. Round scoring begins when setup is complete.';
    return;
  }

  var score = makeSizedDiv(px + 14, py + 25, 245, 17, hudElement);
  score.style.color = '#4d3020';
  score.style.fontSize = '14px';
  score.style.fontWeight = 'bold';
  score.innerHTML = getRoundTriggerShortText(details.trigger) + ' &gt; ' + details.vp + ' VP';

  drawCurrentRoundCultFormula(px + 15, py + 44, details);
}

function drawPowerActionRail() {
  var player = getCurrentPlayer();
  var powerActions = [
    {type: A_POWER_BRIDGE, cost: 3, label: 'BRIDGE', reward: '1 BRIDGE', followUp: function() { letClickMapForBridge(1); }},
    {type: A_POWER_1P, cost: 3, label: 'PRIEST', reward: '1 PRIEST'},
    {type: A_POWER_2W, cost: 4, label: 'WORKERS', reward: '2 WORKERS'},
    {type: A_POWER_7C, cost: 4, label: 'COINS', reward: '7 COINS'},
    {type: A_POWER_SPADE, cost: 4, label: 'SPADE', reward: '1 SPADE', followUp: function() { digAndBuildFun(DBM_BUILD, 'click where to dig & build'); }},
    {type: A_POWER_2SPADE, cost: 6, label: 'SPADES', reward: '2 SPADES', followUp: function() { digAndBuildFun(DBM_BUILD, 'click where to dig & build'); }}
  ];

  var heading = drawTileSectionHeader(10, 52, 68, 'POWER');
  heading.style.padding = '2px 1px';
  heading.style.fontSize = '8px';
  heading.style.letterSpacing = '.25px';
  heading.style.textAlign = 'center';

  for(var i = 0; i < powerActions.length; i++) {
    (function(action, index) {
      var used = !!game.octogons[action.type];
      var canUse = !used && state.type == S_ACTION && player && player.human;
      var card = makeSizedDiv(9, 71 + index * 67, 70, 61, hudElement);
      card.style.boxSizing = 'border-box';
      card.style.padding = '5px 3px';
      card.style.border = '2px solid ' + (used ? '#9b7eae' : '#41285d');
      card.style.borderRadius = '7px';
      card.style.background = used ? 'linear-gradient(145deg, #eadcf1, #c9b2d8)' : 'linear-gradient(145deg, #9a78bc, #4e3976)';
      card.style.boxShadow = used ? 'inset 0 1px 1px rgba(255,255,255,.6)' : '0 2px 3px rgba(50,31,75,.28), inset 0 1px 1px rgba(255,255,255,.26)';
      card.style.color = used ? '#70577c' : '#fff9eb';
      card.style.cursor = canUse ? 'pointer' : 'default';
      card.style.fontSize = '8px';
      card.style.fontWeight = 'bold';
      card.style.textAlign = 'center';
      card.style.userSelect = 'none';
      card.title = used ? action.label + ' power action is already taken this round.' : action.cost + ' power: ' + action.reward + '. Click to add it to your turn plan.';
      card.innerHTML = '<div style="font-size:12px;line-height:15px">' + action.cost + ' PW</div><div style="font-size:9px;line-height:12px">' + action.label + '</div>';
      if(used) {
        card.style.textDecoration = 'line-through';
        var cross = makeSizedDiv(13, 20, 44, 2, card);
        cross.style.background = 'rgba(93,65,106,.78)';
        cross.style.transform = 'rotate(-38deg)';
        cross.style.pointerEvents = 'none';
      }
      if(canUse) {
        card.onclick = function() {
          prepareAction(new Action(action.type));
          if(action.followUp) action.followUp();
          else drawHud();
        };
        card.onmouseover = function() { this.style.transform = 'translateY(-2px)'; };
        card.onmouseout = function() { this.style.transform = 'translateY(0)'; };
      }
    })(powerActions[i], i);
  }
}

function drawSharedHeader(px, py, width, text, parent) {
  parent = parent || hudElement;
  var header = makeSizedDiv(px, py, width, 16, parent);
  header.style.boxSizing = 'border-box';
  header.style.padding = '3px 7px';
  header.style.background = 'linear-gradient(90deg, #4e5967, #79899a)';
  header.style.border = '1px solid #35404d';
  header.style.borderRadius = '4px';
  header.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.28)';
  header.style.color = '#fff4d6';
  header.style.fontSize = '9px';
  header.style.fontWeight = 'bold';
  header.style.letterSpacing = '.7px';
  header.style.pointerEvents = 'none';
  header.innerHTML = text;
  return header;
}

function drawTileSectionHeader(px, py, width, text) {
  return drawSharedHeader(px, py, width, text, hudElement);
}

function drawEndGameScoring(px, py) {
  var parent = hudElement;

  var bg = makeSizedDiv(px, py, ACTIONPANELW, ACTIONPANELH, parent);
  bg.style.backgroundColor = '#ffffff';
  bg.style.border = '1px solid black';
  actionEl.innerHTML = '';

  makeText(px + 5, py + 5, '<b>Game over</b> (detailed log is at the bottom of the web page)', parent);
  makeText(px + 5, py + 25, 'Final scores (hover for more details):', parent);

  var sorted = [];
  for(var i = 0; i < game.players.length; i++) {
    sorted[i] = game.players[i];
  }
  sorted.sort(function(a, b) {
    return b.vp - a.vp;
  });

  for(var i = 0; i < sorted.length; i++) {
    var p = sorted[i];
    var text = getFullNameColored(sorted[i]) + ': <b>' + p.vp + '</b>';
    var vptext = makeText(px + 5, py + 40 + 16 * i, text, parent);
    vptext.title = getFullVPDetailsText(sorted[i]);
    vptext.onclick = bind(showGreyDialogAtMouse, getFullVPDetailsText(sorted[i]));
    vptext.style.cursor = 'pointer';
    var vp_game = p.getVPFor('start') + p.getVPFor('round') + p.getVPFor('town') + p.getVPFor('favor') + p.getVPFor('bonus') + p.getVPFor('faction') + p.getVPFor('advance') + p.getVPFor('leech');
    var cultvp = '[' + p.getVPForDetail('fire') + ',' + p.getVPForDetail('water') + ',' + p.getVPForDetail('earth') + ',' + p.getVPForDetail('air') + ']';
    if(cultvp.length < 5) cultvp = p.getVPFor('cult');
    var text2 = ' cult:' + cultvp + ' netw:' + p.getVPFor('network') + ' fin:' + p.getVPFor('final') + ' res:' + p.getVPFor('resources') + ' game:' + vp_game;
    var textel2 = makeText(px + 200, py + 40 + 16 * i, text2, parent);
    textel2.title = getFullVPDetailsText(sorted[i]);
    textel2.onclick = bind(showGreyDialogAtMouse, getFullVPDetailsText(sorted[i]));
    textel2.style.cursor = 'pointer';
  }
}

function makeHtmlTextWithColors(text, fgcolor, bgcolor) {
  return '<span style="color: ' + fgcolor + '; background-color:' + bgcolor + '">' + text + '</span>';
}

//summary near the actions panel so that you don't have to look at other parts of the screen to see your resources etc...
function drawSummary(px, py, playerIndex) {
  var div = makeSizedDiv(px - 5, py, 520 + 5, 90, hudElement);
  div.style.backgroundColor = getLighterColor(getImageColor(game.players[playerIndex].woodcolor), 32);
  div.style.overflow = 'visible';
  try { div.style.whiteSpace = 'no-wrap'; } catch(e) { /*IE8*/};
  var parent = div/*hudElement*/;
  px = 5;
  py = 5;

  makeText(px, py, 'Players: ', parent);
  var playerText = '';

  for(var i = 0; i < game.players.length; i++) {
    var fgcolor;
    var bgcolor;
    var player = game.players[i];
    var imColor = getImageColor(player.woodcolor);
    if(player.passed) {
      bgcolor = getTranslucentColor(imColor, 64);
      fgcolor = getTranslucentColor(getHighContrastColor(imColor), 128);
    } else {
      bgcolor = imColor;
      fgcolor = getHighContrastColor(imColor);
    }
    var name = getFactionCodeName(player.getFaction()) + ' ' + player.vp;
    if(player.index == state.currentPlayer) name += '*';
    if(player.index == state.startPlayer) name += ' [S]';
    playerText += makeHtmlTextWithColors(name, fgcolor, bgcolor) + ' ';
  }
  makeText(px + 60, py, playerText, parent).style.width = '1000px'; //prevetn wrap


  /*makeText(px, py + 16, 'Taken: ', parent).title = 'list of octogon-actions taken this round. Includes the faction specific actions of other players';
  var octotext = '';
  // Public octogons
  for(var i = A_BEGIN + 1; i < A_END; i++) {
    if(game.octogons[i]) octotext += getActionName(i) + ' ';
  }
  // Personal octogons
  for(var i = A_BEGIN + 1; i < A_END; i++) {
    if(game.players[playerIndex].octogons[i]) octotext += getActionName(i) + ' ';
  }
  // Faction octogons of other players
  for(var j = 0; j < game.players.length; j++) {
    if(j == playerIndex) continue;
    for(var i = A_BEGIN + 1; i < A_END; i++) {
      if(isFactionOctogonAction(i) && game.players[j].octogons[i]) octotext += getActionName(i) + ' ';
    }
  }
  makeText(px + 50, py + 16, octotext, parent).style.textDecoration = 'line-through';*/


  var player = game.players[playerIndex];
  makeText(px, py + 16, 'Resources: <b>' +  player.c + ' c, ' + player.w + ' w, ' +
      player.p + '/' + player.pp + ' p, ' +
      '<font color="#909">' + player.pw0 + '/' + player.pw1 + '/' + player.pw2 + ' pw' + '</font></b>', parent);
  makeText(px, py + 32, 'Buildings: <b>' + dangerColor(player.b_d == 0, (8 - player.b_d) + '/8 D') + ', ' +
      dangerColor(player.b_tp == 0, (4 - player.b_tp) + '/4 TP') + ', ' +
      dangerColor(player.b_te == 0, (3 - player.b_te) + '/3 TE') + ', ' +
      (1 - player.b_sh) + '/1 SH, ' + (1 - player.b_sa) + '/1 SA' + '</b>', parent);
  var advancetext = 'dig: ' + player.digging + ', ship: ' + player.shipping;
  if(player.maxtunnelcarpetdistance > 0) advancetext += ', range: ' + player.tunnelcarpetdistance;
  makeText(px, py + 48, 'Advances: <b>' + advancetext + '</b>', parent);
  var income = getIncome(player, player.passed /*display bonus tile income only when passed*/, state.round);
  var dangerp = income[2] > player.pp - player.p;
  var dangerpw = income[3] > player.pw0 * 2 + player.pw1;
  if(state.round != 6) {
    makeText(px, py + 64, 'Income: &nbsp;&nbsp;&nbsp;<b>' + income[0] + ' c, ' + income[1] + ' w, ' +
        dangerColor(dangerp, income[2] + ' p') + ', ' + dangerColor(dangerpw, income[3] + ' pw') + '</b>', parent);
  }
}

function makeExecButton(player, x, y, parent, executButtonFun, title) {
  var execbutton = makeButton(x, y, 'execute', parent, executeButtonFun, title);
  if(player.auxcolor) {
    var execcolor = player.color == O ? O : player.auxcolor;
    execbutton[0].style.backgroundColor = getImageColor(execcolor); //give the execute button the player's faction color
    execbutton[1].style.color = getHighContrastColor(getImageColor(execcolor));
  }
  return execbutton;
}


var ACTIONPANELX = 0;
var ACTIONPANELY = 0;
var ACTIONPANELW = 0;
var ACTIONPANELH = 0;

function drawHumanUI(px, py, playerIndex) {
  var parent = hudElement;
  var player = game.players[playerIndex];

  ACTIONPANELX = px - 5;
  ACTIONPANELY = py - 5;
  ACTIONPANELW = 520;
  ACTIONPANELH = showingNextButtonPanel ? 150 :
      (humanstate == HS_DIG ? 180 : 150);
  var bg = makeSizedDiv(ACTIONPANELX, ACTIONPANELY, ACTIONPANELW, ACTIONPANELH, parent).style.border = '1px solid black';

  // actionEl is a persistent root created with the old side-by-side layout.
  // Anchor the turn plan in the current action row before it is rendered.
  actionEl.style.left = (px + ACTIONPANELW + 12) + 'px';
  actionEl.style.top = (py - 5) + 'px';
  helpEl.style.left = (px + ACTIONPANELW + 12) + 'px';
  helpEl.style.top = (py + 52) + 'px';
  helpEl.style.boxSizing = 'border-box';
  helpEl.style.width = '520px';
  helpEl.style.minHeight = '38px';
  helpEl.style.padding = '11px 10px 7px';
  helpEl.style.background = 'linear-gradient(145deg, #fff8e5, #e6c98e)';
  helpEl.style.border = '2px solid #6d4a2f';
  helpEl.style.borderRadius = '7px';
  helpEl.style.boxShadow = '0 2px 4px rgba(55,35,18,.22), inset 0 1px 0 rgba(255,255,255,.62)';
  helpEl.style.color = '#563920';
  helpEl.style.fontSize = '10px';
  helpEl.style.zIndex = 100;

  if(state.type == S_ACTION && player.human) drawActionPlanSummary(player);
  else {
    actionPlanSummaryElement = null;
    actionEl.innerHTML = '';
    actionEl.style.width = '0';
    actionEl.style.height = '0';
    actionEl.style.background = 'transparent';
    actionEl.style.border = '0';
  }

  if(showingNextButtonPanel) {
    var advancePanel = makeSizedDiv(ACTIONPANELX, ACTIONPANELY, ACTIONPANELW, ACTIONPANELH, hudElement);
    advancePanel.style.boxSizing = 'border-box';
    advancePanel.style.background = 'linear-gradient(135deg, #8d673f, #e7cc91 11%, #fff0c7 58%, #b17b42)';
    advancePanel.style.border = '3px solid #5c402a';
    advancePanel.style.borderRadius = '11px';
    advancePanel.style.boxShadow = '0 4px 9px rgba(41,27,13,.28), inset 0 0 0 2px rgba(255,248,218,.62)';

    var advanceHeading = makeText(ACTIONPANELX + 16, ACTIONPANELY + 12, 'Continue game', hudElement);
    advanceHeading.style.color = '#4b3020';
    advanceHeading.style.fontFamily = 'Georgia, serif';
    advanceHeading.style.fontSize = '17px';
    advanceHeading.style.fontWeight = 'bold';
    var advanceHint = makeText(ACTIONPANELX + 155, ACTIONPANELY + 16, 'Choose how much of the turn sequence to watch.', hudElement);
    advanceHint.style.color = '#725039';
    advanceHint.style.fontSize = '11px';

    var makeAdvanceChoice = function(x, width, label, detail, background, border, click, title) {
      var choice = makeSizedDiv(x, ACTIONPANELY + 41, width, 78, hudElement);
      choice.style.boxSizing = 'border-box';
      choice.style.padding = '16px 7px 8px';
      choice.style.background = background;
      choice.style.border = '2px solid ' + border;
      choice.style.borderRadius = '9px';
      choice.style.boxShadow = '0 2px 4px rgba(46,28,13,.28), inset 0 1px 1px rgba(255,255,255,.28)';
      choice.style.color = '#fffdf0';
      choice.style.cursor = 'pointer';
      choice.style.fontWeight = 'bold';
      choice.style.textAlign = 'center';
      choice.style.userSelect = 'none';
      choice.title = title;
      choice.innerHTML = '<div style="font-size:' + (width > 200 ? '21' : '15') + 'px;line-height:22px">' + label + '</div><div style="font-size:10px;line-height:14px">' + detail + '</div>';
      choice.onclick = click;
      choice.onmouseover = function() { this.style.transform = 'translateY(-2px)'; };
      choice.onmouseout = function() { this.style.transform = 'translateY(0)'; };
      return choice;
    };
    makeAdvanceChoice(ACTIONPANELX + 14, 238, 'NEXT', 'Show the next player',
        'linear-gradient(145deg, #bd643e, #7e3525)', '#5b291d', nextButtonFun, 'Show the next player.');
    makeAdvanceChoice(ACTIONPANELX + 264, 126, 'FAST', 'Until your turn',
        'linear-gradient(145deg, #6a9b8a, #38695c)', '#294e44', fastButtonFun,
        'All AI players take their actions without interruption until it is your turn again.');
    makeAdvanceChoice(ACTIONPANELX + 402, 104, 'FASTEST', 'Keep going',
        'linear-gradient(145deg, #4e8a69, #1d5a43)', '#164634', fastestButtonFun,
        'Continue automatically for the rest of the game. You will no longer see each AI turn.');
  }
  else if(state.type == S_ACTION && humanstate == HS_MAIN && player.human) {
    drawPlayerActions(px, py, playerIndex, parent);
  } else {
    var cx = ACTIONPANELX + ACTIONPANELW / 2;
    var cy = ACTIONPANELY + ACTIONPANELH / 2;
    if(state.type == S_INIT_DWELLING) {
      //draw dwelling to indicate your color
      drawIcon(cx, cy, 0, player.auxcolor, parent);
      drawIcon(cx, cy, B_D, player.woodcolor, parent);
      setHelp('Choose a highlighted ' + getColorName(player.auxcolor) + ' terrain space. Only highlighted spaces are selectable for your starting dwelling.');
      drawInitialDwellingTargetHints(player, parent);
    }
    else if(humanstate == HS_DIG) {
      var ptype = pactions.length > 0 ? pactions[pactions.length - 1].type : A_NONE; //previous action type

      makeText(px + 8, py + 4, 'Choose how to use your available spade(s).', parent).style.fontWeight = 'bold';
      var makeDigChoice = function(x, y, label, active, click, title) {
        var choice = makeSizedDiv(x, y, 150, 31, parent);
        choice.style.boxSizing = 'border-box';
        choice.style.padding = '7px 8px';
        choice.style.background = active ? '#8b5436' : '#f2dfb5';
        choice.style.border = '2px solid ' + (active ? '#4f2c1c' : '#8a6744');
        choice.style.borderRadius = '7px';
        choice.style.boxShadow = '0 2px 3px rgba(54,34,16,.24)';
        choice.style.color = active ? '#fff8df' : '#49311f';
        choice.style.cursor = 'pointer';
        choice.style.fontWeight = 'bold';
        choice.style.fontSize = '12px';
        choice.style.textAlign = 'center';
        choice.style.userSelect = 'none';
        choice.title = title;
        choice.innerHTML = label;
        choice.onclick = click;
        return choice;
      };

      if(state.type != S_ROUND_END_DIG) {
        makeDigChoice(px + 8, py + 27, 'Transform & build', digAndBuildMode == DBM_BUILD,
            function() { digAndBuildMode = DBM_BUILD; drawHud(); },
            'Build a dwelling. First transforms the landscape to your color if needed.');
      }

      if(state.type != S_ROUND_END_DIG || player.faction == F_GIANTS) {
        makeDigChoice(px + 172, py + 27, 'Transform full', digAndBuildMode == DBM_COLOR,
            function() { digAndBuildMode = DBM_COLOR; drawHud(); },
            'Transforms the landscape to your color.');
      }

      if(player.faction != F_GIANTS && ptype != A_SANDSTORM && player.color != O) {
        makeDigChoice(px + 8, py + 68, 'Transform once', digAndBuildMode == DBM_ONE,
            function() { digAndBuildMode = DBM_ONE; drawHud(); },
            'Transforms the landscape one step towards your color.');
        makeDigChoice(px + 172, py + 68, 'Anti-transform', digAndBuildMode == DBM_ANTI,
            function() { digAndBuildMode = DBM_ANTI; drawHud(); },
            'Transforms the landscape in the opposite direction.');
      }

      if(state.type != S_ROUND_END_DIG) {
        makeDigChoice(px + 8, py + 109, 'Cancel', false, function() { clearHumanState(); }, 'Cancel digging.');
      } else {
        makeExecButton(player, px + 410, py + 109, parent, executeButtonFun, 'Execute round bonus digs.');
      }
    }
    else if(humanstate == HS_MAP) {
      drawIcon(cx, cy, 0, player.woodcolor, parent);
      drawActionMapTargetHints(parent);
      var button = makeLinkButton(px, py + 38, 'Cancel map action', parent);
      button.onclick = clearHumanState;
      styleActionFlowControl(button, 'quiet');
    }
    else if(humanstate == HS_CULT) {
      makeText(px, py + 2, 'click on a cult track, right of the map, to continue', parent);
      //TODO: draw something better to indicate cult
      //makeText(cx - 20, cy, 'cult', parent);
      drawOrb(cx - 20, cy, R);
      drawOrb(cx - 5, cy, B);
      drawOrb(cx + 10, cy, U);
      drawOrb(cx + 25, cy, S);
    }
    else if(humanstate == HS_BONUS_TILE) {
      drawTileChoiceModal('bonus', player);
    }
    else if(humanstate == HS_FAVOR_TILE) {
      drawTileChoiceModal('favor', player);
    }
    else if(humanstate == HS_TOWN_TILE) {
      drawTileChoiceModal('town', player);
    }
  }

  // The faction-dashboard row already carries every player's resources,
  // buildings, advances and next income. Keeping the legacy local summary
  // here would duplicate that information and dilute the action area.
}

// A setup-only overlay that makes legal starting locations immediately
// discoverable. It does not handle clicks; the normal map overlay below still
// invokes the rules-backed human callback.
function drawMapTargetMarker(co, parent, borderColor, glowColor) {
  // Match drawTileMapElement exactly: target feedback must share the sprite's
  // bounding box, not an approximated centre point.
  var markerLeft = parseInt(mapElement.style.left) + co[0] - 32;
  var markerTop = parseInt(mapElement.style.top) + co[1] - 64 / 3;
  var marker = makeSizedDiv(markerLeft, markerTop, 64, 64, parent);
  marker.style.boxSizing = 'border-box';
  marker.style.border = '2px solid ' + borderColor;
  marker.style.borderRadius = '4px';
  marker.style.background = 'rgba(255,255,255,.04)';
  marker.style.boxShadow = '0 0 0 1px rgba(61,44,27,.38), 0 0 8px ' + glowColor;
  marker.style.clipPath = 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';
  marker.style.pointerEvents = 'none';

  var dot = makeSizedDiv(markerLeft + 29, markerTop + 29, 6, 6, parent);
  dot.style.boxSizing = 'border-box';
  dot.style.border = '1px solid rgba(61,44,27,.62)';
  dot.style.borderRadius = '50%';
  dot.style.background = borderColor;
  dot.style.boxShadow = '0 0 5px ' + glowColor;
  dot.style.pointerEvents = 'none';
}

function drawInitialDwellingTargetHints(player, parent) {
  for(var y = 0; y < game.bh; y++)
  for(var x = 0; x < game.bw; x++) {
    if(!isInitialDwellingTarget(player, x, y)) continue;
    var co = pixelCo(x, y);
    drawMapTargetMarker(co, parent, '#f5d36e', 'rgba(247,213,112,.72)');
  }
}

// Used for ordinary build and upgrade modes. The associated predicate is set
// by the human controller and deliberately describes only targets that are
// safe to choose; final resource/rule validation still happens on Execute.
function drawActionMapTargetHints(parent) {
  if(!mapActionTargetFun) return;
  for(var y = 0; y < game.bh; y++)
  for(var x = 0; x < game.bw; x++) {
    if(!mapActionTargetFun(x, y)) continue;
    var co = pixelCo(x, y);
    drawMapTargetMarker(co, parent, '#86cfb0', 'rgba(102,192,148,.62)');
  }
}

var actionPlanSummaryElement = null;
var actionPlanTextElement = null;
var actionPlanExecuteButton = null;
var actionPlanClearButton = null;

function updateActionPlanSummary() {
  if(!actionPlanSummaryElement) return;
  // Older action helpers write directly into actionEl. If they do so after a
  // map click, they remove this summary's child controls; rebuild the visual
  // shell before updating it so the automatic-turn status remains available
  // for every path.
  if(!actionPlanTextElement || !actionPlanSummaryElement.contains(actionPlanTextElement) ||
      !actionPlanExecuteButton || !actionPlanSummaryElement.contains(actionPlanExecuteButton)) {
    if(state.type == S_ACTION && getCurrentPlayer() && getCurrentPlayer().human) {
      drawActionPlanSummary(getCurrentPlayer());
    }
    return;
  }
  var plan = pactions.length ? actionsToString(pactions) : 'No actions planned.';
  actionPlanTextElement.innerHTML = '<b>TURN PLAN</b><span style="margin-left:9px">' + plan + '</span>';
  actionPlanSummaryElement.title = pactions.length ? plan : 'No actions planned yet.';

  var hasPlan = pactions.length > 0;
  actionPlanExecuteButton.style.background = hasPlan ? 'linear-gradient(145deg, #53b978, #17643b)' : 'linear-gradient(145deg, #b99c67, #765d3e)';
  actionPlanExecuteButton.style.borderColor = hasPlan ? '#0f4b2b' : '#5a442d';
  actionPlanExecuteButton.style.boxShadow = hasPlan ? '0 3px 5px rgba(18,79,42,.42), inset 0 1px 1px rgba(255,255,255,.24)' : '0 2px 3px rgba(70,49,27,.28), inset 0 1px 1px rgba(255,255,255,.28)';
  actionPlanExecuteButton.style.cursor = 'default';
  actionPlanExecuteButton.style.opacity = '1';
  actionPlanExecuteButton.innerHTML = hasPlan ? 'AUTO-RUNNING' : 'AUTO-RUN';
  actionPlanExecuteButton.title = hasPlan ? 'This action runs as soon as every required choice is complete.' : 'Actions run automatically after you make the required choices.';
  actionPlanExecuteButton.onclick = null;

  actionPlanClearButton.style.opacity = hasPlan ? '1' : '.45';
  actionPlanClearButton.style.cursor = hasPlan ? 'pointer' : 'default';
  actionPlanClearButton.title = hasPlan ? 'Clear every planned action.' : 'There are no planned actions to clear.';
  actionPlanClearButton.onclick = hasPlan ? clearPlannedActions : null;
}

function drawActionPlanSummary(player) {
  actionPlanSummaryElement = actionEl;
  actionEl.innerHTML = '';
  actionEl.style.boxSizing = 'border-box';
  actionEl.style.width = '520px';
  actionEl.style.height = '45px';
  actionEl.style.background = 'linear-gradient(90deg, #3d4a5a, #657286)';
  actionEl.style.border = '2px solid #2e3744';
  actionEl.style.borderRadius = '7px';
  actionEl.style.boxShadow = '0 2px 4px rgba(21, 27, 34, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
  actionEl.style.color = '#f8efd6';
  actionEl.style.fontSize = '12px';

  actionPlanTextElement = makeSizedDiv(9, 12, 223, 20, actionEl);
  actionPlanTextElement.style.overflow = 'hidden';
  actionPlanTextElement.style.whiteSpace = 'nowrap';
  actionPlanTextElement.style.textOverflow = 'ellipsis';

  actionPlanClearButton = makeSizedDiv(238, 4, 112, 35, actionEl);
  actionPlanClearButton.style.boxSizing = 'border-box';
  actionPlanClearButton.style.padding = '10px 3px';
  actionPlanClearButton.style.background = 'linear-gradient(145deg, #d97761, #913f36)';
  actionPlanClearButton.style.border = '1px solid #6c2c27';
  actionPlanClearButton.style.borderRadius = '5px';
  actionPlanClearButton.style.color = '#fff4dc';
  actionPlanClearButton.style.fontSize = '9px';
  actionPlanClearButton.style.fontWeight = 'bold';
  actionPlanClearButton.style.textAlign = 'center';
  actionPlanClearButton.style.userSelect = 'none';
  actionPlanClearButton.innerHTML = 'CLEAR PLAN';

  actionPlanExecuteButton = makeSizedDiv(357, 4, 154, 35, actionEl);
  actionPlanExecuteButton.style.boxSizing = 'border-box';
  actionPlanExecuteButton.style.padding = '3px';
  actionPlanExecuteButton.style.border = '2px solid #0f4b2b';
  actionPlanExecuteButton.style.borderRadius = '6px';
  actionPlanExecuteButton.style.color = '#fffdf0';
  actionPlanExecuteButton.style.fontSize = '10px';
  actionPlanExecuteButton.style.fontWeight = 'bold';
  actionPlanExecuteButton.style.textAlign = 'center';
  actionPlanExecuteButton.style.userSelect = 'none';
  updateActionPlanSummary();
}

function styleActionFlowControl(button, tone) {
  button.style.boxSizing = 'border-box';
  button.style.minHeight = '15px';
  button.style.padding = '1px 3px';
  button.style.border = '1px solid ' + (tone == 'quiet' ? '#7c6a54' : '#7c5733');
  button.style.borderRadius = '3px';
  button.style.background = tone == 'quiet' ? '#eee5d5' : 'linear-gradient(#fff1c6, #dfb66f)';
  button.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.7), 0 1px 1px rgba(67,43,21,.18)';
  button.style.color = tone == 'quiet' ? '#544633' : '#4a2e18';
  button.style.fontSize = '10px';
  button.style.fontWeight = 'bold';
  button.style.lineHeight = '11px';
  button.style.textDecoration = 'none';
}

function drawActionSectionLabel(px, py, text, parent) {
  return drawSharedHeader(px, py, 84, text, parent);
}

function drawActionPanelFrame(px, py, parent, height, width) {
  height = height || 145;
  width = width || 405;
  var frame = makeSizedDiv(px, py, width, height, parent);
  frame.style.boxSizing = 'border-box';
  frame.style.padding = '3px';
  frame.style.background = 'linear-gradient(145deg, #e9d1a1, #f8efd6 45%, #cda976)';
  frame.style.border = '2px solid #765334';
  frame.style.borderRadius = '8px';
  frame.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,.6)';
  for(var row = 0; row < Math.floor((height - 4) / 16); row++) {
    var stripe = makeSizedDiv(px + 4, py + 2 + row * 16, width - 8, 14, parent);
    stripe.style.background = row % 2 ? 'rgba(138,95,51,.09)' : 'rgba(255,255,255,.20)';
    stripe.style.pointerEvents = 'none';
  }
}

// This only controls the action-panel presentation. It is intentionally
// separate from the game state so opening or closing a drawer can never alter
// a pending action, score, or AI behaviour.
var actionDrawer = '';

function drawPowerActionDrawer(px, py, player, parent) {
  drawActionPanelFrame(px - 4, py - 4, parent, 150);

  drawSharedHeader(px + 7, py + 5, 116, 'POWER ACTIONS', parent);
  var subtitle = makeText(px + 130, py + 9, 'Choose one available octagon action.', parent);
  subtitle.style.color = '#70513c';
  subtitle.style.fontSize = '10px';

  var back = makeSizedDiv(px + 310, py + 4, 82, 24, parent);
  back.style.boxSizing = 'border-box';
  back.style.padding = '5px';
  back.style.background = '#f3e1b9';
  back.style.border = '1px solid #795838';
  back.style.borderRadius = '5px';
  back.style.color = '#4f3320';
  back.style.cursor = 'pointer';
  back.style.fontSize = '11px';
  back.style.fontWeight = 'bold';
  back.style.textAlign = 'center';
  back.style.userSelect = 'none';
  back.innerHTML = 'BACK';
  back.title = 'Return to the main action list.';
  back.onclick = function() { actionDrawer = ''; drawHud(); };

  function selectPowerAction(type, followUp) {
    actionDrawer = '';
    prepareAction(new Action(type));
    if(followUp) followUp();
    else drawHud();
  }

  function addPowerCard(index, type, cost, reward, title, followUp) {
    var available = player.getFaction().canTakeAction(player, type, game);
    var column = index % 2;
    var row = Math.floor(index / 2);
    var card = makeSizedDiv(px + 8 + column * 195, py + 31 + row * 38, 187, 36, parent);
    card.style.boxSizing = 'border-box';
    card.style.padding = '3px 7px';
    card.style.background = available ? 'linear-gradient(145deg, #8563aa, #4e3976)' : 'linear-gradient(145deg, #d6c9ba, #a99b8f)';
    card.style.border = '2px solid ' + (available ? '#392656' : '#827569');
    card.style.borderRadius = '7px';
    card.style.boxShadow = available ? '0 2px 4px rgba(50,31,75,.3), inset 0 1px 1px rgba(255,255,255,.22)' : 'inset 0 1px 1px rgba(255,255,255,.3)';
    card.style.color = available ? '#fff9e9' : '#51483f';
    card.style.cursor = available ? 'pointer' : 'default';
    card.style.userSelect = 'none';
    card.title = available ? title : title + ' (not currently available).';
    card.innerHTML = '<b style="font-size:12px">' + cost + ' POWER</b><span style="font-size:12px"> &rarr; ' + reward + '</span>' +
        '<div style="font-size:8px;line-height:10px">' + (available ? 'TAKE ACTION' : 'UNAVAILABLE') + '</div>';
    if(available) {
      card.onclick = function() { selectPowerAction(type, followUp); };
      card.onmouseover = function() { this.style.transform = 'translateY(-2px)'; };
      card.onmouseout = function() { this.style.transform = 'translateY(0)'; };
    }
  }

  addPowerCard(0, A_POWER_BRIDGE, 3, 'Bridge', 'Spend 3 power to build a bridge.', function() { letClickMapForBridge(1); });
  addPowerCard(1, A_POWER_1P, 3, '1 priest', 'Spend 3 power to gain one priest.');
  addPowerCard(2, A_POWER_2W, 4, '2 workers', 'Spend 4 power to gain two workers.');
  addPowerCard(3, A_POWER_7C, 4, '7 coins', 'Spend 4 power to gain seven coins.');
  addPowerCard(4, A_POWER_SPADE, 4, '1 spade', 'Spend 4 power to gain one spade.', function() {
    if(player.getActionIncome(A_POWER_SPADE)[R_SPADE]) digAndBuildFun(DBM_BUILD, 'click where to dig & build');
  });
  addPowerCard(5, A_POWER_2SPADE, 6, '2 spades', 'Spend 6 power to gain two spades.', function() {
    if(player.getActionIncome(A_POWER_2SPADE)[R_SPADE]) digAndBuildFun(DBM_BUILD, 'click where to dig & build');
  });
}

function drawActionDrawer(px, py, titleText, subtitleText, cards, parent, keepOpen) {
  drawActionPanelFrame(px - 4, py - 4, parent, 150);
  drawSharedHeader(px + 7, py + 5, 116, titleText.toUpperCase(), parent);
  var subtitle = makeText(px + 130, py + 9, subtitleText, parent);
  subtitle.style.color = '#70513c';
  subtitle.style.fontSize = '10px';
  var back = makeSizedDiv(px + 310, py + 4, 82, 24, parent);
  back.style.boxSizing = 'border-box';
  back.style.padding = '5px';
  back.style.background = '#f3e1b9';
  back.style.border = '1px solid #795838';
  back.style.borderRadius = '5px';
  back.style.color = '#4f3320';
  back.style.cursor = 'pointer';
  back.style.fontSize = '11px';
  back.style.fontWeight = 'bold';
  back.style.textAlign = 'center';
  back.style.userSelect = 'none';
  back.innerHTML = keepOpen ? 'DONE' : 'BACK';
  back.title = keepOpen ? 'Return to the main action categories when your conversions are ready.' : 'Return to the main action categories.';
  back.onclick = function() { actionDrawer = ''; drawHud(); };

  for(var i = 0; i < cards.length; i++) {
    var cardInfo = cards[i];
    var column = i % 2;
    var row = Math.floor(i / 2);
    var card = makeSizedDiv(px + 8 + column * 195, py + 31 + row * 38, 187, 36, parent);
    card.style.boxSizing = 'border-box';
    card.style.padding = '3px 7px';
    card.style.background = cardInfo.available ? 'linear-gradient(145deg, #8d6ab2, #513a79)' : 'linear-gradient(145deg, #d6c9ba, #a99b8f)';
    card.style.border = '2px solid ' + (cardInfo.available ? '#392656' : '#827569');
    card.style.borderRadius = '7px';
    card.style.boxShadow = cardInfo.available ? '0 2px 4px rgba(50,31,75,.3), inset 0 1px 1px rgba(255,255,255,.22)' : 'inset 0 1px 1px rgba(255,255,255,.3)';
    card.style.color = cardInfo.available ? '#fff9e9' : '#51483f';
    card.style.cursor = cardInfo.available ? 'pointer' : 'default';
    card.style.userSelect = 'none';
    card.style.textAlign = 'left';
    card.title = cardInfo.title + (cardInfo.available ? '' : ' (not currently available).');
    card.innerHTML = '<b style="font-size:11px">' + cardInfo.label + '</b><div style="font-size:8px;line-height:10px">' + cardInfo.detail + '</div>';
    if(cardInfo.available) {
      card.onclick = (function(info) { return function() {
        // Conversions are commonly repeated several times in one planned
        // turn. Leave that drawer in place so successive taps stay fast.
        if(!keepOpen) actionDrawer = '';
        info.click();
      }; })(cardInfo);
      card.onmouseover = function() { this.style.transform = 'translateY(-2px)'; };
      card.onmouseout = function() { this.style.transform = 'translateY(0)'; };
    }
  }
}

function makeActionCategoryButton(px, py, label, drawer, available, title, parent) {
  var button = makeSizedDiv(px, py, 303, 14, parent);
  button.style.boxSizing = 'border-box';
  button.style.padding = '1px 7px';
  button.style.background = available ? 'linear-gradient(145deg, #ead9ab, #c49354)' : 'linear-gradient(145deg, #d6c9ba, #a99b8f)';
  button.style.border = '1px solid ' + (available ? '#755133' : '#827569');
  button.style.borderRadius = '4px';
  button.style.color = available ? '#4d3120' : '#51483f';
  button.style.cursor = available ? 'pointer' : 'default';
  button.style.fontSize = '10px';
  button.style.fontWeight = 'bold';
  button.style.textAlign = 'center';
  button.style.userSelect = 'none';
  button.title = title;
  button.innerHTML = label;
  if(available) button.onclick = function() { actionDrawer = drawer; drawHud(); };
  return button;
}

function makeActionGridButton(px, py, width, label, detail, drawer, available, tone, title, parent, click) {
  var button = makeSizedDiv(px, py, width, 25, parent);
  button.style.boxSizing = 'border-box';
  button.style.padding = '4px 8px';
  button.style.background = available ? tone.background : 'linear-gradient(145deg, #d6c9ba, #a99b8f)';
  button.style.border = '2px solid ' + (available ? tone.border : '#827569');
  button.style.borderRadius = '6px';
  button.style.boxShadow = available ? '0 2px 3px rgba(44,30,18,.22), inset 0 1px 1px rgba(255,255,255,.23)' : 'inset 0 1px 1px rgba(255,255,255,.3)';
  button.style.color = available ? '#fff9e9' : '#51483f';
  button.style.cursor = available ? 'pointer' : 'default';
  button.style.fontSize = '12px';
  button.style.fontWeight = 'bold';
  button.style.textAlign = 'left';
  button.style.userSelect = 'none';
  button.title = title + (available ? '' : ' (not currently available).');
  button.innerHTML = label + '<span style="float:right;font-size:9px;font-weight:normal;opacity:.88">' + detail + '</span>';
  if(available) {
    button.onclick = click || function() { actionDrawer = drawer; drawHud(); };
    button.onmouseover = function() { this.style.transform = 'translateY(-1px)'; };
    button.onmouseout = function() { this.style.transform = 'translateY(0)'; };
  }
  return button;
}

function beginBuildDwellingAction(player) {
  setMapActionTargets('Highlighted spaces are reachable, empty terrain of your color.', function(x, y) {
    if(player.b_d <= 0 || isOccupied(x, y) || !canBuildOn(player, x, y)) return false;
    if(player.transformed && !player.transformcoset[arCo(x, y)]) return false;
    return inReach(player, x, y, false) || onlyReachableThroughFactionSpecial(player, x, y);
  });
  queueHumanState(HS_MAP, 'click where to build dwelling', function(x, y) {
    clearHumanState();
    var action = new Action(A_BUILD);
    action.co = [x, y];
    prepareAction(action);
  });
}

function beginCultAction(type, helpText) {
  queueHumanState(HS_CULT, helpText, function(cult) {
    clearHumanState();
    var action = new Action(type);
    action.cult = cult;
    prepareAction(action);
  });
}

function getSpecialActionCards(player) {
  var cards = [];
  if(player.bonustile == T_BON_SPADE_2C && !player.octogons[A_BONUS_SPADE]) cards.push({label: 'BONUS SPADE', detail: 'Use the bonus-tile dig action', available: true, title: 'Use your bonus spade action.', click: function() { prepareAction(new Action(A_BONUS_SPADE)); if(player.getActionIncome(A_BONUS_SPADE)[R_SPADE]) digAndBuildFun(DBM_BUILD, 'click where to dig & build'); }});
  if(player.bonustile == T_BON_CULT_4C && !player.octogons[A_BONUS_CULT]) cards.push({label: 'BONUS CULT', detail: 'Use the bonus-tile cult action', available: true, title: 'Use your bonus cult action.', click: function() { beginCultAction(A_BONUS_CULT, 'click on which cult track to increase'); }});
  if(player.favortiles[T_FAV_2W_CULT] && !player.octogons[A_FAVOR_CULT]) cards.push({label: 'FAVOR CULT', detail: 'Use the favor-tile cult action', available: true, title: 'Use your favor cult action.', click: function() { beginCultAction(A_FAVOR_CULT, 'click on which cult track to increase'); }});
  if(player.faction == F_CHAOS && player.b_sh == 0 && !player.octogons[A_DOUBLE]) cards.push({label: 'CHAOS DOUBLE', detail: 'Use the Chaos Magicians action', available: true, title: 'Use the Chaos Magicians faction action.', click: function() { prepareAction(new Action(A_DOUBLE)); drawHud(); }});
  if(player.faction == F_GIANTS && player.b_sh == 0 && !player.octogons[A_GIANTS_2SPADE]) cards.push({label: 'GIANTS SPADE', detail: 'Use the Giants faction dig', available: true, title: 'Use the Giants faction action.', click: function() { prepareAction(new Action(A_GIANTS_2SPADE)); if(player.getActionIncome(A_GIANTS_2SPADE)[R_SPADE]) digAndBuildFun(DBM_BUILD, 'click where to dig & build'); }});
  if(player.faction == F_NOMADS && player.b_sh == 0 && !player.octogons[A_SANDSTORM]) cards.push({label: 'SANDSTORM', detail: 'Use the Nomads faction action', available: true, title: 'Use the Nomads faction action.', click: function() { prepareAction(new Action(A_SANDSTORM)); digAndBuildFun(DBM_BUILD, 'click where to sandstorm & build'); }});
  if(player.faction == F_ALCHEMISTS) cards.push({label: 'ALCHEMIST COIN', detail: 'Convert 1 VP to 1 coin', available: true, title: 'Use the Alchemists conversion.', click: function() { prepareAction(new Action(A_CONVERT_1VP_1C)); drawHud(); }});
  if(player.faction == F_MERMAIDS) cards.push({label: 'CONNECT WATER', detail: 'Form a town through a water tile', available: true, title: 'Use the Mermaids faction action.', click: function() { queueHumanState(HS_MAP, 'click where to form water town', function(x, y) { clearHumanState(); if(getWorld(x, y) != I) return; var action = new Action(A_CONNECT_WATER_TOWN); action.co = [x, y]; prepareAction(action); }); }});
  if(player.faction == F_AUREN && player.b_sh == 0 && !player.octogons[A_AUREN_CULT]) cards.push({label: 'AUREN CULT', detail: 'Advance a cult track by 2', available: true, title: 'Use the Auren faction action.', click: function() { beginCultAction(A_AUREN_CULT, 'click on which cult track to increase'); }});
  if(player.faction == F_SWARMLINGS && player.b_sh == 0 && !player.octogons[A_SWARMLINGS_TP]) cards.push({label: 'SWARMLING UPGRADE', detail: 'Upgrade a dwelling to a trading post', available: true, title: 'Use the Swarmlings faction action.', click: function() { queueHumanState(HS_MAP, 'click dwelling to upgrade', function(x, y) { clearHumanState(); var action = new Action(A_SWARMLINGS_TP); action.co = [x, y]; prepareAction(action); }); }});
  if(player.faction == F_WITCHES && player.b_sh == 0 && !player.octogons[A_WITCHES_D]) cards.push({label: 'WITCHES DWELLING', detail: 'Build the Witches dwelling', available: true, title: 'Use the Witches faction action.', click: function() { queueHumanState(HS_MAP, 'click where to fly and build free dwelling', function(x, y) { clearHumanState(); var action = new Action(A_WITCHES_D); action.co = [x, y]; prepareAction(action); }); }});
  if(player.faction == F_ENGINEERS) cards.push({label: 'ENGINEERS BRIDGE', detail: 'Spend workers to build a bridge', available: true, title: 'Use the Engineers faction action.', click: function() { prepareAction(new Action(A_ENGINEERS_BRIDGE)); letClickMapForBridge(1); }});
  if(player.getFaction().canTakeAction(player, A_SHIFT, game)) cards.push({label: 'SHIFT TERRAIN', detail: Texts.shift1title(), available: true, title: Texts.shift1title(), click: function() { chooseActionColor(new Action(A_SHIFT)); }});
  if(player.getFaction().canTakeAction(player, A_SHIFT2, game)) cards.push({label: 'SHIFT TWICE', detail: Texts.shift2title(), available: true, title: Texts.shift2title(), click: function() { chooseActionColor(new Action(A_SHIFT2)); }});
  return cards;
}

function drawPlayerActions(px, py, playerIndex, parent /*parent DOM element*/) {
  var player = game.players[playerIndex];
  var actionControlStart = parent.children.length;
  if(actionDrawer == 'power') {
    drawPowerActionDrawer(px, py, player, parent);
    return;
  }
  if(actionDrawer == 'convert') {
    drawActionDrawer(px, py, 'Conversions', 'Stays open for repeated taps.', [
      {label: 'BURN POWER', detail: 'Move bowl II power to bowl III', available: true, title: 'Burn one power.', click: function() { prepareAction(new Action(A_BURN)); drawHud(); }},
      {label: '1 POWER → 1 COIN', detail: 'Spend 1 power for 1 coin', available: true, title: 'Convert power to a coin.', click: function() { prepareAction(new Action(A_CONVERT_1PW_1C)); drawHud(); }},
      {label: '3 POWER → 1 WORKER', detail: 'Spend 3 power for 1 worker', available: true, title: 'Convert power to a worker.', click: function() { prepareAction(new Action(A_CONVERT_3PW_1W)); drawHud(); }},
      {label: '5 POWER → 1 PRIEST', detail: 'Spend 5 power for 1 priest', available: true, title: 'Convert power to a priest.', click: function() { prepareAction(new Action(A_CONVERT_5PW_1P)); drawHud(); }},
      {label: 'PRIEST → WORKER', detail: 'Convert 1 priest to 1 worker', available: true, title: 'Convert priest to worker.', click: function() { prepareAction(new Action(A_CONVERT_1P_1W)); drawHud(); }},
      {label: 'WORKER → COIN', detail: 'Convert 1 worker to 1 coin', available: true, title: 'Convert worker to coin.', click: function() { prepareAction(new Action(A_CONVERT_1W_1C)); drawHud(); }}
    ], parent, true);
    return;
  }
  if(actionDrawer == 'priest') {
    var autoCult = function() {
      queueHumanState(HS_CULT, 'choose which cult track to send the priest to', function(cult) {
        clearHumanState();
        var action = new Action(getAutoSendPriestCultAction(player, cult));
        action.cult = cult;
        prepareAction(action);
      });
    };
    drawActionDrawer(px, py, 'Priest & cult', 'Choose how to send a priest.', [
      {label: 'AUTO CULT', detail: 'Use the highest free cult space', available: true, title: 'Send a priest to the highest free value.', click: autoCult},
      {label: 'CULT 1', detail: 'Send a priest to a 1-step space', available: true, title: 'Choose a 1-step cult space.', click: function() { beginCultAction(A_CULT_PRIEST1, 'choose which cult track to send the priest to'); }},
      {label: 'CULT 2', detail: 'Send a priest to a 2-step space', available: true, title: 'Choose a 2-step cult space.', click: function() { beginCultAction(A_CULT_PRIEST2, 'choose which cult track to send the priest to'); }},
      {label: 'CULT 3', detail: 'Send a priest to a 3-step space', available: true, title: 'Choose a 3-step cult space.', click: function() { beginCultAction(A_CULT_PRIEST3, 'choose which cult track to send the priest to'); }}
    ], parent);
    return;
  }
  if(actionDrawer == 'build') {
    drawActionDrawer(px, py, 'Build & dig', 'The board stays visible for your target choice.', [
      {label: 'DIG & BUILD', detail: 'Transform terrain, then build', available: true, title: 'Dig on terrain and build.', click: function() { digAndBuildFun(DBM_BUILD, 'click where to dig & build'); }},
      {label: 'TRANSFORM', detail: 'Choose another terrain transformation', available: true, title: 'Transform terrain without defaulting to build.', click: function() { digAndBuildFun(digAndBuildMode == DBM_BUILD ? DBM_COLOR : digAndBuildMode, 'click where to dig'); }},
      {label: 'BUILD DWELLING', detail: 'Build on terrain of your colour', available: true, title: 'Build a dwelling on a reachable terrain of your colour.', click: function() { beginBuildDwellingAction(player); }}
    ], parent);
    return;
  }
  if(actionDrawer == 'upgrade') {
    drawActionDrawer(px, py, 'Upgrade', 'Tap a building; choose a destination only when needed.', [
      {label: 'CHOOSE BUILDING', detail: 'Tap a highlighted building on the map', available: true, title: 'Choose a building to upgrade.', click: upgradeBuildingFun}
    ], parent);
    return;
  }
  if(actionDrawer == 'advance') {
    drawActionDrawer(px, py, 'Advance', 'Increase an available navigation track.', [
      {label: 'ADVANCE DIGGING', detail: 'Improve your digging level', available: player.digging < player.maxdigging, title: 'Advance the digging track.', click: function() { prepareAction(new Action(A_ADV_DIG)); drawHud(); }},
      {label: 'ADVANCE SHIPPING', detail: 'Improve your shipping level', available: player.shipping < player.maxshipping, title: 'Advance the shipping track.', click: function() { prepareAction(new Action(A_ADV_SHIP)); drawHud(); }}
    ], parent);
    return;
  }
  if(actionDrawer == 'special') {
    drawActionDrawer(px, py, 'Special actions', 'Actions from your tiles and faction.', getSpecialActionCards(player), parent);
    return;
  }
  if(actionDrawer == 'tile') {
    var tileCards = [];
    if(player.bonustile == T_BON_SPADE_2C && !player.octogons[A_BONUS_SPADE]) tileCards.push({label: 'BONUS SPADE', detail: 'Use the bonus-tile dig action', available: true, title: 'Use your bonus spade action.', click: function() { prepareAction(new Action(A_BONUS_SPADE)); if(player.getActionIncome(A_BONUS_SPADE)[R_SPADE]) digAndBuildFun(DBM_BUILD, 'click where to dig & build'); }});
    if(player.bonustile == T_BON_CULT_4C && !player.octogons[A_BONUS_CULT]) tileCards.push({label: 'BONUS CULT', detail: 'Use the bonus-tile cult action', available: true, title: 'Use your bonus cult action.', click: function() { beginCultAction(A_BONUS_CULT, 'click on which cult track to increase'); }});
    if(player.favortiles[T_FAV_2W_CULT] && !player.octogons[A_FAVOR_CULT]) tileCards.push({label: 'FAVOR CULT', detail: 'Use the favor-tile cult action', available: true, title: 'Use your favor cult action.', click: function() { beginCultAction(A_FAVOR_CULT, 'click on which cult track to increase'); }});
    drawActionDrawer(px, py, 'Tile actions', 'Use an action printed on one of your tiles.', tileCards, parent);
    return;
  }
  drawActionPanelFrame(px - 4, py - 4, parent, 150, 520);

  //an action that doesn't require coordinates or other parameters
  function addSimpleActionButton(px, py, name, actiontype) {
    var button = makeLinkButton(px, py, name, parent);
    var action = new Action(actiontype);
    button.onclick = function() {
      prepareAction(action);
      //drawMap();
      //drawHud();
    };
    return button;
  }

  var button;

  var availablePowerActions = 0;
  var powerTypes = [A_POWER_BRIDGE, A_POWER_1P, A_POWER_2W, A_POWER_7C, A_POWER_SPADE, A_POWER_2SPADE];
  for(var powerIndex = 0; powerIndex < powerTypes.length; powerIndex++) {
    if(player.getFaction().canTakeAction(player, powerTypes[powerIndex], game)) availablePowerActions++;
  }
  drawSharedHeader(px + 7, py + 5, 150, 'CHOOSE AN ACTION', parent);
  var hint = makeText(px + 165, py + 8, 'Tap a category, then choose its specific action.', parent);
  hint.style.color = '#70513c';
  hint.style.fontSize = '10px';

  var compactRowsY = py + 27;
  var hasAdvance = player.digging < player.maxdigging || player.shipping < player.maxshipping;
  var specialCards = getSpecialActionCards(player);
  var tones = {
    power: {background: 'linear-gradient(145deg, #9474b7, #54407b)', border: '#3d2c59'},
    build: {background: 'linear-gradient(145deg, #b77a4d, #78452d)', border: '#58301f'},
    upgrade: {background: 'linear-gradient(145deg, #4d91a8, #2e6076)', border: '#23495a'},
    cult: {background: 'linear-gradient(145deg, #9c7650, #64462d)', border: '#4c331f'},
    convert: {background: 'linear-gradient(145deg, #7f8b76, #505d4a)', border: '#3d4839'},
    advance: {background: 'linear-gradient(145deg, #4d899a, #2c5d6e)', border: '#214653'},
    special: {background: 'linear-gradient(145deg, #a36b75, #71434d)', border: '#542f38'},
    pass: {background: 'linear-gradient(145deg, #c55c4e, #86332e)', border: '#65231f'}
  };
  var columnWidth = 244;
  makeActionGridButton(px + 8, compactRowsY, columnWidth, 'POWER ACTIONS', availablePowerActions + ' ready', 'power', true, tones.power,
      'Choose a power action. ' + availablePowerActions + ' currently available.', parent);
  makeActionGridButton(px + 264, compactRowsY, columnWidth, 'BUILD & DIG', 'map action', 'build', true, tones.build,
      'Choose a build or terrain transformation action.', parent);
  makeActionGridButton(px + 8, compactRowsY + 29, columnWidth, 'UPGRADE', 'tap building', '', true, tones.upgrade,
      'Tap a highlighted building. Choose its destination only when there is more than one.', parent, upgradeBuildingFun);
  makeActionGridButton(px + 264, compactRowsY + 29, columnWidth, 'PRIEST & CULT', 'cult tracks', 'priest', true, tones.cult,
      'Choose how to send a priest to a cult track.', parent);
  makeActionGridButton(px + 8, compactRowsY + 58, columnWidth, 'CONVERSIONS', 'resources', 'convert', true, tones.convert,
      'Choose a resource conversion.', parent);
  makeActionGridButton(px + 264, compactRowsY + 58, columnWidth, 'ADVANCE', 'dig / ship', 'advance', hasAdvance, tones.advance,
      'Advance digging or shipping.', parent);
  makeActionGridButton(px + 8, compactRowsY + 87, columnWidth, 'SPECIAL ACTIONS', specialCards.length + ' ready', 'special', specialCards.length > 0, tones.special,
      'Choose an action from your tiles or faction.', parent);
  var passButton = makeActionGridButton(px + 264, compactRowsY + 87, columnWidth, 'PASS', 'end your turn', '', true, tones.pass,
      'Pass and choose your next bonus tile.', parent);
  passButton.onclick = function() { prepareAction(new Action(A_PASS)); };
  return;

  drawActionSectionLabel(px, compactRowsY, 'CONVERT', parent);
  addSimpleActionButton(px + 90, compactRowsY, 'burn', A_BURN).title = 'sacrifice power from second bowl to get one in your main bowl';
  addSimpleActionButton(px+130, compactRowsY, '1pw->c', A_CONVERT_1PW_1C);
  addSimpleActionButton(px+188, compactRowsY, '3pw->w', A_CONVERT_3PW_1W);
  addSimpleActionButton(px+247, compactRowsY, '5pw->p', A_CONVERT_5PW_1P);
  addSimpleActionButton(px+306, compactRowsY, 'p->w', A_CONVERT_1P_1W);
  addSimpleActionButton(px+348, compactRowsY, 'w->c', A_CONVERT_1W_1C);

  drawActionSectionLabel(px, compactRowsY + 16, 'PRIEST', parent);

  var sendPriestFun = function(type) {
    var fun = function(cult) {
      clearHumanState();
      var action = new Action(type);
      action.cult = cult;
      prepareAction(action);
    };
    queueHumanState(HS_CULT, 'choose which cult track to send the priest to', fun);
  };
  var sendPriestAutoFun = function(type) {
    var fun = function(cult) {
      clearHumanState();
      var type = getAutoSendPriestCultAction(player, cult);
      var action = new Action(type);
      action.cult = cult;
      prepareAction(action);
    };
    queueHumanState(HS_CULT, 'choose which cult track to send the priest to', fun);
  };

  var priestbutton = makeLinkButton(px + 90, compactRowsY + 16, 'cult', parent);
  priestbutton.onclick = sendPriestAutoFun;
  priestbutton.title = 'send priest to highest free value on a cult track';
  var priest1button = makeLinkButton(px + 140, compactRowsY + 16, getActionName(A_CULT_PRIEST1), parent);
  priest1button.onclick = bind(sendPriestFun, A_CULT_PRIEST1);
  var priest2button = makeLinkButton(px + 190, compactRowsY + 16, getActionName(A_CULT_PRIEST2), parent);
  priest2button.onclick = bind(sendPriestFun, A_CULT_PRIEST2);
  var priest3button = makeLinkButton(px + 240, compactRowsY + 16, getActionName(A_CULT_PRIEST3), parent);
  priest3button.onclick = bind(sendPriestFun, A_CULT_PRIEST3);

  drawActionSectionLabel(px, compactRowsY + 32, 'BUILD / DIG', parent);

  function addDigButton(px, py, text, num, type) {
    var digbutton = makeLinkButton(px, py, text, parent);
    digbutton.onclick = function() {
      prepareAction(new Action(type));
      var player = getCurrentPlayer();
      if(player.getActionIncome(type)[R_SPADE]) digAndBuildFun(DBM_BUILD, 'click where to dig & build');
    };
    return digbutton;
  }
  var build2button = makeLinkButton(px + 90, compactRowsY + 32, 'dig&build', parent);
  build2button.title = 'Dig on terrain and build, or other terrain transformation actions.';
  build2button.style.color = 'brown';
  build2button.onclick = bind(digAndBuildFun, DBM_BUILD, 'click where to dig&build');

  var build3button = makeLinkButton(px + 175, compactRowsY + 32, 'dig', parent);
  build3button.title = 'Dig on terrain with various transformation actions. Same as dig&build, except it defaults the selector to another action than transform&build.';
  build3button.style.color = 'brown';
  build3button.onclick = bind(digAndBuildFun, digAndBuildMode == DBM_BUILD ? DBM_COLOR : digAndBuildMode, 'click where to dig');


  var buildbutton = makeLinkButton(px + 210, compactRowsY + 32, getActionName(A_BUILD), parent);
  buildbutton.title = 'build a dwelling (D) on a tile that is already your color';
  buildbutton.style.color = 'brown';
  buildbutton.onclick = function() {
    setMapActionTargets('Highlighted spaces are reachable, empty terrain of your color.', function(x, y) {
      if(player.b_d <= 0 || isOccupied(x, y) || !canBuildOn(player, x, y)) return false;
      if(player.transformed && !player.transformcoset[arCo(x, y)]) return false;
      return inReach(player, x, y, false) || onlyReachableThroughFactionSpecial(player, x, y);
    });
    var fun = function(x, y) {
      clearHumanState();
      var action = new Action(A_BUILD);
      action.co = [x, y];
      prepareAction(action);
    };
    queueHumanState(HS_MAP, 'click where to build dwelling', fun);
  };

  drawActionSectionLabel(px, compactRowsY + 48, 'UPGRADE', parent);
  var upgr1button = makeLinkButton(px + 90, compactRowsY + 48, 'upgr1', parent);
  upgr1button.title = 'upgrade to trading post (TP) or to stronghold (SH)';
  upgr1button.onclick = upgrade1fun;
  var upgr2button = makeLinkButton(px + 140, compactRowsY + 48, 'upgr2', parent);
  upgr2button.title = 'upgrade to temple (TE) or to sanctuary (SA)';
  upgr2button.onclick = upgrade2fun;

  drawActionSectionLabel(px, compactRowsY + 64, 'ADVANCE', parent);
  if(player.digging < player.maxdigging) addSimpleActionButton(px + 90, compactRowsY + 64, getActionName(A_ADV_DIG), A_ADV_DIG);
  if(player.shipping < player.maxshipping) addSimpleActionButton(px + ((player.digging < player.maxdigging) ? 170 : 90), compactRowsY + 64, getActionName(A_ADV_SHIP), A_ADV_SHIP);

  var px2;

  var hasTileActions =
      (player.bonustile == T_BON_SPADE_2C && !player.octogons[A_BONUS_SPADE]) ||
      (player.bonustile == T_BON_CULT_4C && !player.octogons[A_BONUS_CULT]) ||
      (player.favortiles[T_FAV_2W_CULT] && !player.octogons[A_FAVOR_CULT]);
  var tileActionsY = compactRowsY + 80;
  function addCultButton(px, py, text, num, type) {
    var button = makeLinkButton(px, py, text, parent);
    button.onclick = function() {
      var fun = function(cult) {
        clearHumanState();
        var action = new Action(type);
        action.cult = cult;
        prepareAction(action);
      };
      queueHumanState(HS_CULT, 'click on which cult track to increase', fun);
    };
    return button;
  }
  if(hasTileActions) {
    drawActionSectionLabel(px, tileActionsY, 'TILE ACTIONS', parent);
    px2 = px + 90;
    if(player.bonustile == T_BON_SPADE_2C && !player.octogons[A_BONUS_SPADE]) {
      button = addDigButton(px2, tileActionsY, getActionName(A_BONUS_SPADE), 1, A_BONUS_SPADE);
      button.style.color = 'red';
      button.title = 'dig action from the bonus dig tile. Note: by default also builds where you click, use the selector to change to other transform actions.';
      px2 += 75;
    }
    if(player.bonustile == T_BON_CULT_4C && !player.octogons[A_BONUS_CULT]) {
      button = addCultButton(px2, tileActionsY, getActionName(A_BONUS_CULT), 1, A_BONUS_CULT);
      button.style.color = 'red';
      button.title = 'cult action from the bonus cult tile';
      px2 += 60;
    }
    if(player.favortiles[T_FAV_2W_CULT] && !player.octogons[A_FAVOR_CULT]) {
      button = addCultButton(px2, tileActionsY, getActionName(A_FAVOR_CULT), 1, A_FAVOR_CULT);
      button.style.color = 'red';
      button.title = 'cult action from the favor cult tile';
      px2 += 60;
    }
  }

  var factionActionsY = tileActionsY + (hasTileActions ? 16 : 0);
  drawActionSectionLabel(px, factionActionsY, 'FACTION', parent);
  px2 = px + 90;
  if(player.faction == F_CHAOS && player.b_sh == 0 && !player.octogons[A_DOUBLE]) {
    button = addSimpleActionButton(px2, factionActionsY, getActionName(A_DOUBLE), A_DOUBLE);
    button.style.color = 'red';
    button.title = 'cult action from the favor cult tile';
    px2 += 60;
  }
  if(player.faction == F_GIANTS && player.b_sh == 0 && !player.octogons[A_GIANTS_2SPADE]) {
    button = addDigButton(px2, factionActionsY, getActionName(A_GIANTS_2SPADE), 1, A_GIANTS_2SPADE);
    button.style.color = 'red';
    button.title = 'giants dig. Note: by default also builds where you click, use the selector to change to other transform actions.';
    px2 += 90;
  }
  if(player.faction == F_NOMADS && player.b_sh == 0 && !player.octogons[A_SANDSTORM]) {
    button = makeLinkButton(px2, factionActionsY, getActionName(A_SANDSTORM), parent);
    button.style.color = 'red';
    button.title = 'sandstorm. Note: by default also builds where you click, use the selector to change to other transform actions.';
    button.onclick = function() {
      prepareAction(new Action(A_SANDSTORM));
      digAndBuildFun(DBM_BUILD, 'click where to sandstorm & build');
    };
    px2 += 60;
  }
  if(player.faction == F_ALCHEMISTS) {
    button = addSimpleActionButton(px2, factionActionsY, getActionName(A_CONVERT_1VP_1C), A_CONVERT_1VP_1C);
    px2 += 60;
  }
  if(player.faction == F_MERMAIDS) {
    button = makeLinkButton(px2, factionActionsY, getActionName(A_CONNECT_WATER_TOWN), parent);
    button.title = 'form a town with the mermaids special ability, by clicking a water tile. This can be done whenever your current action sequence will form a town.';
    button.onclick = function() {
      var fun = function(x, y) {
        clearHumanState();
        if(getWorld(x, y) != I) return;
        var a = new Action(A_CONNECT_WATER_TOWN);
        a.co = [x, y];
        prepareAction(a);
      };
      queueHumanState(HS_MAP, 'click where to form water town', fun);
    };
    px2 += 60;
  }
  if(player.faction == F_AUREN && player.b_sh == 0 && !player.octogons[A_AUREN_CULT]) {
    button = addCultButton(px2, factionActionsY, getActionName(A_AUREN_CULT), 2, A_AUREN_CULT);
    button.style.color = 'red';
    button.title = 'cult action from the auren';
    px2 += 60;
  }
  if(player.faction == F_SWARMLINGS && player.b_sh == 0 && !player.octogons[A_SWARMLINGS_TP]) {
    button = makeLinkButton(px2, factionActionsY, getActionName(A_SWARMLINGS_TP), parent);
    button.style.color = 'red';
    button.onclick = function() {
      var fun = function(x, y) {
        clearHumanState();
        var action2 = new Action(A_SWARMLINGS_TP);
        action2.co = [x, y];
        prepareAction(action2);
      };
      queueHumanState(HS_MAP, 'click dwelling to upgrade', fun);
    };
    px2 += 60;
  }
  if(player.faction == F_WITCHES && player.b_sh == 0 && !player.octogons[A_WITCHES_D]) {
    button = makeLinkButton(px2, factionActionsY, getActionName(A_WITCHES_D), parent);
    button.style.color = 'red';
    button.onclick = function() {
      var fun = function(x, y) {
        clearHumanState();
        var action2 = new Action(A_WITCHES_D);
        action2.co = [x, y];
        prepareAction(action2);
      };
      queueHumanState(HS_MAP, 'click where to fly and build free dwelling', fun);
    };
    px2 += 60;
  }
  if(player.faction == F_ENGINEERS) {
    button = makeLinkButton(px2, factionActionsY, getActionName(A_ENGINEERS_BRIDGE), parent);
    button.title = '2wto build a bridge';
    button.onclick = function() {
      prepareAction(new Action(A_ENGINEERS_BRIDGE));
      letClickMapForBridge(1);
    };
    px2 += 60;
  }
  if(player.getFaction().canTakeAction(player, A_SHIFT, game)) {
    button = makeLinkButton(px2, factionActionsY, getActionName(A_SHIFT), parent);
    button.title = Texts.shift1title();
    button.onclick = function() {
      chooseActionColor(new Action(A_SHIFT));
    };
    px2 += 60;
  }
  if(player.getFaction().canTakeAction(player, A_SHIFT2, game)) {
    button = makeLinkButton(px2, factionActionsY, getActionName(A_SHIFT2), parent);
    button.title = Texts.shift2title();
    button.onclick = function() {
      chooseActionColor(new Action(A_SHIFT2));
    };
    px2 += 60;
  }

  drawActionSectionLabel(px, factionActionsY + 16, 'END TURN', parent);
  var passbutton = makeLinkButton(px + 90, factionActionsY + 16, getActionName(A_PASS), parent);
  passbutton.onclick = function() {
    prepareAction(new Action(A_PASS));
  };
  passbutton.title = 'Pass for this round, then click a bonus tile for the next round.';


  var execbutton = makeExecButton(player, px + 410, py + 100, parent, executeButtonFun, 'Execute the planned action sequence. Map, cult and tile choices are completed before execution.');
  execbutton[0].style.borderRadius = '8px';
  execbutton[0].style.boxShadow = '0 3px 5px rgba(50,30,15,.28), inset 0 1px 0 rgba(255,255,255,.35)';
  execbutton[1].innerHTML = 'EXECUTE';

  var clearbutton = makeLinkButton(px + 420, py + 84, 'cancel', parent);
  clearbutton.title = 'remove last action from your action sequence';
  clearbutton.onclick = executeButtonClearFun;

  var hintbutton = makeLinkButton(px + 480, py + 84, 'hint', parent);
  hintbutton.title = 'show several possible action sequences you can do. This list is what the AIs use to pick their actions from.';
  hintbutton.onclick = function() {
    var actions = getPossibleActions(player, defaultRestrictions);
    var text = '';
    for(var i = 0; i < actions.length; i++) {
      text += actionsToString(actions[i]) + '\n';
    }
    alert(text);
  };

  // The existing action callbacks deliberately remain untouched. Give every
  // textual control drawn in this panel the same compact, board-like button
  // treatment without changing their positions or gameplay behaviour.
  for(var i = actionControlStart; i < parent.children.length; i++) {
    var control = parent.children[i];
    if(control.style.cursor == 'pointer' && control.innerHTML) styleActionFlowControl(control);
  }
  styleActionFlowControl(build2button);
  styleActionFlowControl(build3button);
  styleActionFlowControl(buildbutton);
  styleActionFlowControl(upgr1button);
  styleActionFlowControl(upgr2button);
  styleActionFlowControl(passbutton, 'quiet');
}

//IE hack: IE refuses to have onclick on transparent elements. But first line of tiles.png is see-through. So use it as bg image.
function IEClickHack(el) {
  el.style.backgroundImage = 'url("iepixel.gif")';
}

//creates the invisible buttons on the hex tiles
function drawMapClick() {
  var tilesize = 64;
  for(var y = 0; y < game.bh; y++)
  for(var x = 0; x < game.bw; x++)
  {
    var tile = game.world[arCo(x, y)];
    if(tile != N /*I is allowed, due to mermaids town*/) {
      var co = pixelCo(x, y);
      var px = co[0];
      var py = co[1];
      var el =  makeDiv(parseInt(mapElement.style.left) + px - tilesize/2, parseInt(mapElement.style.top) + py - tilesize/3 + tilesize/6, uiElement);
      el.style.width = '' + tilesize + 'px';
      el.style.height = '' + (tilesize - 2*tilesize/6) + 'px';
      var closure_x = x;
      var closure_y = y;
      el.onclick = bind(function(x, y) {
        if(mapClickFun) {
          // During faction setup, never send an invalid hex to the selection
          // callback. The rules still validate the eventual placement.
          if(state.type == S_INIT_DWELLING && humanstate == HS_MAP &&
              !isInitialDwellingTarget(getCurrentPlayer(), x, y)) return;
          if(mapActionTargetFun && !mapActionTargetFun(x, y)) return;
          mapClickFun(x, y);
        } else if(executeButtonFun_ /*the way to check a human is doing action. TODO: improve that way*/) {
          // An automatic action based on clicking on the map
          var player = getCurrentPlayer();
          var b = getBuilding(x, y);
          if(b[0] == B_NONE && getWorld(x, y) != I && getWorld(x, y) != N) {
            //digAndBuildMode = DBM_BUILD;
            //prepareAutoDigAndBuildActions(x, y);
            var tactions = getAutoTransformActions(player, x, y, player.getMainDigColor(), getFreeSpades(player, pactions), 999);
            for(var i = 0; i < tactions.length; i++) prepareAction(tactions[i]);
            if(digAndBuildMode == DBM_BUILD) prepareAction(makeActionWithXY(A_BUILD, x, y));
          } else if(b[1] == player.woodcolor) {
            if(b[0] == B_D) prepareAction(makeActionWithXY(A_UPGRADE_TP, x, y));
            // A TP has two possible destinations. When one or both are
            // affordable, open the same focused chooser used by the Upgrade
            // action instead of guessing a destination from building supply.
            if(b[0] == B_TP) showAffordableUpgradeChoicePopup(player, x, y);
            if(b[0] == B_TE) prepareAction(makeActionWithXY(A_UPGRADE_SA, x, y));
          }
        }
      }, x, y);
      el.style.cursor = 'pointer';
      IEClickHack(el);
    }
  }
}

function makeDropDown(x, y, options, parent) {
  var sel = makeAbsElement(x, y, parent, 'select');
  for(var i = 0; i < options.length; i++) {
    makeElement(sel, 'option').innerHTML = options[i];
  }
  return sel;
}

function makeLabeledDropDown(x, y, label, options, parent) {
  makeDiv(x, y, parent).innerHTML = label;
  return makeDropDown(x, y + 16, options, parent);
}

function makeCheckbox(x, y, parent, label, title) {
  //var result = makeAbsElement(x, y, parent, 'input');

  var result =  document.createElement('input');
  result.style.position = 'absolute';
  result.style.left = '' + x + 'px';
  result.style.top = '' + y + 'px';
  result.type = 'checkbox'; //must be set before appending it to the DOM, otherwise it breaks in IE7 (and maybe later)
  parent.appendChild(result);

  if(label) {
    var label = makeText(x + 25, y + 5, label, parent);
    if(title) label.title = title;
  }

  return result;
}

//returns the [bg, labelDiv, button], so you can set colors etc...
function makeButton(x, y, label, parentEl, clickfun, tooltip) {
  var bg = makeSizedDiv(x, y, 100, 40, parentEl);
  bg.style.backgroundColor = '#d00';
  bg.style.border = '1px solid black';
  var labelDiv = makeSizedDiv(x, y + 14, 100, 16, parentEl);
  labelDiv.innerHTML = label;
  labelDiv.style.color = 'white';
  labelDiv.style.fontWeight = 'bold';
  labelDiv.style.textAlign = 'center';
  var button = makeSameSizeDiv(bg, parentEl);
  button.onclick = clickfun;
  button.style.cursor = 'pointer';
  IEClickHack(button);
  if(tooltip) button.title = tooltip;
  return [bg, labelDiv, button];
}



////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

function drawHud() {
  function mainTileClick(tile) {
    if(tileClickFun) {
      tileClickFun(tile);
    } else if(executeButtonFun_ /*the way to check a human is doing action. TODO: improve that way*/) {
        if(isBonusTile(tile) && state.round != 6) {
          // Shortcut: click on bonus tile to pass with it
          var action = new Action(A_PASS);
          if(state.round != 6) action.bontile = tile;
          prepareAction(action);
        }
      }
  }

  logEl.style.top = GAMEPLAY_BOTTOM + 40;
  positionUtilityFooter();

  drawHud2(game.players, mainTileClick);
}

var utilityFooter = null;

function positionUtilityFooter() {
  if(!utilityFooter) return;
  utilityFooter.style.top = (GAMEPLAY_BOTTOM + 5) + 'px';
}

function styleGameChromeButton(button, primary) {
  button.style.boxSizing = 'border-box';
  button.style.height = primary ? '30px' : '24px';
  button.style.padding = primary ? '8px 14px' : '5px 9px';
  button.style.border = primary ? '1px solid #55271c' : '1px solid #866142';
  button.style.borderRadius = primary ? '7px' : '5px';
  button.style.background = primary ? 'linear-gradient(#b95839, #762f22)' : 'linear-gradient(#fff8e6, #dcc08c)';
  button.style.boxShadow = primary ? '0 2px 3px rgba(64,31,19,.32), inset 0 1px 0 rgba(255,255,255,.25)' : 'inset 0 1px 0 rgba(255,255,255,.66)';
  button.style.color = primary ? '#fff8e9' : '#51351f';
  button.style.cursor = 'pointer';
  button.style.fontFamily = primary ? 'Georgia, serif' : 'verdana, arial, sans-serif';
  button.style.fontSize = primary ? '12px' : '10px';
  button.style.fontWeight = 'bold';
  button.style.letterSpacing = primary ? '.35px' : '.2px';
  button.style.textDecoration = 'none';
  button.style.textAlign = 'center';
  button.style.whiteSpace = 'nowrap';
}

function makeGameChromeButton(px, py, width, label, parent, click, title, primary) {
  var button = makeSizedDiv(px, py, width, primary ? 30 : 24, parent);
  styleGameChromeButton(button, primary);
  button.innerHTML = label;
  button.onclick = click;
  if(title) button.title = title;
  return button;
}

function makeGameChromeTitle(parent) {
  var title = makeSizedDiv(14, 8, 190, 25, parent);
  title.style.color = '#4a2f1d';
  title.style.fontFamily = 'Georgia, serif';
  title.style.fontSize = '17px';
  title.style.fontWeight = 'bold';
  title.style.letterSpacing = '.2px';
  title.innerHTML = 'Terra Mystica AI';
  return title;
}

function newGameWarning() {
  if(state.type == S_PRE) return;
  var popupDock = getGameplayPopupDock(400, 150);
  var el = makeSizedDiv(popupDock.x, popupDock.y, 400, 150, document.body);
  el.style.backgroundColor = 'white';
  el.style.border = '1px solid black';
  makeStandalonePanelDragHandle(el, 400);

  //makeText(5, 5, 'Really remove current game and start a new one?', el);
  makeCenteredText('Really lose all progress and start a new game?', 400, 50 + (350 / 2), 70, el);

  var button2 = makeButton(70, 60, 'Yes', el, function() {
    document.body.removeChild(el);
    resetAndBeginNewGame();
  }, 'Yes');

  var button3 = makeButton(220, 60, 'No', el, function() {
    document.body.removeChild(el);
  }, 'No');
}

function drawSaveLoadUI(onlyload) {
  var parent = uiElement;
  var gameTopBar = makeSizedDiv(8, 2, GAMEPLAY_WIDTH - 1, 34, parent);
  gameTopBar.style.boxSizing = 'border-box';
  gameTopBar.style.border = '1px solid #6a4a31';
  gameTopBar.style.borderRadius = '0 0 9px 9px';
  gameTopBar.style.background = 'linear-gradient(90deg, #f6e5bb, #fff7df 48%, #d7b574)';
  gameTopBar.style.boxShadow = '0 3px 7px rgba(57,38,22,.22), inset 0 1px 0 rgba(255,255,255,.68)';
  gameTopBar.style.zIndex = 100;
  makeGameChromeTitle(gameTopBar);

    function makePopupUpTextArea() {
    resetGameplayPopupPosition();
    var popupDock = getGameplayPopupDock(540, 500);
    var el = makeSizedDiv(popupDock.x, popupDock.y, 540, 500, popupElement);
    el.style.boxSizing = 'border-box';
    el.style.padding = '14px';
    el.style.background = 'linear-gradient(145deg, #fff8e4, #e8d1a0)';
    el.style.border = '3px solid #67452c';
    el.style.borderRadius = '12px';
    el.style.boxShadow = '0 8px 20px rgba(30,18,9,.34), inset 0 0 0 2px rgba(255,255,255,.5)';
    makeGameplayPopupDragHandle(popupDock.x, popupDock.y, 540);

    var area = makeElement(el, 'textarea');
    area.style.position = 'absolute';
    area.style.top = 80;
    area.style.left = 20;
    area.style.width = 500;
    area.style.height = 300;
    return [el, area];
  }

  function goHome() {
    newGameWarning();
  }

  function openSave() {
    if(state.type == S_PRE) return;
    var els = makePopupUpTextArea();
    var el = els[0];
    var area = els[1];

    makeText(5, 5, 'Copy all the text below, and save it in a text file to keep a copy of the game state. It can be loaded again at any time.' +
        ' The state can also be shared with others. The final "log:" section is optional.', el);

    area.value = serializeGameState(saveGameState(game, state, logText));
    area.select();

    var button2 = makeButton(425, 450, 'Done', el, function() {
      popupElement.removeChild(el);
    }, 'Done');
  }

  function openLoad() {
    var els = makePopupUpTextArea();
    var el = els[0];
    var area = els[1];

    makeText(5, 5, 'Paste the gamestate text in the field, then press Load to load the game. It only works if the text is valid. ' +
        'This also supports logs from games from terra.snellman.net: on there press "Load full log", select all, and paste it in here.', el);

    area.select();

    var button2 = makeButton(315, 450, 'Load', el, function() {
      var game = deSerializeGameState(area.value);
      if(game) {
        popupElement.removeChild(el);
        loadGameStateHard(game);
        if(!game.logText) addLog('<br/>Loaded a game without log<br/>');
      } else {
      }
    }, 'Load');

    var button3 = makeButton(425, 450, 'Cancel', el, function() {
      popupElement.removeChild(el);
    }, 'Cancel');
  }

  if(!onlyload) {
    function undo() {
      if(undoIndex < 0 || undoIndex >= undoGameStates.length) return;
      if(undoIndex + 1 == undoGameStates.length) undoGameStates.push(saveGameState(game, state, logText));
      var undoGameState = undoGameStates[undoIndex];
      if(undoGameState) {
        loadGameStateHard(undoGameState);
        undoIndex--;
      }
    }

    function redo() {
      if(undoIndex < -2 || undoIndex + 2 >= undoGameStates.length) return;
      var undoGameState = undoGameStates[undoIndex + 2];
      if(undoGameState) {
        loadGameStateHard(undoGameState);
        undoIndex++;
      }
    }

    function openHelp() {
      var popupDock = getGameplayPopupDock(400, 235);
      var el = makeSizedDiv(popupDock.x, popupDock.y, 400, 235, document.body);
      el.style.boxSizing = 'border-box';
      el.style.padding = '12px';
      el.style.background = 'linear-gradient(145deg, #fff8e4, #e8d1a0)';
      el.style.border = '3px solid #67452c';
      el.style.borderRadius = '12px';
      el.style.boxShadow = '0 8px 20px rgba(30,18,9,.34), inset 0 0 0 2px rgba(255,255,255,.5)';
      makeStandalonePanelDragHandle(el, 400);
      makeText(5, 5, 'Play Fast: Always click Fast when available', el);
      makeText(5,20, 'POWER:     Automatically burns power if needed for action', el);
      makeText(5,35, 'CONVERT:   Use these features to get needed resources first', el);
      makeText(5,50, 'PRIEST:    Click on cult track to use available priest there', el);
      makeText(5,65, 'Dwelling:    Click on an empty hex or TRANSFORM:build, then hex', el);
      makeText(5,80, 'Trading post: Click on a dwelling hex', el);
      makeText(5,95, 'Stronghold:  Click on upgr1, then a trading post hex', el);
      makeText(5,110, 'Temple:      Click on upgr2, then a trading post hex', el);
      makeText(5,125,'Sanctuary:   Click on a temple hex', el);
      makeText(5,140,'Red color menu items indicate actions for this round', el);
      makeText(5,155,'Toop tips on most buttons+links give more help', el);
      var button3 = makeButton(25, 180, 'Close', el, function() {
        document.body.removeChild(el);
      }, 'Close');
    }

    function openDebug() {
      if(state.type == S_PRE) return;
      drawDebugActions(0, 563, 850);
    }

    // Undo and redo are part of active play, so they receive the only prime
    // placement in the top bar. All session utilities live together below
    // the player boards, where they stay available without competing with the
    // map, action panel, or turn prompts.
    makeGameChromeButton(220, 2, 86, 'UNDO', gameTopBar, undo, 'Undo last action', true);
    makeGameChromeButton(314, 2, 86, 'REDO', gameTopBar, redo, 'Redo undone action', true);

    utilityFooter = makeSizedDiv(5, 0, 470, 29, parent);
    utilityFooter.style.boxSizing = 'border-box';
    utilityFooter.style.padding = '2px 5px';
    utilityFooter.style.border = '1px solid #765439';
    utilityFooter.style.borderRadius = '7px';
    utilityFooter.style.background = 'linear-gradient(90deg, rgba(255,248,228,.92), rgba(222,193,141,.92))';
    utilityFooter.style.boxShadow = '0 2px 5px rgba(58,39,22,.18), inset 0 1px 0 rgba(255,255,255,.6)';
    utilityFooter.style.zIndex = 100;
    makeGameChromeButton(5, 2, 58, 'HOME', utilityFooter, goHome, 'Go to the main page and start a new game', false);
    makeGameChromeButton(68, 2, 52, 'SAVE', utilityFooter, openSave, 'Save this game to text', false);
    makeGameChromeButton(125, 2, 52, 'LOAD', utilityFooter, openLoad, 'Load a saved game', false);
    makeGameChromeButton(182, 2, 54, 'NEW', utilityFooter, goHome, 'Start a new game', false);
    makeGameChromeButton(241, 2, 55, 'HELP', utilityFooter, openHelp, 'Show user interface help', false);
    makeGameChromeButton(301, 2, 60, 'DEBUG', utilityFooter, openDebug, 'Developer actions', false);
    positionUtilityFooter();
  } else {
    makeGameChromeButton(1025, 5, 135, 'LOAD A GAME', gameTopBar, openLoad, 'Load a saved game', false);
  }
}

function resetAndBeginNewGame() {
  clearHumanState();
  state.type = S_PRE;
  fastestMode = false;
  fastMode = false;
  autoLeech = false;
  autoLeech1 = false;
  autoLeechNo = false;

  game.players.length = 0;
  window.setTimeout(function() {
    mapElement.innerHTML = '';
    styleMapWorkspace(false);
    uiElement.innerHTML = '';
    hudElement.innerHTML = '';
    popupElement.innerHTML = '';
    actionEl.innerHTML = '';
    helpEl.innerHTML = '';
    logEl.innerHTML = '';
    logText = '';
    lastLogLine = '';
    beginGame();
  }, 0);
}

function drawDebugActions(pindex, px, py) {
  var DEBUGBUTTONCOLOR = 'grey';

  var title = makeDiv(px, py - 16, uiElement);
  title.innerHTML = 'debug buttons - only for debugging';
  title.style.color = DEBUGBUTTONCOLOR;

  var button;

  function addDebugIncomeButton(px, py, name, resources, remove) {
    var bonbutton = makeLinkButton(px, py, name, uiElement);
    bonbutton.style.color = DEBUGBUTTONCOLOR;
    bonbutton.onclick = function() {
      if(remove) consumeOverload(game.players[pindex], resources);
      else addIncome(game.players[pindex], resources);
      drawHud();
    };
  }
  addDebugIncomeButton(px+0, py, 'cheat', [1000,1000,1000,1000,0], false);
  addDebugIncomeButton(px+50, py, 'null', [1000,1000,1000,1000,0], true);
  addDebugIncomeButton(px+80, py, '12pw', [0,0,0,12,0], false);
  addDebugIncomeButton(px+0, py+16, '1c', [1,0,0,0,0], false);
  addDebugIncomeButton(px+25, py+16, '1w', [0,1,0,0,0], false);
  addDebugIncomeButton(px+50, py+16, '1p', [0,0,1,0,0], false);
  addDebugIncomeButton(px+70, py+16, '1pw', [0,0,0,1,0], false);
  addDebugIncomeButton(px+100, py+16, '1vp', [0,0,0,0,1], false);
  button = makeLinkButton(px+130, py+16, '1pp', uiElement);
  button.style.color = DEBUGBUTTONCOLOR;
  button.onclick = function() { game.players[0].pp++; drawHud(); };
  addDebugIncomeButton(px+160, py+16, '-1c', [1,0,0,0,0], true);
  addDebugIncomeButton(px+185, py+16, '-1w', [0,1,0,0,0], true);
  addDebugIncomeButton(px+210, py+16, '-1p', [0,0,1,0,0], true);
  addDebugIncomeButton(px+235, py+16, '-1pw', [0,0,0,1,0], true);
  addDebugIncomeButton(px+270, py+16, '-1vp', [0,0,0,0,1], true);
  button = makeLinkButton(px+300, py+16, '-1pp', uiElement);
  button.style.color = DEBUGBUTTONCOLOR;
  button.onclick = function() { game.players[0].pp--; drawHud(); };

  var execbutton2 = makeLinkButton(px + 120, py, 'cheatai', uiElement);
  execbutton2.style.color = DEBUGBUTTONCOLOR;
  execbutton2.onclick = function() {
    game.players[1].c = 999;
    game.players[1].w = 999;
    game.players[1].p = 999;
    game.players[1].pw0 = 0;
    game.players[1].pw1 = 0;
    game.players[1].pw2 = 12;
    drawHud();
  };

  var cultcheatbutton = makeLinkButton(px + 190, py, 'cultcheat', uiElement);
  cultcheatbutton.style.color = DEBUGBUTTONCOLOR;
  cultcheatbutton.onclick = function() {
    game.players[0].cult[C_F] = 9;
    game.players[0].cult[C_W] = 9;
    game.players[0].cult[C_E] = 9;
    game.players[0].cult[C_A] = 9;
    drawHud();
  };

  var tilecheatbutton = makeLinkButton(px + 260, py, 'tilecheat', uiElement);
  tilecheatbutton.style.color = DEBUGBUTTONCOLOR;
  tilecheatbutton.onclick = function() {
    for(var i = T_FAV_BEGIN + 1; i < T_FAV_END; i++) game.players[0].favortiles[i] = 1;
    for(var i = T_TW_BEGIN + 1; i < T_TW_END; i++) game.players[0].towntiles[i] = 1;
    drawHud();
  };

  var skipbutton = makeLinkButton(px + 420, py, 'debugskip', uiElement);
  skipbutton.style.color = DEBUGBUTTONCOLOR;
  skipbutton.onclick = function() {
    autoLeechNo = true;
    fastMode = true;
    fastestMode = true;
    prepareAction(new Action(A_DEBUG_SKIP));
    if(state.type == S_GAME_OVER) {
      //keep degubbing past round 6
      gameLoopNonBlocking(S_ROUND_END_DIG);
    } else if(state.type > S_INIT_DWELLING) {
      executeButtonFun();
    }
  };

  var skipbutton = makeLinkButton(px + 340, py, 'debugstep', uiElement);
  skipbutton.style.color = DEBUGBUTTONCOLOR;
  skipbutton.onclick = function() {
    prepareAction(new Action(A_DEBUG_STEP));
    executeButtonFun();
  };

  var refreshbutton = makeLinkButton(px + 330, py + 16, 'redraw', uiElement);
  refreshbutton.style.color = DEBUGBUTTONCOLOR;
  refreshbutton.onclick = function() {
    drawHud();
    drawMap();
  };

  var button;

  button = makeLinkButton(px + 380, py + 16, 'allai', uiElement);
  button.style.color = DEBUGBUTTONCOLOR;
  button.onclick = function() {
    for(var i = 0; i < game.players.length; i++) game.players[i].actor = newAI();
  };

  button = makeLinkButton(px + 410, py + 16, 'altco', uiElement);
  button.style.color = DEBUGBUTTONCOLOR;
  button.onclick = function() {
    altco = !altco;
    drawMap();
  };

  button = makeLinkButton(px + 450, py + 16, 'test', uiElement);
  button.style.color = DEBUGBUTTONCOLOR;
  button.onclick = function() {
    runAllUnitTests();
  };
}
