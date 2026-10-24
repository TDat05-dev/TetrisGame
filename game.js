// ===== CAU HINH CHUNG =====

const COLS = 10;
const ROWS = 20;
const PREVIEW_SIZE = 4;
const EMPTY = 0;

const SHAPES = {
    I: [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0]
    ],
    L: [
        [0, 2, 0],
        [0, 2, 0],
        [0, 2, 2]
    ],
    J: [
        [0, 3, 0],
        [0, 3, 0],
        [3, 3, 0]
    ],
    O: [
        [4, 4],
        [4, 4]
    ],
    Z: [
        [5, 5, 0],
        [0, 5, 5],
        [0, 0, 0]
    ],
    S: [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0]
    ],
    T: [
        [0, 7, 0],
        [7, 7, 7],
        [0, 0, 0]
    ],
    // level 3
    BOMB: [
        [9, 9],
        [9, 9]
    ]
};

const NORMAL_PIECES = ['I', 'L', 'J', 'O', 'Z', 'S', 'T'];

const SCORE_FOR_1_LINE = 10;
const SCORE_FOR_2_LINES = 30;
const SCORE_FOR_3_LINES = 50;
const SCORE_FOR_4_LINES = 100;

const SCORE_TO_REACH_LEVEL_2 = 100;
const SCORE_TO_REACH_LEVEL_3 = 250;
const SCORE_TO_REACH_LEVEL_4 = 500;
const SCORE_TO_REACH_LEVEL_5 = 800;
const LAST_LEVEL = 5;

const SAVE_KEY = 'tetris.unlockedLevel';


// ===== BIEN CHUNG =====

let board = [];

let pieceType = '';
let pieceShape = [];
let pieceX = 0;
let pieceY = 0;
let nextPieceType = '';

let gameState = 'menu';

let score = 0;
let level = 1;
let startLevel = 1;
let unlockedLevel = 1;

// dùng cho level 2 và level 3
let piecesWithoutClear = 0;

let boardCells = [];
let nextCells = [];


// ===== BAN CHOI =====

function createEmptyRow() {
    let row = [];
    for (let x = 0; x < COLS; x++) {
        row.push(EMPTY);
    }
    return row;
}

function createEmptyBoard() {
    board = [];
    for (let y = 0; y < ROWS; y++) {
        board.push(createEmptyRow());
    }
}

function isRowFull(y) {
    for (let x = 0; x < COLS; x++) {
        if (board[y][x] === EMPTY) {
            return false;
        }
    }
    return true;
}

function isRowEmpty(y) {
    for (let x = 0; x < COLS; x++) {
        if (board[y][x] !== EMPTY) {
            return false;
        }
    }
    return true;
}

function removeRow(y) {
    board.splice(y, 1);
    board.unshift(createEmptyRow());
}

function removeFullRows() {
    let removedCount = 0;
    let y = ROWS - 1;

    while (y >= 0) {
        if (isRowFull(y)) {
            removeRow(y);
            removedCount = removedCount + 1;
        } else {
            y = y - 1;
        }
    }

    return removedCount;
}

function getAreaLeft(x) {
    if (x > COLS - 2) {
        return COLS - 2;
    }
    return x;
}

function getAreaTop(y) {
    if (y > ROWS - 2) {
        return ROWS - 2;
    }
    return y;
}

function clearArea2x2(x, y) {
    let left = getAreaLeft(x);
    let top = getAreaTop(y);

    board[top][left] = EMPTY;
    board[top][left + 1] = EMPTY;
    board[top + 1][left] = EMPTY;
    board[top + 1][left + 1] = EMPTY;
}


// ===== KHOI DANG ROI =====

function getRandomPieceType() {
    let index = Math.floor(Math.random() * NORMAL_PIECES.length);
    return NORMAL_PIECES[index];
}

function copyShape(type) {
    let original = SHAPES[type];
    let copy = [];
    for (let y = 0; y < original.length; y++) {
        let row = [];
        for (let x = 0; x < original[y].length; x++) {
            row.push(original[y][x]);
        }
        copy.push(row);
    }
    return copy;
}

