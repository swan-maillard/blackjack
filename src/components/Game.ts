import Player from "./Player";
import Deck from "./Deck";
import Card from "./Card";
import Hand from "./Hand";
import Board from "./Board";

enum State {
    CREATE,
    BET,
    DEAL,
    PLAY,
    FINISH
}

const buttons = {
    STAND: document.getElementById("standButton") as HTMLElement,
    HIT: document.getElementById("hitButton") as HTMLElement,
    DOUBLE: document.getElementById("doubleButton") as HTMLElement,
    SPLIT: document.getElementById("splitButton") as HTMLElement,
    disableAll: () => {
        buttons.STAND.classList.add("disabled");
        buttons.HIT.classList.add("disabled");
        buttons.DOUBLE.classList.add("disabled");
        buttons.SPLIT.classList.add("disabled");
    }
}

export default class Game {
    private _player: Player;
    private _dealerHand: Hand;
    private _currentPlayerHand: number;
    private _state: State;
    private _deck: Deck;

    constructor() {
        this._player = new Player();
        this._dealerHand = new Hand();
        this._currentPlayerHand = 0;
        this._state = State.CREATE;
        this._deck = new Deck();
    }

    async start(bankroll: number, numberDecks: number) {
        this._player.setBankroll(bankroll);
        numberDecks = Math.min(Math.max(1, numberDecks), 8);
        for (let deck = 0; deck < numberDecks; deck++) {
            for (let suit = 0; suit < 4; suit++) {
                for (let value = 1; value <= 13; value++) {
                    this._deck.addCard(new Card(value, suit));
                }
            }
        }

        this._deck.shuffle();

        let deckHTML = document.getElementById("deck") as HTMLElement;
        deckHTML.setAttribute("data-content", this._deck.getNbCards().toString());


        let bankrollHTML = document.getElementById("bankroll") as HTMLElement;
        bankrollHTML.textContent = this._player.getBankroll().toString() + " €";

        await this.bet();
    }

    async bet() {
        this._state = State.BET;
        this._player.bet(10, this._currentPlayerHand);

        let bankrollHTML = document.getElementById("bankroll") as HTMLElement;
        bankrollHTML.textContent = this._player.getBankroll().toString() + " €";
        let betHTML = document.getElementById("bet") as HTMLElement;
        betHTML.textContent = this._player.getBet(this._currentPlayerHand).toString() + " €";

        await this.deal();
    }

    async deal() {
        this._state = State.DEAL;

        buttons.disableAll();

        let card: Card | undefined;
        card = this._deck.popCard();
        await Board.dealCard(card, "PLAYER");
        this._player.addCard(card, this._currentPlayerHand);

        card = this._deck.popCard();
        await Board.dealCard(card, "DEALER");
        this._dealerHand.addCard(card);

        card = this._deck.popCard();
        await Board.dealCard(card, "PLAYER");
        this._player.addCard(card, this._currentPlayerHand);

        this._state = State.PLAY;

        if (this.isHandLost()) await this.nextHand();
        else this.enableButtons();
    }

    isHandLost(): boolean {
        if (this.playerBlackjack(this._currentPlayerHand)) {
            Board.showStateMessage("BLACKJACK", this._currentPlayerHand);
            return true;
        }
        else if (this.playerBusts(this._currentPlayerHand)) {
            Board.showStateMessage("BRÛLÉ", this._currentPlayerHand);
            return true;
        }
        else {
            return false;
        }
    }

    enableButtons(): void {
        buttons.disableAll();

        buttons.STAND.classList.remove("disabled");
        buttons.HIT.classList.remove("disabled");
        if (this.canDouble()) buttons.DOUBLE.classList.remove("disabled");
        if (this.canSplit()) buttons.SPLIT.classList.remove("disabled");
    }

    canSplit(): boolean {
        let cards = this._player.getHand(this._currentPlayerHand).getCards();
        return (cards.length === 2 && cards[0].getScore() === cards[1].getScore() && this._player.getNumberHands() < 3
            && this._player.getBankroll() >= this._player.getBet(this._currentPlayerHand));
    }

    canDouble(): boolean {
        return (this._player.getBankroll() >= this._player.getBet(this._currentPlayerHand));
    }

    async hit() {
        if (this._state === State.PLAY && !Board.animationPlaying) {
            this.enableButtons()
            buttons.DOUBLE.classList.add("disabled");

            let card = this._deck.popCard()
            await Board.dealCard(card, "PLAYER");
            this._player.addCard(card, this._currentPlayerHand);

            if (this.canSplit()) buttons.SPLIT.classList.remove("disabled");
            if (this.isHandLost()) await this.nextHand();
        }
    }

    async double() {
        if (this._state === State.PLAY && !Board.animationPlaying && this._player.getBankroll() >= this._player.getBet(this._currentPlayerHand)) {
            this._player.bet(this._player.getBet(this._currentPlayerHand), this._currentPlayerHand);

            buttons.disableAll();

            let bankrollHTML = document.getElementById("bankroll") as HTMLElement;
            bankrollHTML.textContent = this._player.getBankroll().toString() + " €";
            let betHTML = document.getElementById("bet") as HTMLElement;
            betHTML.textContent = this._player.getBet(this._currentPlayerHand).toString() + " €";

            let card = this._deck.popCard()
            await Board.dealCard(card, "PLAYER");
            this._player.addCard(card, this._currentPlayerHand);

            this.isHandLost();
            await this.nextHand();

        }
    }

