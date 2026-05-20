import Player from "./Player";
import Deck from "./Deck";
import Card, { Suit } from "./Card";
import Hand from "./Hand";
import Board from "./Board";

enum State {
    CREATE,
    BET,
    DEAL,
    PLAY,
    DEALER,
    FINISH,
    OVER,
}

function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as T;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const STARTING_BANKROLL = 1000;
const MIN_BET = 5;
const RESHUFFLE_THRESHOLD = 15;

type Outcome = "WIN" | "LOSE" | "PUSH" | "BUST" | "BLACKJACK";

export default class Game {
    private _player: Player;
    private _dealerHand: Hand;
    private _currentPlayerHand: number;
    private _state: State;
    private _deck: Deck;
    private _round: number;
    private _holeHidden: boolean;
    private _numberDecks: number;

    private readonly _buttons: {
        STAND: HTMLButtonElement;
        HIT: HTMLButtonElement;
        DOUBLE: HTMLButtonElement;
        SPLIT: HTMLButtonElement;
    };

    constructor() {
        this._player = new Player();
        this._dealerHand = new Hand();
        this._currentPlayerHand = 0;
        this._state = State.CREATE;
        this._deck = new Deck();
        this._round = 1;
        this._holeHidden = false;
        this._numberDecks = 6;

        this._buttons = {
            STAND: requireEl<HTMLButtonElement>("standButton"),
            HIT: requireEl<HTMLButtonElement>("hitButton"),
            DOUBLE: requireEl<HTMLButtonElement>("doubleButton"),
            SPLIT: requireEl<HTMLButtonElement>("splitButton"),
        };
    }

    async start(bankroll = STARTING_BANKROLL, numberDecks = 6): Promise<void> {
        this._numberDecks = Math.min(Math.max(1, numberDecks), 8);
        this._player.setBankroll(bankroll);
        this.refreshBankroll();
        this.refreshBet();
        this.refreshRound();
        this.initDeck();
        await this.openBet();
    }

    // ---------- UI refresh helpers ----------

    private disableAllButtons(): void {
        this._buttons.STAND.classList.add("disabled");
        this._buttons.HIT.classList.add("disabled");
        this._buttons.DOUBLE.classList.add("disabled");
        this._buttons.SPLIT.classList.add("disabled");
    }

    private enableButtons(): void {
        this.disableAllButtons();
        this._buttons.STAND.classList.remove("disabled");
        this._buttons.HIT.classList.remove("disabled");
        if (this.canDouble()) this._buttons.DOUBLE.classList.remove("disabled");
        if (this.canSplit()) this._buttons.SPLIT.classList.remove("disabled");
    }

    private refreshBankroll(): void {
        requireEl("bankroll").textContent = this.formatMoney(this._player.getBankroll());
    }

    private refreshBet(): void {
        const bet = this._totalBet();
        requireEl("bet").textContent = this.formatMoney(bet);
    }

    private refreshRound(): void {
        requireEl("round").textContent = this._round.toString();
    }

    private refreshDeckCount(): void {
        const deckEl = requireEl("deck");
        deckEl.dataset.count = this._deck.getNbCards().toString();
    }

    private refreshDealButton(): void {
        const dealButton = requireEl<HTMLButtonElement>("dealButton");
        dealButton.disabled = this._player.getBet(0) < MIN_BET;
    }

    private formatMoney(amount: number): string {
        return "$" + amount.toLocaleString("en-US");
    }

    private _totalBet(): number {
        let total = 0;
        for (let i = 0; i < this._player.getNumberHands(); i++) {
            total += this._player.getBet(i);
        }
        return total;
    }

    // ---------- Deck setup ----------

    private initDeck(): void {
        this._deck = new Deck();
        for (let d = 0; d < this._numberDecks; d++) {
            for (let s = 0; s < 4; s++) {
                for (let v = 1; v <= 13; v++) {
                    this._deck.addCard(new Card(v, s as Suit));
                }
            }
        }
        this._deck.shuffle();
        this.refreshDeckCount();
    }