function canPlace(shape, newX, newY) {
    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x] === EMPTY) {
                continue;
            }

            let boardX = newX + x;
            let boardY = newY + y;

            if (boardX < 0 || boardX >= COLS) {
                return false;
            }
            if (boardY >= ROWS) {
                return false;
            }
            if (boardY >= 0 && board[boardY][boardX] !== EMPTY) {
                return false;
            }
        }
    }
    return true;
}

function spawnNextPiece() {
    if (nextPieceType === '') {
        nextPieceType = getRandomPieceType();
    }

    pieceType = nextPieceType;
    pieceShape = copyShape(pieceType);
    pieceX = Math.floor(COLS / 2) - Math.floor(pieceShape.length / 2);
    pieceY = 0;

    // level 3
    if (bombIsNext) {
        nextPieceType = BOMB;
        bombIsNext = false;
    } else {
        nextPieceType = getRandomPieceType();
    }

    if (canPlace(pieceShape, pieceX, pieceY) === false) {
        gameOver();
    }
}

function putPieceOnBoard() {
    for (let y = 0; y < pieceShape.length; y++) {
        for (let x = 0; x < pieceShape[y].length; x++) {
            let boardY = pieceY + y;
            if (pieceShape[y][x] !== EMPTY && boardY >= 0) {
                board[boardY][pieceX + x] = pieceShape[y][x];
            }
        }
    }
}

function rotateShape(shape) {
    let size = shape.length;
    let rotated = [];
    for (let y = 0; y < size; y++) {
        let row = [];
        for (let x = 0; x < size; x++) {
            row.push(shape[size - 1 - x][y]);
        }
        rotated.push(row);
    }
    return rotated;
}

function movePieceUpUntilFree() {
    while (canPlace(pieceShape, pieceX, pieceY) === false) {
        pieceY = pieceY - 1;
    }
}


// ===== DIEU KHIEN =====

function moveLeft() {
    if (canPlace(pieceShape, pieceX - 1, pieceY)) {
        pieceX = pieceX - 1;
    } else {
        tryTeleportPiece('left'); // level 5
    }
}

function moveRight() {
    if (canPlace(pieceShape, pieceX + 1, pieceY)) {
        pieceX = pieceX + 1;
    } else {
        tryTeleportPiece('right'); // level 5
    }
}

function moveDown() {
    if (canPlace(pieceShape, pieceX, pieceY + 1)) {
        pieceY = pieceY + 1;
    } else {
        landPiece();
    }
}

function rotatePiece() {
    let rotated = rotateShape(pieceShape);
    let shiftsToTry = [0, 1, -1, 2, -2];

    for (let i = 0; i < shiftsToTry.length; i++) {
        let newX = pieceX + shiftsToTry[i];
        if (canPlace(rotated, newX, pieceY)) {
            pieceShape = rotated;
            pieceX = newX;
            return;
        }
    }
}


// ===== KHI KHOI CHAM DAY =====

function landPiece() {
    if (pieceType === BOMB) {
        // level 3
        explodeBomb();
    } else {
        putPieceOnBoard();
    }

    let linesRemoved = removeFullRows();
    addScore(linesRemoved);
    addEnergy(linesRemoved); // level 4
    levelUpIfEnoughScore();

    if (level === 2) {
        let stillAlive = applyLevel2Rule(linesRemoved);
        if (stillAlive === false) {
            gameOver();
            return;
        }
    }
    if (level === 3) {
        applyLevel3Rule(linesRemoved);
    }

    spawnNextPiece();
}

function addScore(linesRemoved) {
    if (linesRemoved === 1) {
        score = score + SCORE_FOR_1_LINE;
    } else if (linesRemoved === 2) {
        score = score + SCORE_FOR_2_LINES;
    } else if (linesRemoved === 3) {
        score = score + SCORE_FOR_3_LINES;
    } else if (linesRemoved === 4) {
        score = score + SCORE_FOR_4_LINES;
    }
}


// ===== LEVEL =====

function getScoreToReachLevel(levelNumber) {
    if (levelNumber === 2) {
        return SCORE_TO_REACH_LEVEL_2;
    }
    if (levelNumber === 3) {
        return SCORE_TO_REACH_LEVEL_3;
    }
    if (levelNumber === 4) {
        return SCORE_TO_REACH_LEVEL_4;
    }
    return SCORE_TO_REACH_LEVEL_5;
}

