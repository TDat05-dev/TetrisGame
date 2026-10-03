const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL_MS = 1000;
const PRE_EXISTING_BLOCK = 8;
const BANNER_DURATION_MS = 2000;


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
const PIECE_QUEUE_SIZE = 2;
const PREVIEW_SIZE = 4;
