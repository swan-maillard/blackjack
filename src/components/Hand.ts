import Card from "./Card";

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
        let nbAces = 0;
        this._cards.forEach(card => {
            if (card.getScore() === 1) {
                nbAces ++;
            }
            else {
                score += card.getScore();
            }
        });

        if (nbAces > 0)
            return [score+nbAces, score+nbAces+10];
        else
            return [score];
    }
}