function getLevelDescription(levelNumber) {
    if (levelNumber === 1) {
        return 'Chơi cơ bản';
    }
    if (levelNumber === 2) {
        return 'Cứ ' + PIECES_BEFORE_GARBAGE + ' khối không phá hàng thì trồi 1 hàng rác';
    }
    if (levelNumber === 3) {
        return 'Cứ ' + PIECES_BEFORE_BOMB + ' khối không phá hàng thì tặng 1 khối nổ';
    }
    if (levelNumber === 4) {
        return 'Phá hàng để tích năng lượng, đầy thì dùng kỹ năng';
    }
    return 'Đi qua mép trái sẽ hiện ra ở mép phải và ngược lại';
}

function levelUpIfEnoughScore() {
    if (level === LAST_LEVEL) {
        return;
    }

    let nextLevel = level + 1;
    if (score >= getScoreToReachLevel(nextLevel)) {
        enterLevel(nextLevel);
        showBanner('Level Up');
    }
}

function enterLevel(newLevel) {
    level = newLevel;
    piecesWithoutClear = 0;
    bombIsNext = false;
    energy = 0;
    breakRowCooldown = 0;
    explodeAreaCooldown = 0;
    unlockLevel(newLevel);
}

function skipToNextLevel() {
    if (level === LAST_LEVEL) {
        showBanner('Đã là level cuối');
        return;
    }

    let nextLevel = level + 1;
    let scoreNeeded = getScoreToReachLevel(nextLevel);
    if (score < scoreNeeded) {
        score = scoreNeeded;
    }

    enterLevel(nextLevel);
    showBanner('Level ' + level);
    draw();
}

function countPieceWithoutClear(linesRemoved) {
    if (linesRemoved > 0) {
        piecesWithoutClear = 0;
    } else {
        piecesWithoutClear = piecesWithoutClear + 1;
    }
}


// ===== LUU LEVEL DA MO =====

function loadUnlockedLevel() {
    let savedLevel = parseInt(localStorage.getItem(SAVE_KEY));

    if (savedLevel >= 1 && savedLevel <= LAST_LEVEL) {
        unlockedLevel = savedLevel;
    } else {
        unlockedLevel = 1;
    }
}

function unlockLevel(newLevel) {
    if (newLevel > unlockedLevel) {
        unlockedLevel = newLevel;
        localStorage.setItem(SAVE_KEY, unlockedLevel);
    }
}


// ===== VE =====

function createCells() {
    let boardElement = document.getElementById('board');
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.onclick = function () {
                clickCell(x, y);
            };
            cell.onmouseover = function () {
                hoverCell(x, y);
            };
            boardElement.appendChild(cell);
            boardCells.push(cell);
        }
    }
    boardElement.onmouseleave = stopHover;

    let nextElement = document.getElementById('next');
    for (let i = 0; i < PREVIEW_SIZE * PREVIEW_SIZE; i++) {
        let cell = document.createElement('div');
        cell.className = 'cell';
        nextElement.appendChild(cell);
        nextCells.push(cell);
    }
}

function getBoardCell(x, y) {
    return boardCells[y * COLS + x];
}

function getNextCell(x, y) {
    return nextCells[y * PREVIEW_SIZE + x];
}

function drawBoard() {
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            getBoardCell(x, y).dataset.v = board[y][x];
            getBoardCell(x, y).className = 'cell';
        }
    }
}

function drawFallingPiece() {
    let isPieceOnBoard = gameState === 'playing' || gameState === 'choosing-target' || gameState === 'paused';
    if (isPieceOnBoard === false) {
        return;
    }

    for (let y = 0; y < pieceShape.length; y++) {
        for (let x = 0; x < pieceShape[y].length; x++) {
            let boardY = pieceY + y;
            if (pieceShape[y][x] !== EMPTY && boardY >= 0) {
                getBoardCell(pieceX + x, boardY).dataset.v = pieceShape[y][x];
            }
        }
    }
}

