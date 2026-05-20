import Card from "./Card";

export default class Deck {
    private readonly _cards: Card[];

    constructor() {
        this._cards = [];
    }

    addCard(card: Card): void {
        this._cards.push(card);
    }

    shuffle(): void {
        for (let i = this._cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._cards[i], this._cards[j]] = [this._cards[j], this._cards[i]];
        }
    }

    popCard(): Card | undefined {
        return this._cards.pop();
    }

    getNbCards(): number {
        return this._cards.length;
    }
}
