'use strict';

//CẤU HÌNH
const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL_MS = 1000;   // Tốc độ rơi: 1 giây / ô

//thêm điểm nếu như phá được nhiều khối cùng lúc
const LINE_CLEAR_SCORES = [0, 10, 30, 50, 100];

// LEVEL 2
const LEVEL_2_SCORE = 100;        // Đạt từ 100 điểm trở lên thì lên Level 2
const GARBAGE_PIECE_LIMIT = 5;    // Level 2: đặt đủ 5 khối mà chưa phá hàng nào thì tạo 1 hàng rác
const GARBAGE_BLOCK = 8;          // id màu của ô rác
const BANNER_DURATION_MS = 2000;

// LEVEL 3
const LEVEL_3_SCORE = 250;        // Đạt từ 250 điểm trở lên thì lên Level 3
const BOMB_PIECE_LIMIT = 6;       // Level 3: đặt đủ 6 khối mà chưa phá hàng nào thì khối kế tiếp là khối nổ
const BOMB_TYPE = 'BOMB';         // Tên loại của khối nổ trong PIECES

// Hình dạng các khối. Giá trị số = id màu (ánh xạ sang --c1..--c9 trong <style> của index.html)
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
    // Khối nổ của Level 3: không bao giờ được chọn ngẫu nhiên, chỉ xuất hiện khi Level 3 yêu cầu
    BOMB: [
        [9, 9],
        [9, 9],
    ],
});
// Các loại khối thường được chọn ngẫu nhiên khi spawn (KHÔNG gồm khối nổ)
const PIECE_TYPES = ['I', 'L', 'J', 'O', 'Z', 'S', 'T'];
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
    type: null, // Loại khối đang rơi ('I', 'T', 'BOMB'...), dùng để biết có phải khối nổ không
};

let nextPieceType = null;

// Trạng thái chung của ván chơi
const game = {
    score: 0,
    level: 1,
    isOver: false,
    isInMenu: true,             // true khi đang ở màn hình chọn màn: game chưa chạy
    startLevel: 1,              // Level người chơi đã chọn để bắt đầu, dùng lại khi bấm "Chơi lại"
    pendingSpecialPiece: null,  // Khối đặc biệt (vd khối nổ) được xếp làm khối kế tiếp ở lần spawn sau
};

// reset trạng thái
function resetState() {
    arena.forEach(row => row.fill(0));
    player.pos.x = 0;
    player.pos.y = 0;
    player.matrix = null;
    player.type = null;
    nextPieceType = null;
    game.score = 0;
    game.level = 1;
    game.isOver = false;
    game.pendingSpecialPiece = null;
    // KHÔNG reset game.startLevel: cần giữ lại để "Chơi lại" đúng màn đã chọn
}

// MỞ KHÓA LEVEL
// Level cao nhất người chơi đã đạt tới. Chỉ được chọn các level <= giá trị này.
// Lưu vào localStorage để tắt trình duyệt mở lại vẫn còn.
const UNLOCKED_LEVEL_STORAGE_KEY = 'tetris.unlockedLevel';
let unlockedLevel = 1; // Giá trị thật được đọc từ localStorage lúc khởi chạy (loadUnlockedLevel)

// Đọc level đã mở khóa. Dữ liệu sai/không đọc được thì coi như mới chỉ mở Level 1.
function loadUnlockedLevel() {
    let saved = null;
    try {
        saved = localStorage.getItem(UNLOCKED_LEVEL_STORAGE_KEY);
    } catch (error) {
        return 1; // Trình duyệt chặn localStorage (chế độ ẩn danh, chặn cookie...)
    }

    const level = Number(saved);
    // localStorage có thể bị sửa tay: chỉ chấp nhận số nguyên trong khoảng 1..số level hiện có
    if (!Number.isInteger(level) || level < 1 || level > LEVELS.length) {
        return 1;
    }
    return level;
}

