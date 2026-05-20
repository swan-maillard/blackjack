export enum Suit {
    Clubs = 0,
    Diamonds = 1,
    Hearts = 2,
    Spades = 3,
}

const SUIT_SLUG: Record<Suit, string> = {
    [Suit.Clubs]: "clubs",
    [Suit.Diamonds]: "diamonds",
    [Suit.Hearts]: "hearts",
    [Suit.Spades]: "spades",
};

export default class Card {
    private readonly _value: number;
    private readonly _suit: Suit;

    constructor(value: number, suit: Suit) {
        this._value = value;
        this._suit = suit;
    }

    isAce(): boolean {
        return this._value === 1;
    }

    getUrl(): string {
        return require(`../assets/images/cards/card-${SUIT_SLUG[this._suit]}-${this._value}.png`);
    }

    getScore(): number {
        return this._value > 10 ? 10 : this._value;
    }
}
