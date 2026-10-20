'use strict';

// ===== CAU HINH =====
const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL_MS = 1000; // 1 giây rơi 1 ô

// điểm khi phá 0, 1, 2, 3, 4 hàng cùng lúc
const LINE_CLEAR_SCORES = [0, 10, 30, 50, 100];

// level 2
const LEVEL_2_SCORE = 100;
const GARBAGE_PIECE_LIMIT = 5; // đặt 5 khối không phá được hàng nào thì thêm hàng rác
const GARBAGE_BLOCK = 8;       // màu ô rác
const BANNER_DURATION_MS = 2000;

// level 3
const LEVEL_3_SCORE = 250;
const BOMB_PIECE_LIMIT = 6;    // đặt 6 khối không phá được hàng nào thì cho khối bom
const BOMB_TYPE = 'BOMB';

// các khối, số là màu của khối (--c1 đến --c9 trong css)
const PIECES = {
    I: [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
    ],
    L: [
        [0, 2, 0],
        [0, 2, 0],
        [0, 2, 2],
    ],
    J: [
        [0, 3, 0],
        [0, 3, 0],
        [3, 3, 0],
    ],
    O: [
        [4, 4],
        [4, 4],
    ],
    Z: [
        [5, 5, 0],
        [0, 5, 5],
        [0, 0, 0],
    ],
    S: [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0],
    ],
    T: [
        [0, 7, 0],
        [7, 7, 7],
        [0, 0, 0],
    ],
    // khối bom của level 3
    BOMB: [
        [9, 9],
        [9, 9],
    ],
};

// các khối được random (không có bom)
const PIECE_TYPES = ['I', 'L', 'J', 'O', 'Z', 'S', 'T'];
const PREVIEW_SIZE = 4;

// ===== HAM PHU =====

// random số từ 0 đến max - 1
function randomInt(max) {
    return Math.floor(Math.random() * max);
}

// tạo ma trận toàn số 0
function createMatrix(width, height) {
    const matrix = [];
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            row.push(0);
        }
        matrix.push(row);
    }
    return matrix;
}

// copy khối từ PIECES ra để không bị sửa vào khối gốc
function createPiece(type) {
    const piece = PIECES[type];
    const copy = [];
    for (let y = 0; y < piece.length; y++) {
        copy.push(piece[y].slice());
    }
    return copy;
}

function randomPieceType() {
    return PIECE_TYPES[randomInt(PIECE_TYPES.length)];
}

// ===== DU LIEU GAME =====
const arena = createMatrix(COLS, ROWS); // bàn chơi

// khối đang rơi
const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    type: null, // tên khối, dùng để biết có phải bom không
};

let nextPieceType = null; // khối tiếp theo

const game = {
    score: 0,
    level: 1,
    isOver: false,
    isInMenu: true,           // đang ở màn chọn level
    startLevel: 1,            // level đã chọn, để bấm chơi lại
    pendingSpecialPiece: null // khối đặc biệt (bom) sẽ làm khối tiếp theo
};

function resetState() {
    for (let y = 0; y < ROWS; y++) {
        arena[y].fill(0);
    }
    player.pos.x = 0;
    player.pos.y = 0;
    player.matrix = null;
    player.type = null;
    nextPieceType = null;
    game.score = 0;
    game.level = 1;
    game.isOver = false;
    game.pendingSpecialPiece = null;
    // không reset startLevel vì nút chơi lại cần dùng
}

// ===== MO KHOA LEVEL =====
// lưu level cao nhất đã chơi tới vào localStorage
const UNLOCKED_LEVEL_STORAGE_KEY = 'tetris.unlockedLevel';
let unlockedLevel = 1;

function loadUnlockedLevel() {
    let level = 1;
    try {
        level = Number(localStorage.getItem(UNLOCKED_LEVEL_STORAGE_KEY));
    } catch (e) {
        return 1;
    }
    // nếu giá trị bị sai thì cho về level 1
    if (!Number.isInteger(level) || level < 1 || level > LEVELS.length) {
        return 1;
    }
    return level;
}

