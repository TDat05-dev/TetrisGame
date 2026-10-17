'use strict';

//CẤU HÌNH
const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL_MS = 1000;   // Tốc độ rơi: 1 giây / ô

//thêm điểm nếu như phá được nhiều khối cùng lúc
const LINE_CLEAR_SCORES = [0, 10, 30, 50, 100];

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
const PREVIEW_SIZE = 4;

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

// Trả về BẢN SAO của khối mẫu trong PIECES để không ai sửa nhầm vào khối mẫu
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

let nextPieceType = null;

// Trạng thái chung của ván chơi
const game = {
    score: 0,
    level: 1,
    isOver: false,
};

// reset trạng thái
function resetState() {
    arena.forEach(row => row.fill(0));
    player.pos.x = 0;
    player.pos.y = 0;
    player.matrix = null;
    nextPieceType = null;
    game.score = 0;
    game.level = 1;
    game.isOver = false;
}

//RENDERER

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
    next: getRequiredElement('next'),
    gameOver: getRequiredElement('game-over'),
    finalScore: getRequiredElement('final-score'),
    restartButton: getRequiredElement('restart-button'),
};

const boardCells = [];
const previewCells = [];

const frame = new Array(COLS * ROWS).fill(0);
const prevFrame = new Array(COLS * ROWS).fill(0);

const rendered = {
    score: null,
    level: null,
    nextType: null,
    isOver: null,
};

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

    // Tạo 16 ô cho lưới xem trước khối kế tiếp
    const previewFragment = document.createDocumentFragment();
    previewCells.length = 0;
    for (let i = 0; i < PREVIEW_SIZE * PREVIEW_SIZE; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.v = 0;
        previewFragment.appendChild(cell);
        previewCells.push(cell);
    }
    dom.next.replaceChildren(previewFragment);

    prevFrame.fill(0);
    rendered.score = null;
    rendered.level = null;
    rendered.nextType = null;
    rendered.isOver = null;
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

    // 3. Chỉ cập nhật DOM ở những ô khác với lần vẽ trước
    for (let i = 0; i < frame.length; i++) {
        if (frame[i] !== prevFrame[i]) {
            boardCells[i].dataset.v = frame[i];
            prevFrame[i] = frame[i];
        }
    }
}

// Vẽ khối kế tiếp vào lưới xem trước, căn giữa theo phần có màu của khối
function renderNextPreview() {
    if (nextPieceType === rendered.nextType) {
        return; // Khối kế tiếp chưa đổi -> không cần vẽ lại
    }
    rendered.nextType = nextPieceType;

    // Xóa trắng lưới
    for (let i = 0; i < previewCells.length; i++) {
        previewCells[i].dataset.v = 0;
    }
    if (nextPieceType === null) {
        return;
    }

    const matrix = PIECES[nextPieceType];

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

    const pieceWidth = maxX - minX + 1;
    const pieceHeight = maxY - minY + 1;
    const offsetX = Math.floor((PREVIEW_SIZE - pieceWidth) / 2) - minX;
    const offsetY = Math.floor((PREVIEW_SIZE - pieceHeight) / 2) - minY;

    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0) {
                const index = (y + offsetY) * PREVIEW_SIZE + (x + offsetX);
                previewCells[index].dataset.v = matrix[y][x];
            }
        }
    }
}

// Cập nhật điểm và level
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

// Ẩn/hiện popup Game Over theo game.isOver
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

function render() {
    renderBoard();
    renderNextPreview();
    renderHud();
    renderGameOver();
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
    if (nextPieceType === null) {
        nextPieceType = randomPieceType();
    }
    const currentType = nextPieceType;
    nextPieceType = randomPieceType();

    player.matrix = createPiece(currentType);
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    return !collide(arena, player);
}

// Bắt đầu ván mới: xoá sạch state rồi sinh khối đầu tiên
function startGame() {
    resetState();
    spawnPiece();
    dropCounter = 0;
}

// Kiểm tra một hàng đã được lấp đầy chưa (không còn ô nào bằng 0)
function isRowFull(row) {
    for (let x = 0; x < row.length; x++) {
        if (row[x] === 0) {
            return false;
        }
    }
    return true;
}
// Xóa tất cả các hàng đầy, các hàng phía trên dồn xuống. Trả về số hàng đã xóa.
function clearFullRows() {
    let clearedCount = 0;
    let y = ROWS - 1;

    while (y >= 0) {
        if (isRowFull(arena[y])) {
            const removedRow = arena.splice(y, 1)[0];// căt hàng đã full ra khỏi arena
            removedRow.fill(0); //fill hàm vừa cắt bằng số 0
            arena.unshift(removedRow);//đưa hàn vừa fill lên đầu
            clearedCount++;
        } else {
            y--;
        }
    }
    return clearedCount;
}

// Hạ khối xuống 1 ô. Nếu không hạ được: thêm khối vào arena, xóa hàng đầy rồi sinh khối mới.
function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        const clearedCount = clearFullRows();
        game.score += LINE_CLEAR_SCORES[clearedCount];

        if (!spawnPiece()) {
            game.isOver = true; // Khối mới không còn chỗ xuất hiện -> thua
        }
    }
    dropCounter = 0;
}
//Xử lý sự kiện bàn phím
window.addEventListener('keydown', function (event) {
    if (game.isOver) {
        return;
    }
    if (event.code === 'KeyA') {
        playerMove(-1);
    } else if (event.code === 'KeyD') {
        playerMove(1);
    } else if (event.code === 'KeyS') {
        playerDrop(); // Có kiểm tra va chạm, chạm đáy thì chốt khối
    } else if (event.code === 'Space') {
        playerRotate();
    } else {
        return;
    }

    event.preventDefault();
});

// Di chuyển khối sang trái phải
function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

//xoay khối bằng cách xoay ma trận
function rotateBlock(matrix) {
    const size = matrix.length;
    const res = createMatrix(size,size);
    for(let y =0 ; y< size;y++){
        for(let x =0; x <size;x++){
            res[y][x]=matrix[size-1-x][y];
        }
    }
    return res;
}
const WALL_KICK_OFFSETS = [0, 1, -1, 2, -2];

function playerRotate(){
    if(player.matrix=== null){
        return;
    }
    const originalMatrix = player.matrix;
        const originalX = player.pos.x;
        player.matrix = rotateBlock(originalMatrix);

        for (let i = 0; i < WALL_KICK_OFFSETS.length; i++) {
            player.pos.x = originalX + WALL_KICK_OFFSETS[i];
            if (!collide(arena, player)) {
                return;
            }
        }
        player.matrix = originalMatrix;
        player.pos.x = originalX;
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

    // khi thua, dừng rơi khối
    if (!game.isOver) {
        dropCounter += deltaTime;
        if (dropCounter >= DROP_INTERVAL_MS) {
            playerDrop();
        }
    }

    render();
    requestAnimationFrame(update);
}

// Nút "Chơi lại" trong popup Game Over
dom.restartButton.addEventListener('click', function () {
    startGame();
    render();
});

initRenderer();
startGame();
render();
requestAnimationFrame(update);
