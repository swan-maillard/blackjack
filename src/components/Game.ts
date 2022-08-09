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
    SHARE: document.getElementById("shareButton") as HTMLElement,
    disableAll: () => {
        buttons.STAND.classList.add("disabled");
        buttons.HIT.classList.add("disabled");
        buttons.DOUBLE.classList.add("disabled");
        buttons.SHARE.classList.add("disabled");
    }
}

export default class Game {
    private _player: Player;
    private _dealerHand: Hand;
    private _state: State;
    private _deck: Deck;

    constructor() {
        this._player = new Player();
        this._dealerHand = new Hand();
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
        };
        this._deck.shuffle();

        let cardsNumber = document.getElementById("deckCardsNumber") as HTMLElement;
        cardsNumber.textContent = this._deck.getNbCards().toString();

        await this.bet();
    }

    async bet() {
        this._state = State.BET;
        this._player.bet(10);
        await this.deal();
    }

    async deal() {
        this._state = State.DEAL;

        buttons.disableAll();

        this._player.addCard(this._deck.popCard());
        await Board.dealCard(this._player.getHand().getCards()[0], "PLAYER");
        this._dealerHand.addCard(this._deck.popCard());
        await Board.dealCard(this._dealerHand.getCards()[0], "DEALER");
        this._player.addCard(this._deck.popCard());
        await Board.dealCard(this._player.getHand().getCards()[1], "PLAYER");


        if (!this.canPlay()) await this.pay();
        else await this.play();
    }

    async play() {
        this._state = State.PLAY;
        buttons.STAND.classList.remove("disabled");
        buttons.HIT.classList.remove("disabled");
        buttons.DOUBLE.classList.remove("disabled");
    }

    async stand() {
        if (this._state === State.PLAY && !Board.animationPlaying) {
            buttons.disableAll();
            while (this.canPlay() && Math.min(...this._dealerHand.getScore()) < 17) {
                let card = this._deck.popCard();
                await Board.dealCard(card, "DEALER");
                this._dealerHand.addCard(card);
            }

            await this.pay();
        }
    }

    async hit() {
        if (this._state === State.PLAY && !Board.animationPlaying) {
            buttons.DOUBLE.classList.add("disabled");
            let card = this._deck.popCard()
            await Board.dealCard(card, "PLAYER");
            this._player.addCard(card);

            if (!this.canPlay()) await this.pay();
        }
    }

    async double() {
        if (this._state === State.PLAY && !Board.animationPlaying) {
            buttons.disableAll();
            if (this._player.getHand().getCards().length === 2) {
                if (this._player.getBankroll() >= this._player.getBet()) {
                    this._player.bet(2 * this._player.getBet());
                    let card = this._deck.popCard()
                    await Board.dealCard(card, "PLAYER");
                    this._player.addCard(card);

                    if (!this.canPlay()) await this.pay();
                    else await this.stand();

                } else {
                    alert("Vous n'avez pas assez d'argent pour ça...");
                }
            } else {
                alert("Vous ne pouvez doubler qu'au premier tour.")
            }
        }
    }

    async pay() {
        this._state = State.FINISH;
        let message: string;

        buttons.disableAll();
        this.hideScore();

        let dealerScore = Math.max(...this._dealerHand.getScore().filter(score => score < 21));
        let playerScore = Math.max(...this._player.getHand().getScore().filter(score => score < 21));

        if (this.dealerBlackjack() && this.playerBlackjack() || dealerScore === playerScore) {
            message = "ÉGALITÉ";
            this._player.tie();
        } else if (this.dealerBlackjack()) {
            message = "PERDU...";
            this._player.loseBet();
        } else if (this.playerBusts()) {
            message = "PERDU...";
            this._player.loseBet();
        } else if (this.dealerBusts()) {
            message = "GAGNÉ !";
            this._player.winBet();
        } else if (this.playerBlackjack()) {
            message = "BLACKJACK !!";
            this._player.winBlackjack();
        } else if (dealerScore > playerScore) {
            message = "PERDU...";
            this._player.loseBet();
        } else {
            message = "GAGNÉ !";
            this._player.winBet();
        }

        let endMessage = document.getElementById("endMessage") as HTMLElement;
        endMessage.textContent = message
        endMessage.style.transform = "scale(1)";

        setTimeout(() => {
            endMessage.textContent = "";
            endMessage.style.transform = "scale(0)";

            this.restart();
        }, 2000)

    }

    async restart() {
        this._dealerHand = new Hand();
        this._player.throwHand();
        await Board.clearHands()

        await this.bet();
    }

    canPlay(): boolean {
        return !(this.dealerBlackjack() || this.dealerBusts() || this.playerBlackjack() || this.playerBusts());
    }

    dealerBlackjack(): boolean {
        return this._dealerHand.getScore().includes(21);
    }

    dealerBusts(): boolean {
        return Math.min(...this._dealerHand.getScore()) > 21;
    }

    playerBlackjack(): boolean {
        return this._player.getHand().getScore().includes(21);
    }

    playerBusts(): boolean {
        return Math.min(...this._player.getHand().getScore()) > 21;
    }

    isFinished(): boolean {
        return this._state === State.FINISH;
    }

    isPlaying(): boolean {
        return (this._state === State.PLAY || this._state === State.DEAL);
    }

    displayScore(hand: HTMLElement) {
        let score = document.getElementById("score") as HTMLElement;
        if (hand.id === "dealerHand") {
            score.textContent = this._dealerHand.getScore().filter(score => score < 21).join(" ou ");
            score.style.transform = "scale(1)";
        }
        else if (hand.id === "playerHand") {
            score.textContent = this._player.getHand().getScore().filter(score => score < 21).join(" ou ");
            score.style.transform = "scale(1)";
        }
    }

    hideScore() {
        let score = document.getElementById("score") as HTMLElement;
        score.textContent = "";
        score.style.transform = "scale(0)";
    }

}