function unlockLevel(level) {
    if (level <= unlockedLevel) {
        return;
    }
    unlockedLevel = level;
    try {
        localStorage.setItem(UNLOCKED_LEVEL_STORAGE_KEY, level);
    } catch (e) {
        // không lưu được thì thôi
    }
}

function isLevelUnlocked(level) {
    return level <= unlockedLevel;
}

// ===== VE GIAO DIEN =====
const dom = {
    board: document.getElementById('board'),
    score: document.getElementById('score'),
    level: document.getElementById('level'),
    next: document.getElementById('next'),
    gameOver: document.getElementById('game-over'),
    finalScore: document.getElementById('final-score'),
    restartButton: document.getElementById('restart-button'),
    banner: document.getElementById('level-banner'),
    levelMenu: document.getElementById('level-menu'),
    levelList: document.getElementById('level-list'),
    menuButton: document.getElementById('menu-button'),
};

const boardCells = [];
const previewCells = [];

// frame là hình sắp vẽ, prevFrame là hình đang hiện trên màn hình
const frame = [];
const prevFrame = [];
for (let i = 0; i < COLS * ROWS; i++) {
    frame.push(0);
    prevFrame.push(0);
}

// lưu lại giá trị đã vẽ, cái nào không đổi thì không vẽ lại
const rendered = {
    score: null,
    level: null,
    nextType: null,
    isOver: null,
    isInMenu: null,
};

// tạo các ô div cho bàn chơi và ô khối tiếp theo
function initRenderer() {
    dom.board.innerHTML = '';
    boardCells.length = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.v = 0;
        dom.board.appendChild(cell);
        boardCells.push(cell);
    }

    dom.next.innerHTML = '';
    previewCells.length = 0;
    for (let i = 0; i < PREVIEW_SIZE * PREVIEW_SIZE; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.v = 0;
        dom.next.appendChild(cell);
        previewCells.push(cell);
    }

    prevFrame.fill(0);
    rendered.score = null;
    rendered.level = null;
    rendered.nextType = null;
    rendered.isOver = null;
    rendered.isInMenu = null;
}

function renderBoard() {
    // chép bàn chơi vào frame
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            frame[y * COLS + x] = arena[y][x];
        }
    }

    // vẽ thêm khối đang rơi
    if (player.matrix !== null) {
        for (let y = 0; y < player.matrix.length; y++) {
            for (let x = 0; x < player.matrix[y].length; x++) {
                const value = player.matrix[y][x];
                const ax = x + player.pos.x;
                const ay = y + player.pos.y;
                if (value !== 0 && ax >= 0 && ax < COLS && ay >= 0 && ay < ROWS) {
                    frame[ay * COLS + ax] = value;
                }
            }
        }
    }

    // chỉ sửa những ô bị thay đổi
    for (let i = 0; i < frame.length; i++) {
        if (frame[i] !== prevFrame[i]) {
            boardCells[i].dataset.v = frame[i];
            prevFrame[i] = frame[i];
        }
    }
}

// vẽ khối tiếp theo vào ô 4x4
function renderNextPreview() {
    if (nextPieceType === rendered.nextType) {
        return;
    }
    rendered.nextType = nextPieceType;

    for (let i = 0; i < previewCells.length; i++) {
        previewCells[i].dataset.v = 0;
    }
    if (nextPieceType === null) {
        return;
    }

    const matrix = PIECES[nextPieceType];

    // tìm phần có màu của khối để canh giữa
    let minX = matrix.length;
    let maxX = -1;
    let minY = matrix.length;
    let maxY = -1;
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const offsetX = Math.floor((PREVIEW_SIZE - width) / 2) - minX;
    const offsetY = Math.floor((PREVIEW_SIZE - height) / 2) - minY;

    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0) {
                const index = (y + offsetY) * PREVIEW_SIZE + (x + offsetX);
                previewCells[index].dataset.v = matrix[y][x];
            }
        }
    }
}

// cập nhật điểm và level
function renderHud() {
    if (game.score !== rendered.score) {
        dom.score.textContent = game.score;
        rendered.score = game.score;
    }
    if (game.level !== rendered.level) {
        dom.level.textContent = game.level;
        rendered.level = game.level;
    }
}

