import Card from "./Card";

export default class Deck {
    private _cards: Card[];

    constructor() {
        this._cards = [];
    }

    addCard(card: Card): void {
        this._cards.push(card);
    }

    shuffle(): void {
        this._cards = this._cards.sort((a, b) => 0.5 - Math.random());
    }

    popCard(): Card | undefined {
        return this._cards.pop();
    }

    isEmpty(): boolean {
        return this._cards.length === 0;
    }

    getNbCards(): number {
        return this._cards.length;
    }

}