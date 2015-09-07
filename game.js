// RequestAnimationFrame polyfil
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];

    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }
}());

// Global variables
var canvas, context, canvasW, canvasH, canvasCX, canvasCY, cursorData;
var lastUpdate = Date.now();
var spikeInterval = 0;

var game = {
    state: 'loading', // loading, ready, first_half, halftime, second_half, over
    background: 'transparent',
    dayColor: 'white',
    nightColor: 'black',
    gravity: 0.4,
    friction: 0.01,
    juggles: 0,
    scoreRight: 0,
    scoreLeft: 0,
    highscore: 0,
    highscoreEver: 0,
    triesInitial: 2,
    tries: 2,
    firstTry: true,
    floorTouched: false,
    ballHit: false,
    emittActive: false,
    emittSpike: false,
    scoreBoard: {
        color: 'white',
        background: 'black'
    },
    popup: {
        color: 'white',
        background: 'black'
    },
    luckyBall: 'RIGHT IS YOUR LUCKY BALL.',
    ceiling: 80
};

var spike = {
    color: game.nightColor,
    width: 40,
    height: 20,
    count: 0,
    randomNum: 4,
    posYStart: 0,
    posYFalling: 0,
    falling: false,
    speedModifier: 5, // 1 is fastest 10 is slow 5 is bit challenging
    tick: 3300
}

var ballData = {
    posX: 0,
    posY: 0,
    velX: 0,
    velY: 0,
    velMin: 0,
    velMax: 20,
    stopPointTreshold: 0.1,
    bounceFactor: 0.5,
    radius: 60,
    color: game.nightColor,
};

function init(){
    canvas = document.createElement('canvas');
    context = canvas.getContext('2d');

    // Setup canvas data
    canvasW = canvas.width = 640;
    canvasH = canvas.height = 960;
    canvasCX = canvasW / 2;
    canvasCY = canvasH / 2;
    canvas.style.width = '320px';
    canvas.style.height = '480px';
    canvas.style.background = game.background;
    spike.count = canvasW / spike.width - 1;

    // Add canvas to body
    document.body.appendChild(canvas);

    // Set ball spawn position
    ballPositionSpawn();

    // Init mousedown listener
    canvas.addEventListener('mousedown', function(e){
        cursorData = getCursorPosition(this, e);

		updateGameState();

		handleJuggle(cursorData);
    });

    // We set everything, we are ready to animate and play
    game.state = 'ready';
    // Start looping it
    animate();
}

function animate() {
    var now = Date.now();
    var dt = now - lastUpdate;
    lastUpdate = now;

    render(dt);
    requestAnimationFrame(animate);
}

// Main game loop where all data is updated
function render(dt) {
	// clear scene
    renderClear();

    // update scoreboard
    scoreBoardRender();

	// update spikes and falling spike
    drawSpikes(dt);

	// update spikes and falling spike
    drawBall(dt);

    if(game.ballHit && game.tries > 0 && game.tries < game.triesInitial) popupRender('hit');
    if(game.state == 'ready') popupRender('start');
    if(game.state == 'over')  popupRender('restart');
}

// Reset game when game over popup is clicked
function gameReset(){
    setDayNight('day');
    ballPositionSpawn();
    triesReset();
    jugglesReset();
    highscoreReset();
    game.scoreRight = 0;
    game.scoreLeft = 0;
}

function setSpikeInterval() {
    spikeInterval = setInterval(function(){
        if(game.emittActive) {
            game.emittSpike = true;
            spike.falling = true;
        }
    }, spike.tick);
}

function handleJuggle(cursorData) {
	// Handle juggles
    if(ballData.posX - ballData.radius < cursorData.x
    && ballData.posX + ballData.radius > cursorData.x
    && ballData.posY - ballData.radius < cursorData.y
    && ballData.posY + ballData.radius > cursorData.y) {
        jugglesIncrement();

        game.floorTouched = false;

        var touchPointData = getTouchPoint(cursorData);

        // Calculate ball direction from the clicked point on the ball
        if(touchPointData.x < 0) {
            ballData.velX = 0;
            ballData.velX += -(touchPointData.x * 0.1);
        } else if (touchPointData.x > 0) {
            ballData.velX = 0;
            ballData.velX += -(touchPointData.x * 0.1);
        } else {
            ballData.velX = 0
        }

        ballData.velY -= (game.gravity + 20);
    }
}