    // ---------- Betting ----------

    async openBet(): Promise<void> {
        if (this._player.getBankroll() < MIN_BET) {
            this.gameOver();
            return;
        }
        this._state = State.BET;
        this.disableAllButtons();
        Board.clearChipStack();
        this.refreshBankroll();
        this.refreshBet();
        requireEl("betPanel").classList.remove("hidden");
        this.refreshDealButton();
    }

    /**
     * Place a chip on the bet immediately. The bankroll drops live as the player
     * builds the bet, so there is no separate "pending" amount to display.
     */
    addToPendingBet(chip: number): void {
        if (this._state !== State.BET || chip <= 0) return;
        if (this._player.getBankroll() < chip) return;
        const accepted = this._player.bet(chip, 0);
        if (accepted <= 0) return;
        Board.addBetChip(chip);
        this.refreshBankroll();
        this.refreshBet();
        this.refreshDealButton();
    }

    /** Refund every chip currently placed back into the bankroll. */
    clearPendingBet(): void {
        if (this._state !== State.BET) return;
        this._player.refundBet(0);
        Board.clearChipStack();
        this.refreshBankroll();
        this.refreshBet();
        this.refreshDealButton();
    }

    async confirmBet(): Promise<void> {
        if (this._state !== State.BET || this._player.getBet(0) < MIN_BET) return;
        requireEl("betPanel").classList.add("hidden");
        await this.deal();
    }

    // ---------- Round flow ----------

    async deal(): Promise<void> {
        this._state = State.DEAL;
        this.disableAllButtons();

        // Standard order: player, dealer up, player, dealer hole (face down)
        await this.dealOne("PLAYER", false);
        await this.dealOne("DEALER", false);
        await this.dealOne("PLAYER", false);
        await this.dealOne("DEALER", true);
        this._holeHidden = true;

        this._state = State.PLAY;

        if (this._player.getHand(0).isBlackjack()) {
            await Board.showStateMessage("BLACKJACK", 0);
            await this.dealerTurn();
        } else {
            this.enableButtons();
        }
    }

    private async dealOne(side: "PLAYER" | "DEALER", hidden: boolean): Promise<void> {
        const card = this._deck.popCard();
        this.refreshDeckCount();
        await Board.dealCard(card, side, { hidden });
        if (side === "PLAYER") {
            this._player.addCard(card, this._currentPlayerHand);
        } else {
            this._dealerHand.addCard(card);
        }
    }

    canSplit(): boolean {
        const cards = this._player.getHand(this._currentPlayerHand).getCards();
        return (
            cards.length === 2 &&
            cards[0].getScore() === cards[1].getScore() &&
            this._player.getNumberHands() < 3 &&
            this._player.getBankroll() >= this._player.getBet(this._currentPlayerHand)
        );
    }

    canDouble(): boolean {
        const hand = this._player.getHand(this._currentPlayerHand);
        return (
            hand.size() === 2 &&
            this._player.getBankroll() >= this._player.getBet(this._currentPlayerHand)
        );
    }

    async hit(): Promise<void> {
        if (this._state !== State.PLAY || Board.animationPlaying) return;
        this.disableAllButtons();

        await this.dealOne("PLAYER", false);
        const hand = this._player.getHand(this._currentPlayerHand);

        if (hand.isBust()) {
            await Board.showStateMessage("BUST", this._currentPlayerHand);
            await this.nextHand();
        } else if (hand.getScore().includes(21)) {
            await this.nextHand();
        } else {
            this.enableButtons();
        }
    }

