'use strict';

//CẤU HÌNH
const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL_MS = 1000;   // Tốc độ rơi: 1 giây / ô


// Hình dạng các khối. Giá trị số = id màu (ánh xạ sang --c1..--c7 trong style.css)
const PIECES = Object.freeze({
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
});
const PIECE_TYPES = Object.keys(PIECES);

//UTILITY

// Trả về số nguyên ngẫu nhiên trong khoảng [0, max - 1] để khởi tạo khối
function randomInt(max) {
    if (!Number.isInteger(max) || max <= 0) {
        throw new RangeError(`randomInt: max phải là số nguyên dương, nhận được ${max}`);
    }
    return Math.floor(Math.random() * max);
}

// Tạo ma trận width x height toàn số 0 (0 = ô trống)
function createMatrix(width, height) {
    return Array.from({ length: height }, () => new Array(width).fill(0));
}

// Trả về BẢN SAO của khối mẫu trong PIECES (hàm xoay sau này sẽ sửa ma trận tại chỗ)
function createPiece(type) {
    const template = PIECES[type];
    if (!template) {
        throw new Error(`createPiece: không có khối loại "${type}"`);
    }
    return template.map(row => [...row]);
}

function randomPieceType() {
    return PIECE_TYPES[randomInt(PIECE_TYPES.length)];
}

//STATE
// tạo bàn chơi
const arena = createMatrix(COLS, ROWS);

// Khối đang rơi
const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
};

// Trạng thái chung của ván chơi
const game = {
    score: 0,
    level: 1,
};

// reset trạng thái
function resetState() {
    arena.forEach(row => row.fill(0));
    player.pos.x = 0;
    player.pos.y = 0;
    player.matrix = null;
    game.score = 0;
    game.level = 1;
    game.flipped = false;
}

//RENDERER
// Renderer

function getRequiredElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Renderer: không tìm thấy phần tử #${id} trong index.html`);
    }
    return element;
}

const dom = {
    board: getRequiredElement('board'),
    score: getRequiredElement('score'),
    level: getRequiredElement('level'),
    banner: getRequiredElement('level-banner'),
};

const boardCells = [];

const frame = new Array(COLS * ROWS).fill(0);
const prevFrame = new Array(COLS * ROWS).fill(0);

const rendered = {
    score: null,
    level: null,
    flipped: null,
};

let bannerTimer = null;

function initRenderer() {
    const fragment = document.createDocumentFragment();
    boardCells.length = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.v = 0;
        fragment.appendChild(cell);
        boardCells.push(cell);
    }
    dom.board.replaceChildren(fragment);

    prevFrame.fill(0);
    rendered.score = null;
    rendered.level = null;
    rendered.flipped = null;
}

function renderBoard() {
    // 1. Chép các khối đã đặt từ arena vào frame
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            frame[y * COLS + x] = arena[y][x];
        }
    }

    // 2. Chồng khối đang rơi lên trên, bỏ qua phần nằm ngoài bàn chơi
    if (player.matrix) {
        player.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                const ax = x + player.pos.x;
                const ay = y + player.pos.y;
                if (value !== 0 && ax >= 0 && ax < COLS && ay >= 0 && ay < ROWS) {
                    frame[ay * COLS + ax] = value;
                }
            });
        });
    }

    // 3. Diff: chỉ cập nhật DOM ở những ô khác với lần vẽ trước
    for (let i = 0; i < frame.length; i++) {
        if (frame[i] !== prevFrame[i]) {
            boardCells[i].dataset.v = frame[i];
            prevFrame[i] = frame[i];
        }
    }
}

// Cập nhật điểm, level và trạng thái lật màn hình
function renderHud() {
    if (game.score !== rendered.score) {
        dom.score.textContent = game.score;
        rendered.score = game.score;
    }
    if (game.level !== rendered.level) {
        dom.level.textContent = game.level;
        rendered.level = game.level;
    }
    if (game.flipped !== rendered.flipped) {
        dom.board.classList.toggle('is-flipped', game.flipped);
        rendered.flipped = game.flipped;
    }
}

function render() {
    renderBoard();
    renderHud();
}

//LOGIC: KHỐI RƠI
// Kiểm tra khối của player ở vị trí hiện tại có đè lên tường, đáy hoặc khối đã đặt không
function collide(arena, player) {
    const { matrix, pos } = player;
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] === 0) continue; // Ô trống trong ma trận khối thì không tính

            const ax = x + pos.x;
            const ay = y + pos.y;
            if (ax < 0 || ax >= COLS || ay >= ROWS) return true; // Ra ngoài tường trái/phải hoặc thủng đáy
            if (ay < 0) continue;                                  // Phía trên đỉnh: chưa vào bàn chơi
            if (arena[ay][ax] !== 0) return true;                  // Đè lên khối đã đặt
        }
    }
    return false;
}

// Ghi khối đang rơi vào arena khi nó đã chạm đáy hoặc chạm khối khác
function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            const ay = y + player.pos.y;
            if (value !== 0 && ay >= 0) {
                arena[ay][x + player.pos.x] = value;
            }
        });
    });
}

// Sinh khối ngẫu nhiên ở giữa đỉnh bàn chơi. Trả về false nếu vừa sinh ra đã va chạm (thua).
function spawnPiece() {
    player.matrix = createPiece(randomPieceType());
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    return !collide(arena, player);
}

// Bắt đầu ván mới: xoá sạch state rồi sinh khối đầu tiên
function startGame() {
    resetState();
    spawnPiece();
}

// Hạ khối xuống 1 ô. Nếu không hạ được: thêm khối vào arena rồi sinh khối mới.
function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        if (!spawnPiece()) {
            startGame();
        }
    }
    dropCounter = 0;
}
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (key === 'a') {
        playerMove(-1);
    } else if (key === 'd') {
        playerMove(1);
    } else if(key === 's'){
        player.pos.y++;
    }

});

// Di chuyển khối sang trái phải
function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

//GAME LOOP
let dropCounter = 0;
let lastTime = null;

function update(time) {
    if (lastTime === null) {
        lastTime = time;
    }
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter >= DROP_INTERVAL_MS) {
        playerDrop();
    }

    render();
    requestAnimationFrame(update);
}

initRenderer();
startGame();
render();
requestAnimationFrame(update);
