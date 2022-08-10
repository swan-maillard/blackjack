import Hand from "./Hand";
import Card from "./Card";

export default class Player {
    private _hands: Hand[];
    private _bets: number[];
    private _bankroll: number;

    constructor() {
        this._hands = [new Hand()];
        this._bets = [];
        this._bankroll = 0;
    }

    addCard(card : Card | undefined, hand: number): void {
        this.getHand(hand).addCard(card);
    }

    getHand(hand: number): Hand {
        return (hand < this._hands.length ? this._hands[hand] : this._hands[0]);
    }

    getNumberHands(): number {
        return this._hands.length;
    }

    splitHand(hand: number): void {
        let cards = this.getHand(hand).getCards();
        if (cards.length === 2) {
            this._hands[hand] = new Hand();
            this._hands.push(new Hand());
            this._hands[hand].addCard(cards[0]);
            this._hands[this._hands.length-1].addCard(cards[1]);
        }
    }

    clearHands(): void {
        this._hands = [new Hand()];
        this._bets = [];
    }

    setBankroll(amount: number) {
        this._bankroll = Math.max(0, amount);
    }

    getBankroll(): number {
        return this._bankroll;
    }

    bet(amount: number, hand: number): void {
        amount = Math.max(Math.min(this._bankroll, amount), 0);
        if (this._bets[hand] === undefined) this._bets[hand] = 0;

        this._bets[hand] += amount;
        this._bankroll -= amount;
    }

    getBet(hand: number): number {
        return this._bets[hand];
    }

    winBet(hand: number): void {
        console.log(this._bets);
        this._bankroll += 2*this._bets[hand];
    }

    winBlackjack(hand: number): void {
        console.log(this._bets);
        this._bankroll += 5/2*this._bets[hand];
    }

    tie(hand: number): void {
        console.log(this._bets);
        this._bankroll += this._bets[hand];
    }

}