function drawNextPiece() {
    for (let y = 0; y < PREVIEW_SIZE; y++) {
        for (let x = 0; x < PREVIEW_SIZE; x++) {
            getNextCell(x, y).dataset.v = EMPTY;
        }
    }

    if (nextPieceType === '') {
        return;
    }

    let shape = SHAPES[nextPieceType];
    let offset = 0;
    if (shape.length === 2) {
        offset = 1;
    }

    for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
            if (shape[y][x] !== EMPTY) {
                getNextCell(x + offset, y + offset).dataset.v = shape[y][x];
            }
        }
    }
}

function drawScoreAndLevel() {
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = level;
}

function drawBoardStyle() {
    let className = 'board';
    // level 5
    if (level === 5) {
        className = className + ' portal';
    }
    // level 4
    if (gameState === 'choosing-target') {
        className = className + ' aiming';
    }
    document.getElementById('board').className = className;
}

function drawControlButtons() {
    let canPause = gameState === 'playing';
    let canRestart = gameState === 'playing' || gameState === 'paused';

    document.getElementById('pause-button').disabled = canPause === false;
    document.getElementById('restart-button').disabled = canRestart === false;
}

function draw() {
    drawBoard();
    drawFallingPiece();
    drawSkillTarget();
    drawNextPiece();
    drawScoreAndLevel();
    drawEnergyAndSkills();
    drawBoardStyle();
    drawControlButtons();
}

function showBanner(text) {
    let banner = document.getElementById('banner');
    banner.innerText = text;
    banner.classList.add('visible');

    setTimeout(function () {
        banner.classList.remove('visible');
    }, 2000);
}


// ===== MENU, BAT DAU, TAM DUNG, THUA =====

function showMenu() {
    gameState = 'menu';
    document.getElementById('game-over').hidden = true;
    document.getElementById('pause-menu').hidden = true;
    document.getElementById('level-menu').hidden = false;

    for (let levelNumber = 1; levelNumber <= LAST_LEVEL; levelNumber++) {
        let button = document.getElementById('level-' + levelNumber + '-button');
        let description = document.getElementById('level-' + levelNumber + '-text');

        if (levelNumber <= unlockedLevel) {
            button.disabled = false;
            description.innerText = getLevelDescription(levelNumber);
        } else {
            button.disabled = true;
            description.innerText = 'Đã khóa: hãy đạt Level ' + levelNumber + ' khi chơi để mở';
        }
    }

    document.getElementById('level-' + startLevel + '-button').focus();
    draw();
}

function chooseLevel(levelNumber) {
    if (levelNumber > unlockedLevel) {
        return;
    }
    startLevel = levelNumber;
    startGame();
}

function startGame() {
    createEmptyBoard();
    score = 0;
    nextPieceType = '';
    enterLevel(startLevel);
    gameState = 'playing';
    spawnNextPiece();

    document.getElementById('level-menu').hidden = true;
    document.getElementById('game-over').hidden = true;
    document.getElementById('pause-menu').hidden = true;

    if (level > 1) {
        showBanner('Level ' + level);
    }
    draw();
}

function pauseGame() {
    if (gameState !== 'playing') {
        return;
    }

    gameState = 'paused';
    document.getElementById('pause-menu').hidden = false;
    document.getElementById('resume-button').focus();
    draw();
}

function resumeGame() {
    if (gameState !== 'paused') {
        return;
    }

    gameState = 'playing';
    document.getElementById('pause-menu').hidden = true;
    draw();
}

function restartGame() {
    if (gameState !== 'playing' && gameState !== 'paused') {
        return;
    }

    startGame();
}

function gameOver() {
    gameState = 'over';
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over').hidden = false;
    document.getElementById('again-button').focus();
}


// ===== LEVEL 2: HANG RAC =====

const GARBAGE = 8;
const PIECES_BEFORE_GARBAGE = 5;

function applyLevel2Rule(linesRemoved) {
    countPieceWithoutClear(linesRemoved);

    if (piecesWithoutClear === PIECES_BEFORE_GARBAGE) {
        piecesWithoutClear = 0;
        return addGarbageRow();
    }
    return true;
}

