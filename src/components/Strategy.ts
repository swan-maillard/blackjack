import Card from "./Card";

export type StrategyAction = "HIT" | "STAND" | "DOUBLE" | "SPLIT";

export interface StrategyContext {
    playerCards: Card[];
    dealerUpcard: Card;
    canDouble: boolean;
    canSplit: boolean;
}

export interface StrategyAdvice {
    action: StrategyAction;
    ideal: StrategyAction;
    category: "pair" | "soft" | "hard";
    playerKey: string;
    dealerKey: string;
    note: string;
}

export const DEALER_COLS: ReadonlyArray<string> = [
    "2", "3", "4", "5", "6", "7", "8", "9", "10", "A",
];

export const PAIR_ROWS: ReadonlyArray<string> = [
    "A,A", "10,10", "9,9", "8,8", "7,7", "6,6", "5,5", "4,4", "3,3", "2,2",
];

export const SOFT_ROWS: ReadonlyArray<number> = [20, 19, 18, 17, 16, 15, 14, 13];

export const HARD_ROWS: ReadonlyArray<number> = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];

// Cell encoding (H17 chart from blackjackapprenticeship.com):
//   H  = Hit
//   S  = Stand
//   D  = Double if allowed, else Hit
//   Ds = Double if allowed, else Stand
//   P  = Split
//   Ph = Split if double-after-split allowed, else Hit
export type Cell = "H" | "S" | "D" | "Ds" | "P" | "Ph";

function rowAll(c: Cell): Record<string, Cell> {
    const r: Record<string, Cell> = {};
    for (const k of DEALER_COLS) r[k] = c;
    return r;
}

function row(...cells: Cell[]): Record<string, Cell> {
    const r: Record<string, Cell> = {};
    for (let i = 0; i < DEALER_COLS.length; i++) r[DEALER_COLS[i]] = cells[i];
    return r;
}

export const PAIR_CHART: Record<string, Record<string, Cell>> = {
    "A,A":   rowAll("P"),
    "10,10": rowAll("S"),
    "9,9":   row("P", "P", "P", "P", "P", "S", "P", "P", "S", "S"),
    "8,8":   rowAll("P"),
    "7,7":   row("P", "P", "P", "P", "P", "P", "H", "H", "H", "H"),
    "6,6":   row("Ph","P", "P", "P", "P", "H", "H", "H", "H", "H"),
    "5,5":   row("D", "D", "D", "D", "D", "D", "D", "D", "H", "H"),
    "4,4":   row("H", "H", "H", "Ph","Ph","H", "H", "H", "H", "H"),
    "3,3":   row("Ph","Ph","P", "P", "P", "P", "H", "H", "H", "H"),
    "2,2":   row("Ph","Ph","P", "P", "P", "P", "H", "H", "H", "H"),
};

export const SOFT_CHART: Record<number, Record<string, Cell>> = {
    20: rowAll("S"),
    19: row("S", "S", "S", "S", "Ds","S", "S", "S", "S", "S"),
    18: row("Ds","Ds","Ds","Ds","Ds","S", "S", "H", "H", "H"),
    17: row("H", "D", "D", "D", "D", "H", "H", "H", "H", "H"),
    16: row("H", "H", "D", "D", "D", "H", "H", "H", "H", "H"),
    15: row("H", "H", "D", "D", "D", "H", "H", "H", "H", "H"),
    14: row("H", "H", "H", "D", "D", "H", "H", "H", "H", "H"),
    13: row("H", "H", "H", "D", "D", "H", "H", "H", "H", "H"),
};