// hiện / ẩn popup game over
function renderGameOver() {
    if (game.isOver === rendered.isOver) {
        return;
    }
    rendered.isOver = game.isOver;

    dom.gameOver.hidden = !game.isOver;
    if (game.isOver) {
        dom.finalScore.textContent = game.score;
        dom.restartButton.focus();
    }
}

// hiện thông báo rồi 2 giây sau tắt
function showBanner(message) {
    dom.banner.textContent = message;
    dom.banner.classList.add('is-visible');

    setTimeout(function () {
        dom.banner.classList.remove('is-visible');
    }, BANNER_DURATION_MS);
}

// hiện / ẩn màn chọn level
function renderLevelMenu() {
    if (game.isInMenu === rendered.isInMenu) {
        return;
    }
    rendered.isInMenu = game.isInMenu;

    dom.levelMenu.hidden = !game.isInMenu;
    if (game.isInMenu) {
        updateLevelLocks();
        const buttons = dom.levelList.querySelectorAll('button');
        buttons[game.startLevel - 1].focus();
    }
}

// khóa các level chưa chơi tới
function updateLevelLocks() {
    const buttons = dom.levelList.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
        const levelNumber = i + 1;
        const desc = buttons[i].querySelector('.level-option-desc');

        if (isLevelUnlocked(levelNumber)) {
            buttons[i].disabled = false;
            desc.textContent = LEVELS[i].description;
        } else {
            buttons[i].disabled = true;
            desc.textContent = 'Đã khóa: hãy đạt Level ' + levelNumber + ' khi chơi để mở';
        }
    }
}

function render() {
    renderBoard();
    renderNextPreview();
    renderHud();
    renderGameOver();
    renderLevelMenu();
}

// ===== XU LY KHOI =====

// kiểm tra khối có đụng tường, đáy hoặc khối khác không
function collide(arena, player) {
    const matrix = player.matrix;
    const pos = player.pos;
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] === 0) {
                continue;
            }
            const ax = x + pos.x;
            const ay = y + pos.y;
            if (ax < 0 || ax >= COLS || ay >= ROWS) {
                return true; // ra ngoài tường hoặc dưới đáy
            }
            if (ay < 0) {
                continue; // còn ở trên bàn chơi thì bỏ qua
            }
            if (arena[ay][ax] !== 0) {
                return true; // đụng khối khác
            }
        }
    }
    return false;
}

// ghi khối vào bàn chơi khi chạm đáy
function merge(arena, player) {
    for (let y = 0; y < player.matrix.length; y++) {
        for (let x = 0; x < player.matrix[y].length; x++) {
            const value = player.matrix[y][x];
            const ay = y + player.pos.y;
            if (value !== 0 && ay >= 0) {
                arena[ay][x + player.pos.x] = value;
            }
        }
    }
}

// tạo khối mới ở giữa phía trên, trả về false nếu không còn chỗ (thua)
function spawnPiece() {
    if (nextPieceType === null) {
        nextPieceType = randomPieceType();
    }
    const currentType = nextPieceType;

    // nếu có bom đang chờ thì cho bom làm khối tiếp theo
    if (game.pendingSpecialPiece !== null) {
        nextPieceType = game.pendingSpecialPiece;
        game.pendingSpecialPiece = null;
    } else {
        nextPieceType = randomPieceType();
    }

    player.type = currentType;
    player.matrix = createPiece(currentType);
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    return !collide(arena, player);
}

// bắt đầu chơi ở level đã chọn
function startGame(startLevel) {
    resetState();
    game.startLevel = startLevel;
    game.level = startLevel;
    game.isInMenu = false;
    LEVELS[startLevel - 1].onEnter();

    spawnPiece();
    dropCounter = 0;
    if (startLevel > 1) {
        showBanner('Level ' + startLevel);
    }
}

// quay lại màn chọn level
function openLevelMenu() {
    resetState();
    game.isInMenu = true;
}

// kiểm tra hàng đã đầy chưa
function isRowFull(row) {
    for (let x = 0; x < row.length; x++) {
        if (row[x] === 0) {
            return false;
        }
    }
    return true;
}