function updateGameState() {
    // Game states updates
    if(game.state == 'ready') {
        game.state = 'first_half';
        setSpikeInterval();
        game.emittActive = true;
    }

    if(game.state == 'halftime') {
        game.state = 'second_half';
        setSpikeInterval();
        game.ballHit = false;
        game.emittActive = true;
    }

    if(game.state == 'over') {
        gameReset();
        game.state = 'ready';
        game.emittActive = false;
    }
}

// Ball draw function
function ball(x,y,r,c) {
    context.fillStyle = c;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2, true);
    context.closePath();
    context.fill();
}

// Ball update + redraw
function drawBall(dt){
    // X Axis update
    if (ballData.velX < 0) {
        ballData.velX += game.friction * (dt * 0.1);
        if(ballData.velX > -ballData.stopPointTreshold) {
            ballData.velX = 0;
        }
    }
    else if (ballData.velX > 0) {
        ballData.velX -= game.friction * (dt * 0.1);
        if(ballData.velX < ballData.stopPointTreshold) {
            ballData.velX = 0;
        }
    }
    else {
        ballData.velX = 0
    }

    if (ballData.posX - ballData.radius < 0) {
        ballData.velX = -ballData.velX;
    }
    else if(ballData.posX + ballData.radius > canvasW) {
        ballData.velX = -ballData.velX;
    }

    ballData.posX += ballData.velX

    if (ballData.posY - ballData.radius < game.ceiling ) {
        ballData.velY = -ballData.velY;
        ballHitStateUpdate();
    }

    // Y Axis update
    if(ballData.velY < ballData.velMax) ballData.velY += game.gravity;

    // keep falling until floor touched
    if (ballData.posY + ballData.velY + ballData.radius < canvasH) {
        ballData.posY += ballData.velY + (dt * 0.1);
    }
    else {
        jugglesReset();

        if(!game.floorTouched) {
            game.floorTouched = true;
            ballHitStateUpdate();
        }

        ballData.posY = canvasH - ballData.radius;
        ballData.velY *= -ballData.bounceFactor;
    }

    ball(ballData.posX, ballData.posY, ballData.radius, ballData.color);
}

function ballHitStateUpdate() {
    if(game.state == 'first_half' || game.state == 'second_half') {
        game.ballHit = true;
        ballWasHit();

        if(game.state == 'first_half') {
            game.state = 'halftime';
        }
        else if (game.state == 'second_half') {
            game.state = 'over';
        }
    }
}

function ballWasHit() {
    triesDecrement();
    spike.falling = false;
    game.emittActive = false;
    clearInterval(spikeInterval);
    spike.velY = 0;
    spike.posYFalling = spike.posYStart;
}