    async double(): Promise<void> {
        if (this._state !== State.PLAY || Board.animationPlaying || !this.canDouble()) return;

        const currentBet = this._player.getBet(this._currentPlayerHand);
        this._player.bet(currentBet, this._currentPlayerHand);
        this.disableAllButtons();
        this.refreshBankroll();
        this.refreshBet();

        // Drop the extra stake onto the correct pile (right panel for 1 hand, hand pile after split).
        const splitOccurred = this._player.getNumberHands() > 1;
        const location: "bet" | number = splitOccurred ? this._currentPlayerHand : "bet";
        await Board.receiveChipsFromDealer(location, currentBet);

        await this.dealOne("PLAYER", false);

        if (this._player.getHand(this._currentPlayerHand).isBust()) {
            await Board.showStateMessage("BUST", this._currentPlayerHand);
        }
        await this.nextHand();
    }

    async split(): Promise<void> {
        if (this._state !== State.PLAY || Board.animationPlaying || !this.canSplit()) return;

        const stake = this._player.getBet(this._currentPlayerHand);
        this._player.splitHand(this._currentPlayerHand);
        this._player.bet(stake, this._player.getNumberHands() - 1);
        this.refreshBankroll();
        this.refreshBet();

        await Board.splitCards();
        // After splitCards, move chips out of the right panel and into a pile under each hand.
        const handBets: number[] = [];
        for (let i = 0; i < this._player.getNumberHands(); i++) {
            handBets.push(this._player.getBet(i));
        }
        Board.distributeChipsToHands(handBets);

        // The split hand still has only one card — deal its second.
        await this.dealOne("PLAYER", false);

        const hand = this._player.getHand(this._currentPlayerHand);
        if (hand.isBust() || hand.getScore().includes(21)) {
            await this.nextHand();
        } else {
            this.enableButtons();
        }
    }

    async nextHand(): Promise<void> {
        if (this._currentPlayerHand < this._player.getNumberHands() - 1) {
            this._currentPlayerHand++;
            Board.switchHand(this._currentPlayerHand);
            this.refreshBet();

            // Fresh split hand: still has only one card — deal its second.
            if (this._player.getHand(this._currentPlayerHand).size() === 1) {
                await this.dealOne("PLAYER", false);
            }

            const hand = this._player.getHand(this._currentPlayerHand);
            if (hand.isBust() || hand.getScore().includes(21)) {
                await this.nextHand();
                return;
            }
            this.enableButtons();
            return;
        }
        await this.dealerTurn();
    }

    private async dealerTurn(): Promise<void> {
        // Wait for any in-flight animation before kicking off the dealer's turn.
        while (Board.animationPlaying) await sleep(50);

        this._state = State.DEALER;
        this.disableAllButtons();
        Board.endPlayerTurn();

        if (this._holeHidden) {
            await Board.revealHoleCard();
            this._holeHidden = false;
        }

        // Skip dealer draws if every player hand has already busted.
        if (this.anyHandAlive()) {
            while (this._dealerHand.bestScore() < 17 && !this._dealerHand.isBust()) {
                await this.dealOne("DEALER", false);
            }
        }

        await this.pay();
    }

    private anyHandAlive(): boolean {
        for (let i = 0; i < this._player.getNumberHands(); i++) {
            if (!this._player.getHand(i).isBust()) return true;
        }
        return false;
    }

