import Card from "./Card";

export default class Hand {
    private readonly _cards: Card[];

    constructor() {
        this._cards = [];
    }

    addCard(card: Card | undefined): void {
        if (card instanceof Card) {
            this._cards.push(card);
        }
    }

    getCards(): Card[] {
        return this._cards;
    }

    size(): number {
        return this._cards.length;
    }

    getScore(): number[] {
        let score = 0;
        let hasAce = false;
        for (const card of this._cards) {
            if (card.isAce()) hasAce = true;
            score += card.getScore();
        }
        if (!hasAce) return [score];
        if (score === 11) return [21];
        const soft = score + 10;
        return soft > 21 ? [score] : [score, soft];
    }

    bestScore(): number {
        const scores = this.getScore();
        const valid = scores.filter((s) => s <= 21);
        return valid.length > 0 ? Math.max(...valid) : Math.min(...scores);
    }

    isBust(): boolean {
        return Math.min(...this.getScore()) > 21;
    }

    isBlackjack(): boolean {
        return this._cards.length === 2 && this.getScore().includes(21);
    }
}