// xóa các hàng đầy, trả về số hàng đã xóa
function clearFullRows() {
    let clearedCount = 0;
    let y = ROWS - 1;

    while (y >= 0) {
        if (isRowFull(arena[y])) {
            const removedRow = arena.splice(y, 1)[0]; // cắt hàng đầy ra
            removedRow.fill(0);                       // làm trống hàng đó
            arena.unshift(removedRow);                // đưa lên trên cùng
            clearedCount++;
            // không giảm y vì hàng phía trên vừa rớt xuống vị trí y
        } else {
            y--;
        }
    }
    return clearedCount;
}

// ===== CAC LEVEL =====
// mỗi level có: minScore (điểm để lên level), onEnter (chạy khi vào level),
// onPiecePlaced (chạy mỗi lần đặt khối, trả về false nếu thua)

// level 1: chơi bình thường
const level1 = {
    name: 'Level 1',
    description: 'Chơi cơ bản',
    minScore: 0,

    onEnter: function () {
    },

    onPiecePlaced: function (clearedCount) {
        return true;
    },
};

// level 2: đặt 5 khối mà không phá được hàng nào thì thêm 1 hàng rác
const level2 = {
    name: 'Level 2',
    description: 'Cứ ' + GARBAGE_PIECE_LIMIT + ' khối không phá hàng thì trồi 1 hàng rác',
    minScore: LEVEL_2_SCORE,
    quantityOfBlocks: 0, // đếm số khối đã đặt mà chưa phá hàng

    onEnter: function () {
        level2.quantityOfBlocks = 0;
    },

    onPiecePlaced: function (clearedCount) {
        if (clearedCount > 0) {
            level2.quantityOfBlocks = 0;
            return true;
        }

        level2.quantityOfBlocks++;
        if (level2.quantityOfBlocks >= GARBAGE_PIECE_LIMIT) {
            level2.quantityOfBlocks = 0;
            return addGarbageRow();
        }
        return true;
    },
};

// thêm 1 hàng rác ở dưới cùng, có 1 lỗ random
// trả về false nếu hàng trên cùng có khối (bị đẩy ra ngoài => thua)
function addGarbageRow() {
    // phải kiểm tra trước khi lấy hàng ra, không thì bàn chơi bị thiếu 1 hàng
    for (let x = 0; x < COLS; x++) {
        if (arena[0][x] !== 0) {
            return false;
        }
    }

    // lấy hàng trên cùng ra làm hàng rác rồi đưa xuống dưới
    const row = arena.shift();
    const hole = randomInt(COLS);
    for (let x = 0; x < COLS; x++) {
        if (x === hole) {
            row[x] = 0;
        } else {
            row[x] = GARBAGE_BLOCK;
        }
    }
    arena.push(row);
    return true;
}

// level 3: đặt 6 khối mà không phá được hàng nào thì khối tiếp theo là bom
const level3 = {
    name: 'Level 3',
    description: 'Cứ ' + BOMB_PIECE_LIMIT + ' khối không phá hàng thì tặng 1 khối nổ',
    minScore: LEVEL_3_SCORE,
    quantityOfBlocks: 0,

    onEnter: function () {
        level3.quantityOfBlocks = 0;
    },

    onPiecePlaced: function (clearedCount) {
        if (clearedCount > 0) {
            level3.quantityOfBlocks = 0;
            return true;
        }

        level3.quantityOfBlocks++;
        if (level3.quantityOfBlocks >= BOMB_PIECE_LIMIT) {
            level3.quantityOfBlocks = 0;
            game.pendingSpecialPiece = BOMB_TYPE;
        }
        return true;
    },
};

// bom nổ: xóa 2x2 ô ngay dưới bom, bom không được ghi vào bàn chơi
function explodeBomb() {
    const size = player.matrix.length;
    const startY = player.pos.y + size;
    for (let y = startY; y < startY + size; y++) {
        for (let x = player.pos.x; x < player.pos.x + size; x++) {
            if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
                arena[y][x] = 0;
            }
        }
    }
}

const LEVELS = [level1, level2, level3];

function getCurrentLevel() {
    return LEVELS[game.level - 1];
}