export const HARD_CHART: Record<number, Record<string, Cell>> = {
    17: rowAll("S"),
    16: row("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
    15: row("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
    14: row("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
    13: row("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
    12: row("H", "H", "S", "S", "S", "H", "H", "H", "H", "H"),
    11: row("D", "D", "D", "D", "D", "D", "D", "D", "D", "D"),
    10: row("D", "D", "D", "D", "D", "D", "D", "D", "H", "H"),
    9:  row("H", "D", "D", "D", "D", "H", "H", "H", "H", "H"),
    8:  rowAll("H"),
    7:  rowAll("H"),
    6:  rowAll("H"),
    5:  rowAll("H"),
};

export function dealerKey(card: Card): string {
    if (card.isAce()) return "A";
    return card.getScore().toString();
}

export function isPair(cards: Card[]): boolean {
    return cards.length === 2 && cards[0].getScore() === cards[1].getScore();
}

export function pairKey(cards: Card[]): string {
    if (cards[0].isAce()) return "A,A";
    const v = cards[0].getScore();
    if (v === 10) return "10,10";
    return `${v},${v}`;
}

export function isSoft(cards: Card[]): boolean {
    let hasAce = false;
    let raw = 0;
    for (const c of cards) {
        if (c.isAce()) hasAce = true;
        raw += c.getScore();
    }
    return hasAce && raw + 10 <= 21;
}

export function softTotal(cards: Card[]): number {
    let raw = 0;
    for (const c of cards) raw += c.getScore();
    return raw + 10;
}

export function hardTotal(cards: Card[]): number {
    let raw = 0;
    let aces = 0;
    for (const c of cards) {
        raw += c.getScore();
        if (c.isAce()) aces++;
    }
    if (aces > 0 && raw + 10 <= 21) return raw + 10;
    return raw;
}

function resolveCell(
    cell: Cell,
    ctx: StrategyContext,
    category: "pair" | "soft" | "hard",
    playerKey: string,
    dKey: string,
): StrategyAdvice {
    let ideal: StrategyAction;
    let action: StrategyAction;
    let note = "";

    switch (cell) {
        case "H":
            ideal = "HIT"; action = "HIT"; break;
        case "S":
            ideal = "STAND"; action = "STAND"; break;
        case "D":
            ideal = "DOUBLE";
            action = ctx.canDouble ? "DOUBLE" : "HIT";
            if (!ctx.canDouble) note = "Double if allowed, otherwise Hit";
            break;
        case "Ds":
            ideal = "DOUBLE";
            action = ctx.canDouble ? "DOUBLE" : "STAND";
            if (!ctx.canDouble) note = "Double if allowed, otherwise Stand";
            break;
        case "P":
            ideal = "SPLIT";
            action = ctx.canSplit ? "SPLIT" : fallbackWithoutPair(ctx);
            if (!ctx.canSplit) note = "Split if allowed, otherwise play as total";
            break;
        case "Ph":
            ideal = "SPLIT";
            action = ctx.canSplit ? "SPLIT" : "HIT";
            if (!ctx.canSplit) note = "Split if double-after-split allowed, otherwise Hit";
            break;
    }

    return { action, ideal, category, playerKey, dealerKey: dKey, note };
}

function fallbackWithoutPair(ctx: StrategyContext): StrategyAction {
    const dKey = dealerKey(ctx.dealerUpcard);
    if (isSoft(ctx.playerCards)) {
        const total = Math.min(20, softTotal(ctx.playerCards));
        const cell = SOFT_CHART[total]?.[dKey];
        if (cell) return resolveCell(cell, ctx, "soft", `Soft ${total}`, dKey).action;
    }
    const ht = Math.min(17, Math.max(5, hardTotal(ctx.playerCards)));
    const cell = HARD_CHART[ht]?.[dKey];
    if (cell) return resolveCell(cell, ctx, "hard", String(ht), dKey).action;
    return "HIT";
}

export function adviseStrategy(ctx: StrategyContext): StrategyAdvice {
    const dKey = dealerKey(ctx.dealerUpcard);
    const cards = ctx.playerCards;

    if (isPair(cards)) {
        const pKey = pairKey(cards);
        if (pKey !== "5,5") {
            const cell = PAIR_CHART[pKey]?.[dKey];
            if (cell) return resolveCell(cell, ctx, "pair", pKey, dKey);
        }
    }

    if (isSoft(cards)) {
        const total = Math.min(20, softTotal(cards));
        const cell = SOFT_CHART[total]?.[dKey];
        if (cell) return resolveCell(cell, ctx, "soft", `Soft ${total}`, dKey);
    }

    const ht = Math.min(17, Math.max(5, hardTotal(cards)));
    const cell = HARD_CHART[ht]?.[dKey];
    if (cell) return resolveCell(cell, ctx, "hard", String(hardTotal(cards)), dKey);

    return {
        action: "STAND", ideal: "STAND",
        category: "hard", playerKey: String(hardTotal(cards)),
        dealerKey: dKey, note: "",
    };
}

export function currentChartKey(cards: Card[]):
    | { category: "pair"; key: string }
    | { category: "soft"; key: number }
    | { category: "hard"; key: number } {
    if (isPair(cards) && pairKey(cards) !== "5,5") {
        return { category: "pair", key: pairKey(cards) };
    }
    if (isSoft(cards)) {
        return { category: "soft", key: Math.min(20, softTotal(cards)) };
    }
    return { category: "hard", key: Math.min(17, Math.max(5, hardTotal(cards))) };
}