    private async pay(): Promise<void> {
        this._state = State.FINISH;
        this.disableAllButtons();

        const dealerScore = this._dealerHand.bestScore();
        const dealerBust = this._dealerHand.isBust();
        const dealerBJ = this._dealerHand.isBlackjack();
        // After a split, a 2-card 21 is just 21, not natural blackjack.
        const splitOccurred = this._player.getNumberHands() > 1;
        const outcomes: Array<{ outcome: Outcome; bet: number; payout: number }> = [];

        for (let i = 0; i < this._player.getNumberHands(); i++) {
            const hand = this._player.getHand(i);
            const bet = this._player.getBet(i);
            const playerScore = hand.bestScore();
            const playerBJ = !splitOccurred && hand.isBlackjack();
            const playerBust = hand.isBust();

            let outcome: Outcome;
            let payout = 0; // total returned to bankroll for this hand
            if (playerBust) {
                outcome = "BUST";
            } else if (playerBJ && !dealerBJ) {
                outcome = "BLACKJACK";
                this._player.winBlackjack(i);
                payout = (5 / 2) * bet;
            } else if (dealerBJ && !playerBJ) {
                outcome = "LOSE";
            } else if (playerBJ && dealerBJ) {
                outcome = "PUSH";
                this._player.tie(i);
                payout = bet;
            } else if (dealerBust) {
                outcome = "WIN";
                this._player.winBet(i);
                payout = 2 * bet;
            } else if (playerScore > dealerScore) {
                outcome = "WIN";
                this._player.winBet(i);
                payout = 2 * bet;
            } else if (playerScore < dealerScore) {
                outcome = "LOSE";
            } else {
                outcome = "PUSH";
                this._player.tie(i);
                payout = bet;
            }

            outcomes.push({ outcome, bet, payout });
            await Board.showStateMessage(outcome, i);
        }

        this.refreshBankroll();

        // Animate chips per hand. With 1 hand, chips live in the right panel ("bet").
        // With multiple hands, each hand has its own pile.
        for (let i = 0; i < outcomes.length; i++) {
            const { outcome, bet, payout } = outcomes[i];
            const location: "bet" | number = splitOccurred ? i : "bet";
            const winnings = payout - bet;
            if (winnings > 0) {
                await Board.receiveChipsFromDealer(location, winnings);
                await sleep(250);
                await Board.fadeChipsAway(location);
            } else if (outcome === "PUSH") {
                await Board.fadeChipsAway(location);
            } else {
                await Board.sendChipsToDealer(location);
            }
        }

        await sleep(700);
        await this.restart();
    }

    private async restart(): Promise<void> {
        this._currentPlayerHand = 0;
        this._dealerHand = new Hand();
        this._player.clearHands();
        this._round++;
        this.refreshRound();
        this.refreshBet();
        Board.clearChipStack();
        await Board.clearHands();
        if (this._deck.getNbCards() < RESHUFFLE_THRESHOLD) {
            this.initDeck();
        }
        await this.openBet();
    }

    private gameOver(): void {
        this._state = State.OVER;
        this.disableAllButtons();
        requireEl("betPanel").classList.add("hidden");
        requireEl("gameOver").classList.remove("hidden");
    }

    async newGame(): Promise<void> {
        requireEl("gameOver").classList.add("hidden");
        this._round = 1;
        this._currentPlayerHand = 0;
        this._dealerHand = new Hand();
        this._player = new Player();
        this._player.setBankroll(STARTING_BANKROLL);
        this.initDeck();
        this.refreshBankroll();
        this.refreshBet();
        this.refreshRound();
        Board.clearChipStack();
        await Board.clearHands();
        await this.openBet();
    }

    // ---------- Hover score display ----------

    displayScore(handEl: HTMLElement): void {
        const scoreEl = requireEl("score");
        const parent = handEl.parentElement;
        if (!parent) return;

        let scores: number[];
        if (parent.id === "dealerHand") {
            if (this._holeHidden) {
                const upcard = this._dealerHand.getCards()[0];
                if (!upcard) return;
                scores = upcard.isAce() ? [1, 11] : [upcard.getScore()];
            } else {
                scores = this._dealerHand.getScore();
            }
        } else if (parent.id === "playerHand") {
            const idx = parseInt(handEl.dataset.hand ?? "0", 10);
            scores = this._player.getHand(idx).getScore();
        } else {
            return;
        }

        let text: string;
        if (scores.length > 1) {
            const valid = scores.filter((s) => s <= 21);
            text = valid.length > 0 ? valid.join(" or ") : Math.min(...scores).toString();
        } else {
            text = scores[0].toString();
        }

        scoreEl.textContent = text;
        scoreEl.classList.add("show");
    }

    hideScore(): void {
        const scoreEl = requireEl("score");
        scoreEl.textContent = "";
        scoreEl.classList.remove("show");
    }
}