// đủ điểm thì lên level tiếp theo
function checkLevelUp() {
    const nextLevel = LEVELS[game.level]; // level hiện tại là game.level - 1 nên level sau là game.level
    if (nextLevel === undefined) {
        return; // đang ở level cuối
    }
    if (game.score >= nextLevel.minScore) {
        game.level++;
        nextLevel.onEnter();
        unlockLevel(game.level);
        showBanner('Level Up');
    }
}

// cho khối rơi xuống 1 ô, chạm đáy thì xử lý rồi tạo khối mới
function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;

        if (player.type === BOMB_TYPE) {
            explodeBomb();
        } else {
            merge(arena, player);
        }

        const clearedCount = clearFullRows();
        game.score += LINE_CLEAR_SCORES[clearedCount];
        checkLevelUp();

        // chạy luật của level hiện tại trước rồi mới tạo khối mới
        if (!getCurrentLevel().onPiecePlaced(clearedCount)) {
            game.isOver = true;
        } else if (!spawnPiece()) {
            game.isOver = true;
        }
    }
    dropCounter = 0;
}

// ===== BAN PHIM =====
window.addEventListener('keydown', function (event) {
    // đang thua hoặc ở menu thì không điều khiển
    if (game.isOver || game.isInMenu) {
        return;
    }
    if (event.code === 'KeyA') {
        playerMove(-1);
    } else if (event.code === 'KeyD') {
        playerMove(1);
    } else if (event.code === 'KeyS') {
        playerDrop();
    } else if (event.code === 'Space') {
        playerRotate();
    } else {
        return;
    }
    event.preventDefault(); // để space không cuộn trang
});

// di chuyển trái phải
function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

// xoay ma trận 90 độ
function rotateBlock(matrix) {
    const size = matrix.length;
    const res = createMatrix(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            res[y][x] = matrix[size - 1 - x][y];
        }
    }
    return res;
}

// khi xoay bị kẹt thì thử dịch sang trái phải
const WALL_KICK_OFFSETS = [0, 1, -1, 2, -2];

function playerRotate() {
    if (player.matrix === null) {
        return;
    }
    const oldMatrix = player.matrix;
    const oldX = player.pos.x;
    player.matrix = rotateBlock(oldMatrix);

    for (let i = 0; i < WALL_KICK_OFFSETS.length; i++) {
        player.pos.x = oldX + WALL_KICK_OFFSETS[i];
        if (!collide(arena, player)) {
            return;
        }
    }
    // không xoay được thì trả lại như cũ
    player.matrix = oldMatrix;
    player.pos.x = oldX;
}

// ===== GAME LOOP =====
let dropCounter = 0;
let lastTime = null;

function update(time) {
    if (lastTime === null) {
        lastTime = time;
    }
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!game.isOver && !game.isInMenu) {
        dropCounter += deltaTime;
        if (dropCounter >= DROP_INTERVAL_MS) {
            playerDrop();
        }
    }

    render();
    requestAnimationFrame(update);
}

// ===== MENU CHON LEVEL =====
// tạo nút cho từng level trong LEVELS
function initLevelMenu() {
    dom.levelList.innerHTML = '';
    for (let i = 0; i < LEVELS.length; i++) {
        const levelNumber = i + 1;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level-option';

        const title = document.createElement('span');
        title.className = 'level-option-title';
        title.textContent = LEVELS[i].name;

        const desc = document.createElement('span');
        desc.className = 'level-option-desc';
        desc.textContent = LEVELS[i].description;

        button.appendChild(title);
        button.appendChild(desc);
        button.addEventListener('click', function () {
            if (!isLevelUnlocked(levelNumber)) {
                return;
            }
            startGame(levelNumber);
            render();
        });
        dom.levelList.appendChild(button);
    }
}

// nút chơi lại
dom.restartButton.addEventListener('click', function () {
    startGame(game.startLevel);
    render();
});

// nút chọn màn
dom.menuButton.addEventListener('click', function () {
    openLevelMenu();
    render();
});

// ===== CHAY GAME =====
unlockedLevel = loadUnlockedLevel();
initRenderer();
initLevelMenu();
render();
requestAnimationFrame(update);
