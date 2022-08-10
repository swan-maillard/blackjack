import Card from "./Card";
import Board from "./Board";

export default class Hand {
    private readonly _cards: Card[];

    constructor() {
        this._cards = [];
    }

    addCard(card: Card | undefined) {
        if (card instanceof Card) {
            this._cards.push(card);
        }
    }

    getCards(): Card[] {
        return this._cards;
    }

    getScore(): number[] {
        let score = 0;
        let isAce = false;
        this._cards.forEach(card => {
            if (card.getScore() === 1) isAce = true;
            score += card.getScore();
        });

        return (isAce ? (score === 11 ? [21] : [score, score+10]) : [score]);
    }
}