enum Suit {
    Club,
    Diamond,
    Heart,
    Spade
}


export default class Card {
    private readonly _value: number;
    private readonly _suit: Suit;

    constructor(value : number, suit : Suit) {
        this._value = value;
        this._suit = suit;
    }

    getUrl(): string {
        let file = "card-";

        switch (this._suit) {
            case Suit.Club:
                file += "clubs";
                break;
            case Suit.Diamond:
                file += "diamonds";
                break;
            case Suit.Heart:
                file += "hearts";
                break;
            case Suit.Spade:
                file += "spades";
        }

        file += "-" + this._value.toString() + '.png';

        return require("../assets/images/cards/" + file);

    }

    getName(): string {
        let name: string;

        switch (this._value) {
            case 1:
                name = "As";
                break;
            case 11:
                name = "Valet";
                break;
            case 12:
                name = "Dame";
                break;
            case 13:
                name = "Roi";
                break;
            default:
                name = this._value.toString();
        }

        name += " de ";

        switch (this._suit) {
            case Suit.Club:
                name += "Trèfle";
                break;
            case Suit.Diamond:
                name += "Carreau";
                break;
            case Suit.Heart:
                name += "Coeur";
                break;
            case Suit.Spade:
                name += "Pique";
        }

        return name;
    }

    getScore(): number {
        let score: number;
        switch (this._value) {
            case 11:
            case 12:
            case 13:
                score = 10;
                break;
            default:
                score = this._value;
        }

        return score;
    }

    static getBackUrl(): string {
        return require("../assets/images/cards/card-back1.png");
    }
}