    async split() {
        let cards = this._player.getHand(this._currentPlayerHand).getCards();
        if (this._state === State.PLAY && cards.length === 2 && cards[0].getScore() === cards[1].getScore() && this._player.getNumberHands() < 3 &&
            this._player.getBankroll() >= this._player.getBet(this._currentPlayerHand) && !Board.animationPlaying) {

            this._player.splitHand(this._currentPlayerHand);
            this._player.bet(this._player.getBet(this._currentPlayerHand), this._player.getNumberHands()-1);

            let bankrollHTML = document.getElementById("bankroll") as HTMLElement;
            bankrollHTML.textContent = this._player.getBankroll().toString() + " €";
            let betHTML = document.getElementById("bet") as HTMLElement;
            betHTML.textContent = this._player.getBet(this._currentPlayerHand).toString() + " €";

            this.enableButtons();
            await Board.splitCards();
        }
    }

    async nextHand() {
        if (this._currentPlayerHand < this._player.getNumberHands() - 1) {
            this._currentPlayerHand++;
            Board.switchHand(this._currentPlayerHand);
            this.enableButtons();
        }
        else {
            if (this.isGameOver()) await this.pay();
            else await this.dealerTurn();
        }
    }

    async dealerTurn() {
        if (this._state === State.PLAY && !Board.animationPlaying) {
            buttons.disableAll();
            Board.endPlayerTurn();

            while (!this.dealerBlackjack() && !this.dealerBusts() && Math.min(...this._dealerHand.getScore()) < 17) {
                let card = this._deck.popCard();
                await Board.dealCard(card, "DEALER");
                this._dealerHand.addCard(card);
            }

            await this.pay();
        }
    }

    async pay() {
        this._state = State.FINISH;
        let message: string;

        buttons.disableAll();

        let dealerScore = Math.max(...this._dealerHand.getScore().filter(score => score <= 21));
        for (let i = 0; i < this._player.getNumberHands(); i++) {
            let playerScore = Math.max(...this._player.getHand(i).getScore().filter(score => score <= 21));

            if (dealerScore === playerScore) {
                message = "ÉGALITÉ";
                this._player.tie(this._currentPlayerHand);
            }
            else if (this.playerBlackjack(i)) {
                this._player.winBlackjack(this._currentPlayerHand);
            }
            else if (this.playerBusts(i)) {
                message = "BRÛLÉ";
            }
            else if (this.dealerBlackjack()) {
                message = "PERDU";
            }
            else if (this.dealerBusts()) {
                message = "GAGNÉ";
                this._player.winBet(this._currentPlayerHand);
            }
            else if (dealerScore > playerScore) {
                message = "PERDU";
            }
            else if (dealerScore < playerScore) {
                message = "GAGNÉ";
                this._player.winBet(this._currentPlayerHand);
            }

            if (message !== undefined) await Board.showStateMessage(message, i);
        }

        setTimeout(() => {
            this.restart();
        }, 2000)

    }

    async restart() {
        this._currentPlayerHand = 0;
        this._dealerHand = new Hand();
        this._player.clearHands();
        await Board.clearHands();
        await this.bet();
    }

    isGameOver(): boolean {
        for (let i = 0; i < this._player.getNumberHands(); i++) {
            if (Math.min(...this._player.getHand(i).getScore()) < 21) return false;
        }
        return true;
    }

    dealerBlackjack(): boolean {
        return this._dealerHand.getScore().includes(21);
    }

    dealerBusts(): boolean {
        return Math.min(...this._dealerHand.getScore()) > 21;
    }

    playerBlackjack(hand: number): boolean {
        return this._player.getHand(hand).getScore().includes(21);
    }

    playerBusts(hand: number): boolean {
        return Math.min(...this._player.getHand(hand).getScore()) > 21;
    }

    isFinished(): boolean {
        return this._state === State.FINISH;
    }

    isPlaying(): boolean {
        return (this._state === State.PLAY || this._state === State.DEAL);
    }

    displayScore(hand: HTMLElement) {
        let score = document.getElementById("score") as HTMLElement;
        let parent = hand.parentElement;
        if (parent.id === "dealerHand") {
            let displayScore = this._dealerHand.getScore();
            if (displayScore.length > 1) {
                score.textContent = (Math.min(...displayScore) > 21 ? Math.min(...displayScore).toString() : displayScore.filter(score => score <= 21).join(" ou "));
            }
            else {
                score.textContent = displayScore.join();
            }
            score.style.transform = "scale(1)";
        }
        else if (parent.id === "playerHand") {
            let displayScore = this._player.getHand(parseInt(hand.dataset.hand)).getScore();
            if (displayScore.length > 1) {
                score.textContent = (Math.min(...displayScore) > 21 ? Math.min(...displayScore).toString() : displayScore.filter(score => score <= 21).join(" ou "));
            }
            else {
                score.textContent = displayScore.join();
            }
            score.style.transform = "scale(1)";
            score.style.transform = "scale(1)";
        }
    }

    hideScore() {
        let score = document.getElementById("score") as HTMLElement;
        score.textContent = "";
        score.style.transform = "scale(0)";
    }

}