function addGarbageRow() {
    if (isRowEmpty(0) === false) {
        return false;
    }

    let garbageRow = [];
    let holeX = Math.floor(Math.random() * COLS);
    for (let x = 0; x < COLS; x++) {
        if (x === holeX) {
            garbageRow.push(EMPTY);
        } else {
            garbageRow.push(GARBAGE);
        }
    }

    board.shift();
    board.push(garbageRow);
    return true;
}


// ===== LEVEL 3: KHOI BOM =====

const BOMB = 'BOMB';
const PIECES_BEFORE_BOMB = 6;

let bombIsNext = false;

function applyLevel3Rule(linesRemoved) {
    countPieceWithoutClear(linesRemoved);

    if (piecesWithoutClear === PIECES_BEFORE_BOMB) {
        piecesWithoutClear = 0;
        bombIsNext = true;
    }
}

function explodeBomb() {
    let rowBelowBomb = pieceY + 2;
    clearArea2x2(pieceX, rowBelowBomb);
}


// ===== LEVEL 4: NANG LUONG VA KY NANG =====

const ENERGY_PER_LINE = 25;
const MAX_ENERGY = 100;
const BREAK_ROW_COOLDOWN = 20;
const EXPLODE_AREA_COOLDOWN = 30;

let energy = 0;
let breakRowCooldown = 0;
let explodeAreaCooldown = 0;
let selectedSkill = '';
let hoveredX = -1;
let hoveredY = -1;

function addEnergy(linesRemoved) {
    if (level !== 4) {
        return;
    }

    energy = energy + linesRemoved * ENERGY_PER_LINE;
    if (energy > MAX_ENERGY) {
        energy = MAX_ENERGY;
    }
}

function getCooldown(skill) {
    if (skill === 'row') {
        return breakRowCooldown;
    }
    return explodeAreaCooldown;
}

function canUseSkill(skill) {
    if (level !== 4) {
        return false;
    }
    if (gameState !== 'playing') {
        return false;
    }
    if (energy < MAX_ENERGY) {
        return false;
    }
    if (getCooldown(skill) > 0) {
        return false;
    }
    return true;
}

function useSkill(skill) {
    if (canUseSkill(skill) === false) {
        return;
    }

    selectedSkill = skill;
    gameState = 'choosing-target';

    if (skill === 'row') {
        document.getElementById('skill-hint').innerText = 'Bấm vào hàng muốn phá (Esc để hủy)';
    } else {
        document.getElementById('skill-hint').innerText = 'Bấm vào ô muốn nổ 2x2 (Esc để hủy)';
    }
    draw();
}

function cancelSkill() {
    gameState = 'playing';
    selectedSkill = '';
    document.getElementById('skill-hint').innerText = '';
    draw();
}

function clickCell(x, y) {
    if (gameState !== 'choosing-target') {
        return;
    }

    if (selectedSkill === 'row') {
        removeRow(y);
        breakRowCooldown = BREAK_ROW_COOLDOWN;
    } else {
        clearArea2x2(x, y);
        explodeAreaCooldown = EXPLODE_AREA_COOLDOWN;
    }

    energy = 0;
    movePieceUpUntilFree();
    cancelSkill();
}

function hoverCell(x, y) {
    hoveredX = x;
    hoveredY = y;
    draw();
}

function stopHover() {
    hoveredX = -1;
    hoveredY = -1;
    draw();
}

function reduceCooldowns() {
    if (breakRowCooldown > 0) {
        breakRowCooldown = breakRowCooldown - 1;
    }
    if (explodeAreaCooldown > 0) {
        explodeAreaCooldown = explodeAreaCooldown - 1;
    }
}

function drawSkillTarget() {
    if (gameState !== 'choosing-target' || hoveredX === -1) {
        return;
    }

    if (selectedSkill === 'row') {
        for (let x = 0; x < COLS; x++) {
            getBoardCell(x, hoveredY).className = 'cell target';
        }
    } else {
        let left = getAreaLeft(hoveredX);
        let top = getAreaTop(hoveredY);
        getBoardCell(left, top).className = 'cell target';
        getBoardCell(left + 1, top).className = 'cell target';
        getBoardCell(left, top + 1).className = 'cell target';
        getBoardCell(left + 1, top + 1).className = 'cell target';
    }
}