// Mở khóa level mới (chỉ tăng, không bao giờ giảm) và lưu lại
function unlockLevel(level) {
    if (level <= unlockedLevel) {
        return;
    }
    unlockedLevel = level;
    try {
        localStorage.setItem(UNLOCKED_LEVEL_STORAGE_KEY, String(level));
    } catch (error) {
        // Không lưu được thì vẫn mở khóa trong lần chơi này, chỉ mất khi tải lại trang
    }
}

function isLevelUnlocked(level) {
    return level <= unlockedLevel;
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
    banner: getRequiredElement('level-banner'),
    levelMenu: getRequiredElement('level-menu'),
    levelList: getRequiredElement('level-list'),
    menuButton: getRequiredElement('menu-button'),
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
    isInMenu: null,
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
    rendered.isInMenu = null;
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
//Hiển thị Banner lên level
function showBanner(message) {
    dom.banner.textContent = message;
    dom.banner.classList.add('is-visible');

    setTimeout(function () {
        dom.banner.classList.remove('is-visible');
    }, BANNER_DURATION_MS);
}

// Ẩn/hiện màn hình chọn màn theo game.isInMenu
function renderLevelMenu() {
    if (game.isInMenu === rendered.isInMenu) {
        return;
    }
    rendered.isInMenu = game.isInMenu;

    dom.levelMenu.hidden = !game.isInMenu;
    if (game.isInMenu) {
        updateLevelLocks(); // Vừa chơi xong có thể đã mở khóa thêm level
        // Focus vào nút của màn đã chọn lần trước để bấm Enter/Space là vào chơi luôn
        const buttons = dom.levelList.querySelectorAll('button');
        buttons[game.startLevel - 1].focus();
    }
}

// Khóa/mở các nút chọn màn theo unlockedLevel
function updateLevelLocks() {
    const buttons = dom.levelList.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i++) {
        const levelNumber = i + 1;
        const locked = !isLevelUnlocked(levelNumber);
        const description = buttons[i].querySelector('.level-option-desc');

        buttons[i].disabled = locked; // Nút disabled: không click được, không focus được bằng Tab
        if (locked) {
            description.textContent = `Đã khóa: hãy đạt Level ${levelNumber} khi chơi để mở`;
        } else {
            description.textContent = LEVELS[i].description;
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

    // Có khối đặc biệt đang chờ (vd Level 3 yêu cầu khối nổ) thì cho nó làm khối kế tiếp,
    // để người chơi thấy trước ở ô TIẾP THEO. Không có thì chọn ngẫu nhiên như bình thường.
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

// Bắt đầu ván mới ở level được chọn: xoá sạch state, vào level đó rồi sinh khối đầu tiên
function startGame(startLevel) {
    if (!Number.isInteger(startLevel) || startLevel < 1 || startLevel > LEVELS.length) {
        throw new RangeError(`startGame: level phải từ 1 đến ${LEVELS.length}, nhận được ${startLevel}`);
    }

    resetState();
    game.startLevel = startLevel;
    game.level = startLevel;
    game.isInMenu = false;
    LEVELS[startLevel - 1].onEnter(); // Khởi tạo dữ liệu riêng của level bắt đầu

    spawnPiece();
    dropCounter = 0;
    if (startLevel > 1) {
        showBanner(`Level ${startLevel}`);
    }
}

// Quay về màn hình chọn màn
function openLevelMenu() {
    resetState();
    game.isInMenu = true;
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

// ===================== LOGIC: LEVEL =====================
// Mỗi level là một object riêng, có cùng 3 thành phần:
//minScore: điểm tối thiểu để vào level này
//onEnter: chạy 1 lần khi vừa vào level (khởi tạo dữ liệu riêng, hiện thông báo...)
//onPiecePlaced : chạy mỗi khi 1 khối được chốt xuống bàn chơi, nhận số hàng vừa phá.
//Trả về false nếu luật của level làm người chơi thua.

// Level 1: chơi bình thường, không có luật thêm
const level1 = {
    name: 'Level 1',
    description: 'Chơi cơ bản',
    minScore: 0,
    onEnter: function () {
        // Level 1 không có gì cần khởi tạo
    },

    onPiecePlaced: function (clearedCount) {
        return true;
    },
};

// Level 2: đặt đủ GARBAGE_PIECE_LIMIT (số khối đã đặt) khối mà chưa phá hàng nào thì spawn 1 hàng rác
const level2 = {
    name: 'Level 2',
    description: `Cứ ${GARBAGE_PIECE_LIMIT} khối không phá hàng thì trồi 1 hàng rác`,
    minScore: LEVEL_2_SCORE,

    //số khối đã đặt liên tiếp mà chưa phá được hàng nào
    quantityOfBlocks: 0,

    onEnter: function () {
        level2.quantityOfBlocks = 0; // Bắt đầu đếm từ lúc vào Level 2
    },

    onPiecePlaced: function (clearedCount) {
        if (clearedCount > 0) {
            level2.quantityOfBlocks = 0; // Phá được hàng reset bộ đếm
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

// Sinh 1 hàng rác từ đáy lên (dùng cho Level 2): mọi hàng spawn lên 1 ô,
// hàng rác có đúng 1 lỗ ở vị trí ngẫu nhiên. Trả về false nếu hàng trên cùng bị đẩy tràn ra ngoài (thua).
function addGarbageRow() {
    for (let x = 0; x < COLS; x++) {
        if (arena[0][x] !== 0) {
            return false;
        }
    }

    // Rút hàng trên cùng (đang trống) ra, dùng lại chính mảng đó làm hàng rác và đưa xuống đáy
    const topRow = arena.shift();
    const holeX = randomInt(COLS);
    for (let x = 0; x < COLS; x++) {
        if (x === holeX) {
            topRow[x] = 0;
        } else {
            topRow[x] = GARBAGE_BLOCK;
        }
    }
    arena.push(topRow);
    return true;
}

// Level 3: đặt đủ BOMB_PIECE_LIMIT khối mà chưa phá hàng nào thì khối kế tiếp là khối nổ.
// Khối nổ (2x2) khi chạm sàn hoặc khối khác sẽ nổ, xóa 2x2 ô ngay bên dưới nó.
const level3 = {
    name: 'Level 3',
    description: `Cứ ${BOMB_PIECE_LIMIT} khối không phá hàng thì tặng 1 khối nổ`,
    minScore: LEVEL_3_SCORE,

    // Số khối đã đặt liên tiếp mà chưa phá được hàng nào
    quantityOfBlocks: 0,

    onEnter: function () {
        level3.quantityOfBlocks = 0; // Bắt đầu đếm từ lúc vào Level 3
    },

    onPiecePlaced: function (clearedCount) {
        if (clearedCount > 0) {
            level3.quantityOfBlocks = 0; // Phá được hàng reset bộ đếm
            return true;
        }

        level3.quantityOfBlocks++;
        if (level3.quantityOfBlocks >= BOMB_PIECE_LIMIT) {
            level3.quantityOfBlocks = 0;
            game.pendingSpecialPiece = BOMB_TYPE; // Lần spawn tới: khối kế tiếp sẽ là khối nổ
        }
        return true; // Khối nổ không bao giờ làm người chơi thua
    },
};

// Khối nổ phát nổ (dùng cho Level 3): bản thân khối nổ biến mất, không được ghi vào arena,
// và xóa 2x2 ô nằm ngay bên dưới nó. Phần nằm ngoài bàn chơi (khi nổ ở sát đáy) thì bỏ qua.
function explodeBomb() {
    const size = player.matrix.length;          // Khối nổ là ma trận 2x2 -> size = 2
    const startY = player.pos.y + size;         // Hàng đầu tiên ngay dưới khối nổ
    for (let y = startY; y < startY + size; y++) {
        for (let x = player.pos.x; x < player.pos.x + size; x++) {
            if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
                arena[y][x] = 0;
            }
        }
    }
}

// ----- DANH SÁCH LEVEL -----
// Tạo mảng lưu danh sách các màn chơi
const LEVELS = [level1, level2, level3];

// Lấy object của level đang chơi
function getCurrentLevel() {
    return LEVELS[game.level - 1];
}

// Nếu đủ điểm của level kế tiếp thì chuyển sang level đó và gọi onEnter của nó
function checkLevelUp() {
    const nextLevel = LEVELS[game.level]; // game.level bắt đầu từ 1 nên LEVELS[game.level] là level kế tiếp
    if (nextLevel === undefined) {
        return;
    }
    if (game.score >= nextLevel.minScore) {
        game.level++;
        nextLevel.onEnter();
        unlockLevel(game.level); // Đã chơi tới level này -> lần sau được chọn thẳng từ menu
        showBanner('Level Up');
    }
}

// Hạ khối xuống 1 ô. Nếu không hạ được: thêm khối vào arena, xóa hàng đầy,
// xử lý level + hàng rác, rồi sinh khối mới.
function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;

        // Khối nổ thì phát nổ thay vì nằm lại trên bàn chơi
        if (player.type === BOMB_TYPE) {
            explodeBomb();
        } else {
            merge(arena, player);
        }

        const clearedCount = clearFullRows();
        game.score += LINE_CLEAR_SCORES[clearedCount];
        checkLevelUp();

        const currentLevel = getCurrentLevel();
        if (!currentLevel.onPiecePlaced(clearedCount)) {
            game.isOver = true;
        } else if (!spawnPiece()) {
            game.isOver = true;
        }
    }
    dropCounter = 0;
}
//Xử lý sự kiện bàn phím
window.addEventListener('keydown', function (event) {
    // Đang thua hoặc đang ở menu: khóa điều khiển, để Enter/Space tác động lên nút đang được focus
    if (game.isOver || game.isInMenu) {
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

    // Khi thua hoặc đang ở menu thì dừng rơi khối
    if (!game.isOver && !game.isInMenu) {
        dropCounter += deltaTime;
        if (dropCounter >= DROP_INTERVAL_MS) {
            playerDrop();
        }
    }

    render();
    requestAnimationFrame(update);
}

// Tạo các nút chọn màn từ danh sách LEVELS, thêm level mới vào LEVELS là tự có nút
function initLevelMenu() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < LEVELS.length; i++) {
        const levelNumber = i + 1;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level-option';

        const title = document.createElement('span');
        title.className = 'level-option-title';
        title.textContent = LEVELS[i].name;

        const description = document.createElement('span');
        description.className = 'level-option-desc';
        description.textContent = LEVELS[i].description;

        button.appendChild(title);
        button.appendChild(description);
        button.addEventListener('click', function () {
            // Phòng thủ thêm: nút đã disabled nhưng vẫn kiểm tra lại, phòng trường hợp
            // ai đó bỏ thuộc tính disabled bằng DevTools
            if (!isLevelUnlocked(levelNumber)) {
                return;
            }
            startGame(levelNumber);
            render();
        });
        fragment.appendChild(button);
    }
    dom.levelList.replaceChildren(fragment);
}

// Nút "Chơi lại" trong popup Game Over: chơi lại đúng màn đã chọn
dom.restartButton.addEventListener('click', function () {
    startGame(game.startLevel);
    render();
});

// Nút "Chọn màn" trong popup Game Over: quay về màn hình chọn màn
dom.menuButton.addEventListener('click', function () {
    openLevelMenu();
    render();
});

unlockedLevel = loadUnlockedLevel(); // Đọc sau khi đã có LEVELS để kiểm tra giá trị hợp lệ
initRenderer();
initLevelMenu();
render();
requestAnimationFrame(update);