// Spike movement and reset
function drawSpikes(dt) {
    // update falling spike velocity
    if(spike.falling &&  (game.state == 'first_half' || game.state == 'second_half') ) {
        spike.velY += game.gravity / spike.speedModifier * (dt * 0.1);
    }

    // update falling spike number after emitt
    if(game.emittSpike &&  (game.state == 'first_half' || game.state == 'second_half') ) {
        game.emittSpike = false;
        spike.falling = true;
        spike.randomNum = Math.floor(ballData.posX / spike.width);
    }

    for(var i = 0; i <= spike.count; i++) {
        if(i != spike.randomNum){
            spikeDrawStatic(i, spike.color);
        }
        else {
        	var ballRadius = ballData.radius
        	var posXFalling = spike.posXFalling;
            var posYFalling = spike.posYFalling;

            if(posYFalling < canvasH - spike.height
            && (posXFalling < ballData.posX - ballRadius
            ||  posXFalling > ballData.posX + ballRadius
            ||  posYFalling < ballData.posY - ballRadius
            ||  posYFalling > ballData.posY + ballRadius)) {
                if(game.state == 'first_half' || game.state == 'second_half') {
                    spike.posYFalling = posYFalling + spike.velY;
                }
                else {
                    spike.posYFalling = spike.posYStart;
                }
            }
            else {
                if((game.state == 'first_half' || game.state == 'second_half')
                && posYFalling > ballData.posY - ballRadius
                && posYFalling < ballData.posY + ballRadius
                && posYFalling < canvasH - spike.height) {
                    game.ballHit = true;
                    jugglesReset();
                    ballWasHit();
                    if(game.state == 'first_half') {
                        game.state = 'halftime';
                    }
                    else if (game.state == 'second_half'){
                        game.state = 'over';
                    }
                }
                spike.posYFalling = spike.posYStart;
                spike.velY = 0;
                spike.falling = false;
            }
            spikeDrawFalling(i, spike.posYFalling, spike.color);
        }
    }
}

// Initial ball position spawn
function ballPositionSpawn() {
    ballData.velX = 0;
    ballData.velY = 0;
    ballData.posX = canvasCX;
    ballData.posY = canvasH - ballData.radius;
}

// Bounces the ball after click
function bounce(){
    ballData.posY = canvasH - ballData.radius;
    ballData.velY *= -ballData.bounceFactor;
}

// Scoreboard update functions
function jugglesRender() {
    context.font = '20px Sans-Serif';
    context.fillStyle = game.scoreBoard.color;
    context.textAlign = 'left';
    context.fillText('JUGGLES: ' + game.juggles, 10, 25);
}

function jugglesIncrement() {
    game.juggles += 1;

    if(game.firstTry) {
        game.scoreRight += 1;
    }
    else {
        game.scoreLeft += 1;
    }
}

function jugglesReset() {
    if(game.juggles > game.highscore) {
        game.highscore = game.juggles;
    }
    if(game.juggles > game.highscoreEver) {
        game.highscoreEver = game.juggles;
    }
    game.juggles = 0;
}

function triesRender() {
    context.font = '20px Sans-Serif';
    context.textAlign = 'right';
    context.fillStyle = game.scoreBoard.color;
    var runsLeft = (game.tries != 1) ? 'RIGHT BALL' : 'LEFT BALL';
    context.fillText(runsLeft, canvasW - 10, 25);
}

function triesDecrement() {
    if(game.tries > 1) {
        game.tries -= 1;
    } else {
        game.tries = 0;
    }
}

function triesReset() {
    game.tries = game.triesInitial;
}

function highscoreRender() {
    context.font = '20px Sans-Serif';
    context.textAlign = 'center';
    context.fillStyle = game.scoreBoard.color;
    context.fillText('BEST: ' + game.highscoreEver, canvasCX, 25);
}

function highscoreReset() {
    game.highscore = 0;
}

function scoreBoardRender() {
    context.fillStyle = game.scoreBoard.background;
    context.fillRect(0, 0, canvasW, 40);
    jugglesRender();
    triesRender();
    highscoreRender();
}

// Popup switcher
function popupRender(type) {
    switch(type){
        case 'start':
            popupDrawStart();
            break;
        case 'restart':
            popupDrawRestart();
            break;
        case 'hit':
            popupDrawNextTry();
            break;
    }
}

// Lazy popup and style formatting code
function popupDrawStart() {
    setDayNight('day');
    context.fillStyle = game.dayColor;
    context.fillRect(0, 0, canvasW, canvasH);
    context.font = 'bold 52px Sans-Serif';
    context.fillStyle = game.nightColor;
    context.textAlign = 'center';
    context.fillText('BALLS JUGGLE!', canvasCX, canvasCY - 120);
    context.font = 'bold 20px Sans-Serif';
    context.fillText('FIND YOUR LUCKY BALL!', canvasCX, canvasCY - 80);
    context.fillText('CLICK TO START', canvasCX, canvasCY + 250);
}

