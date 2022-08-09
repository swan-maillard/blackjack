import Hand from "./Hand";
import Card from "./Card";

export default class Player {
    private _hand: Hand;
    private _bet: number;
    private _bankroll: number;

    constructor() {
        this._hand = new Hand();
        this._bet = 0;
        this._bankroll = 0;
    }

    addCard(card : Card | undefined): void {
        this._hand.addCard(card);
    }

    getHand(): Hand {
        return this._hand;
    }

    throwHand(): void {
        this._hand = new Hand();
    }

    setBankroll(amount: number) {
        this._bankroll = Math.max(0, amount);
    }

    getBankroll(): number {
        return this._bankroll;
    }

    bet(amount: number): void {
        amount = Math.max(Math.min(this._bankroll, amount), 0);
        this._bet += amount;
        this._bankroll -= amount;
    }

    getBet(): number {
        return this._bet;
    }

    loseBet(): void {
        this._bet = 0;
    }

    winBet(): void {
        this._bankroll += 2*this._bet;
        this._bet = 0;
    }

    winBlackjack(): void {
        this._bankroll += 3*this._bet;
        this._bet = 0;
    }

    tie(): void {
        this._bankroll += this._bet;
        this._bet = 0;
    }

}