function drawSkillButton(buttonId, name, cooldown, skill) {
    let button = document.getElementById(buttonId);
    button.disabled = canUseSkill(skill) === false;

    if (cooldown > 0) {
        button.innerText = name + ' (' + cooldown + 's)';
    } else {
        button.innerText = name;
    }
}

function drawEnergyAndSkills() {
    let isLevel4 = level === 4;
    document.getElementById('energy-box').hidden = isLevel4 === false;
    document.getElementById('skill-box').hidden = isLevel4 === false;

    document.getElementById('energy-fill').style.width = energy + '%';
    document.getElementById('energy-text').innerText = energy + ' / ' + MAX_ENERGY;

    drawSkillButton('skill-row', 'Phá 1 hàng', breakRowCooldown, 'row');
    drawSkillButton('skill-area', 'Nổ 2x2', explodeAreaCooldown, 'area');
}


// ===== LEVEL 5: CONG DICH CHUYEN =====

function wrapColumn(x) {
    return (x % COLS + COLS) % COLS;
}

function getLeftmostColumn(shape) {
    for (let x = 0; x < shape.length; x++) {
        for (let y = 0; y < shape.length; y++) {
            if (shape[y][x] !== EMPTY) {
                return x;
            }
        }
    }
    return 0;
}

function getRightmostColumn(shape) {
    for (let x = shape.length - 1; x >= 0; x--) {
        for (let y = 0; y < shape.length; y++) {
            if (shape[y][x] !== EMPTY) {
                return x;
            }
        }
    }
    return shape.length - 1;
}

function tryTeleportPiece(direction) {
    if (level !== 5) {
        return false;
    }

    let isCurrentPlaceValid = canPlace(pieceShape, pieceX, pieceY);
    if (isCurrentPlaceValid === false) {
        return false;
    }

    let leftEdge = pieceX + getLeftmostColumn(pieceShape);
    let rightEdge = pieceX + getRightmostColumn(pieceShape);
    let newX = pieceX;

    if (direction === 'left') {
        if (leftEdge !== 0) {
            return false;
        }
        let newRightEdge = wrapColumn(leftEdge - 1);
        newX = newRightEdge - getRightmostColumn(pieceShape);
    } else {
        if (rightEdge !== COLS - 1) {
            return false;
        }
        let newLeftEdge = wrapColumn(rightEdge + 1);
        newX = newLeftEdge - getLeftmostColumn(pieceShape);
    }

    let isNewPlaceValid = canPlace(pieceShape, newX, pieceY);
    if (isNewPlaceValid === false) {
        return false;
    }

    pieceX = newX;
    return true;
}


// ===== BAN PHIM VA THOI GIAN =====

function handleKeyDown(event) {
    // level 4
    if (gameState === 'choosing-target' && event.code === 'Escape') {
        cancelSkill();
        return;
    }

    if (gameState === 'playing' && event.code === 'KeyP') {
        pauseGame();
        return;
    }
    if (gameState === 'paused' && (event.code === 'KeyP' || event.code === 'Escape')) {
        resumeGame();
        return;
    }

    if (gameState !== 'playing') {
        return;
    }

    let isCtrlEnter = event.ctrlKey && (event.code === 'Enter' || event.code === 'NumpadEnter');

    if (isCtrlEnter) {
        skipToNextLevel();
    } else if (event.code === 'KeyA') {
        moveLeft();
    } else if (event.code === 'KeyD') {
        moveRight();
    } else if (event.code === 'KeyS') {
        moveDown();
    } else if (event.code === 'Space') {
        event.preventDefault();
        rotatePiece();
    }
    draw();
}

function everySecond() {
    if (gameState !== 'playing') {
        return;
    }
    moveDown();
    reduceCooldowns(); // level 4
    draw();
}


// ===== CHAY GAME =====

document.addEventListener('keydown', handleKeyDown);
setInterval(everySecond, 1000);

loadUnlockedLevel();
createEmptyBoard();
createCells();
showMenu();