function popupDrawRestart() {
    if(game.scoreLeft > game.scoreRight) {
        game.luckyBall = 'LEFT IS YOUR LUCKY BALL!';
    }
    else if(game.scoreLeft === game.scoreRight) {
        game.luckyBall = 'YOUR BALLS ARE EQUALLY LUCKY.';
    }
    context.fillStyle = game.nightColor;
    context.fillRect(0, 0, canvasW, canvasH);
    context.font = '20px Sans-Serif';
    context.fillStyle = game.dayColor;
    context.textAlign = 'center';
    context.fillText('YOUR LUCKY BALL DID', canvasCX, canvasCY - 120);
    context.font = 'bold 36px Sans-Serif';
    var s = (game.highscore === 1) ? '' : 'S';
    context.fillText(game.highscore + ' JUGGLE'+s+'!', canvasCX, canvasCY - 80);
    context.font = '32px Sans-Serif';
    context.fillText(game.luckyBall, canvasCX, canvasCY);
    context.font = '20px Sans-Serif';
    context.fillText('GAME IS OVER.', canvasCX, canvasCY + 100);
    context.fillText('CLICK TO RETRY.', canvasCX, canvasCY + 140);
    game.firstTry = true;
    game.luckyBall = 'RIGHT IS YOUR LUCKY BALL!';
}

function popupDrawNextTry() {
    game.firstTry = false;
    setDayNight('night');
    context.font = '24px Sans-Serif';
    context.fillStyle = game.dayColor;
    context.textAlign = 'center';
    context.fillText('OUCH! LOST RIGHT BALL.', canvasCX, 250);
    context.fillText('TIME FOR LEFT BALL.', canvasCX, 280);
    context.fillText('KEEP CLICKING YOUR BALL!!!', canvasCX, 310);
}

// Reversing scene colors
function setDayNight(dayNight) {
    if(dayNight == 'night') {
        document.body.style.background = game.nightColor;
        document.getElementsByTagName('canvas')[0].style.borderColor = game.dayColor;
        game.scoreBoard.color = game.nightColor;
        game.scoreBoard.background = game.dayColor;
        ballData.color = game.dayColor;
        spike.color = game.dayColor;
    }
    else {
        document.body.style.background = game.dayColor;
        document.getElementsByTagName('canvas')[0].style.borderColor = game.nightColor;
        game.scoreBoard.color = game.dayColor;
        game.scoreBoard.background = game.nightColor;
        ballData.color = game.nightColor;
        spike.color = game.nightColor;
    }
}

// Spike draw functions
function spikeDrawStatic(multiplier, c) {
    context.fillStyle = c;
    context.beginPath();
    context.moveTo(0 + (spike.width * multiplier),40);
    context.lineTo(20 + (spike.width * multiplier),60);
    context.lineTo(40 + (spike.width * multiplier),40);
    context.fill();
}

function spikeDrawFalling(multiplierX, multiplierY, c) {
    spike.posXFalling = 20 + (spike.width * multiplierX);
    context.fillStyle = c;
    context.beginPath();
    context.moveTo(0 + (spike.width * multiplierX),40 + spike.posYFalling);
    context.lineTo(20 + (spike.width * multiplierX),60 + spike.posYFalling);
    context.lineTo(40 + (spike.width * multiplierX),40 + spike.posYFalling);
    context.fill();
}

// Click coordinates
function getCursorPosition(canvas, event) {
    var relative = canvas.getBoundingClientRect();
    var cpX = (event.pageX - relative.left) * 2;
    var cpY = (event.pageY - relative.top) * 2;

    return {
      x: cpX,
      y: cpY
    };
}

// Calculate ball touch point
function getTouchPoint(data) {
    var pX = Math.floor(-(ballData.posX - data.x));
    var pY = Math.floor(-(ballData.posY - data.y));

    return {
        x: pX,
        y: pY
    };
}

// Random integer helper
function getRandomInt(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Clear canvas
function renderClear(){
    context.clearRect(0, 0, canvasW, canvasH);
}