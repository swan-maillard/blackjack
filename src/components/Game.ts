import Player from "./Player";
import Deck from "./Deck";
import Card, { Suit } from "./Card";
import Hand from "./Hand";
import Board from "./Board";
import {
    adviseStrategy,
    currentChartKey,
    StrategyAction,
    StrategyAdvice,
} from "./Strategy";

enum State {
    CREATE,
    BET,
    DEAL,
    PLAY,
    DEALER,
    FINISH,
    OVER,
}

export enum Mode {
    FREE = "free",
    LEARNING = "learning",
    TRAINING = "training",
}

export interface TrainingStats {
    correct: number;
    total: number;
    streak: number;
    maxStreak: number;
}

const STATS_KEY = "blackjack.trainingStats";
const MODE_KEY = "blackjack.mode";
const CHART_VISIBLE_KEY = "blackjack.trainingChartVisible";
const AUTO_BET = 5;
const AUTO_REFILL = 1000;

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
    private _mode: Mode;
    private _trainingStats: TrainingStats;
    private _chartVisibleInTraining: boolean;

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
        this._mode = this.loadMode();
        this._trainingStats = this.loadStats();
        this._chartVisibleInTraining = this.loadChartVisible();

        this._buttons = {
            STAND: requireEl<HTMLButtonElement>("standButton"),
            HIT: requireEl<HTMLButtonElement>("hitButton"),
            DOUBLE: requireEl<HTMLButtonElement>("doubleButton"),
            SPLIT: requireEl<HTMLButtonElement>("splitButton"),
        };

        this.refreshModeUI();
        this.refreshStatsUI();
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
        this.clearRecommendation();
    }

    private enableButtons(): void {
        this.disableAllButtons();
        this.clearEvaluationMarks();
        this._buttons.STAND.classList.remove("disabled");
        this._buttons.HIT.classList.remove("disabled");
        if (this.canDouble()) this._buttons.DOUBLE.classList.remove("disabled");
        if (this.canSplit()) this._buttons.SPLIT.classList.remove("disabled");

        // In learning mode, glow the recommended button and update the chart panel.
        if (this._mode === Mode.LEARNING) {
            const advice = this.currentAdvice();
            if (advice) {
                this.highlightRecommendation(advice.action);
                this.refreshLearningHint(advice);
                this.refreshChartHighlight();
            }
        }
        if (this._mode === Mode.TRAINING) {
            this.refreshTrainingHint();
            if (this._chartVisibleInTraining) this.refreshChartHighlight();
        }
    }

    private clearRecommendation(): void {
        this._buttons.STAND.classList.remove("recommended");
        this._buttons.HIT.classList.remove("recommended");
        this._buttons.DOUBLE.classList.remove("recommended");
        this._buttons.SPLIT.classList.remove("recommended");
    }

    private highlightRecommendation(action: StrategyAction): void {
        const map: Record<StrategyAction, HTMLButtonElement> = {
            HIT: this._buttons.HIT,
            STAND: this._buttons.STAND,
            DOUBLE: this._buttons.DOUBLE,
            SPLIT: this._buttons.SPLIT,
        };
        map[action].classList.add("recommended");
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
        if (this._mode !== Mode.FREE) {
            // In Learning/Training there is no betting UI — auto-bet and deal.
            this._state = State.BET;
            this.disableAllButtons();
            Board.clearChipStack();
            requireEl("betPanel").classList.add("hidden");
            if (this._player.getBankroll() < AUTO_BET) {
                this._player.setBankroll(AUTO_REFILL);
            }
            this._player.bet(AUTO_BET, 0);
            Board.addBetChip(AUTO_BET);
            this.refreshBankroll();
            this.refreshBet();
            await this.deal();
            return;
        }

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
        this.evaluateMove("HIT");
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
        this.evaluateMove("DOUBLE");

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
        this.evaluateMove("SPLIT");

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

    async stand(): Promise<void> {
        if (this._state !== State.PLAY || Board.animationPlaying) return;
        this.evaluateMove("STAND");
        await this.nextHand();
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

    // ---------- Mode + strategy feedback ----------

    getMode(): Mode {
        return this._mode;
    }

    setMode(mode: Mode): void {
        if (this._mode === mode) return;
        this._mode = mode;
        try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
        this.refreshModeUI();
        this.refreshStatsUI();

        // If the player is still placing chips in Free mode and switches modes,
        // refund and re-open with the new mode (auto-deal if going non-free).
        if (this._state === State.BET) {
            if (this._totalBet() > 0) {
                this._player.refundBet(0);
                Board.clearChipStack();
                this.refreshBankroll();
                this.refreshBet();
            }
            void this.openBet();
            return;
        }

        if (this._state === State.PLAY && !Board.animationPlaying) {
            this.enableButtons();
        } else {
            this.clearRecommendation();
            this.hideLearningHint();
            this.hideTrainingHint();
            this.clearChartHighlight();
            if (this._mode === Mode.LEARNING) this.refreshChartHighlight();
        }
    }

    toggleTrainingChart(): void {
        this._chartVisibleInTraining = !this._chartVisibleInTraining;
        try { localStorage.setItem(CHART_VISIBLE_KEY, String(this._chartVisibleInTraining)); }
        catch { /* ignore */ }
        this.refreshModeUI();
        if (this._mode === Mode.TRAINING && this._chartVisibleInTraining) {
            this.refreshChartHighlight();
        } else {
            this.clearChartHighlight();
        }
    }

    resetTrainingStats(): void {
        this._trainingStats = { correct: 0, total: 0, streak: 0, maxStreak: 0 };
        this.persistStats();
        this.refreshStatsUI();
    }

    getTrainingStats(): TrainingStats {
        return { ...this._trainingStats };
    }

    private loadMode(): Mode {
        try {
            const v = localStorage.getItem(MODE_KEY);
            if (v === Mode.LEARNING || v === Mode.TRAINING || v === Mode.FREE) return v;
        } catch { /* ignore */ }
        return Mode.FREE;
    }

    private loadChartVisible(): boolean {
        try {
            const v = localStorage.getItem(CHART_VISIBLE_KEY);
            if (v === "true") return true;
        } catch { /* ignore */ }
        return false;
    }

    private loadStats(): TrainingStats {
        try {
            const raw = localStorage.getItem(STATS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<TrainingStats>;
                return {
                    correct: parsed.correct ?? 0,
                    total: parsed.total ?? 0,
                    streak: parsed.streak ?? 0,
                    maxStreak: parsed.maxStreak ?? 0,
                };
            }
        } catch { /* ignore */ }
        return { correct: 0, total: 0, streak: 0, maxStreak: 0 };
    }

    private persistStats(): void {
        try { localStorage.setItem(STATS_KEY, JSON.stringify(this._trainingStats)); } catch { /* ignore */ }
    }

    private currentAdvice(): StrategyAdvice | null {
        if (this._state !== State.PLAY) return null;
        const upcard = this._dealerHand.getCards()[0];
        if (!upcard) return null;
        const cards = this._player.getHand(this._currentPlayerHand).getCards();
        if (cards.length < 2) return null;
        return adviseStrategy({
            playerCards: cards,
            dealerUpcard: upcard,
            canDouble: this.canDouble(),
            canSplit: this.canSplit(),
        });
    }

    /**
     * Called from each action handler. In TRAINING mode, scores the guess and
     * displays a toast. In LEARNING mode, no scoring — the recommended button
     * already glowed.
     */
    private evaluateMove(chosen: StrategyAction): void {
        if (this._mode !== Mode.TRAINING) return;
        const advice = this.currentAdvice();
        if (!advice) return;

        const isCorrect = chosen === advice.action;
        this._trainingStats.total++;
        if (isCorrect) {
            this._trainingStats.correct++;
            this._trainingStats.streak++;
            if (this._trainingStats.streak > this._trainingStats.maxStreak) {
                this._trainingStats.maxStreak = this._trainingStats.streak;
            }
        } else {
            this._trainingStats.streak = 0;
        }
        this.persistStats();
        this.refreshStatsUI();
        this.markEvaluation(chosen, isCorrect, advice.action);
        this.showTrainingFeedback(isCorrect, chosen, advice);
    }

    /**
     * Mark the chosen button green (correct) or red (wrong). On a wrong choice,
     * also mark the action the player should have taken with green. Marks stay
     * until the next decision is enabled (cleared by enableButtons).
     */
    private markEvaluation(
        chosen: StrategyAction,
        correct: boolean,
        ideal: StrategyAction,
    ): void {
        const map: Record<StrategyAction, HTMLButtonElement> = {
            HIT: this._buttons.HIT,
            STAND: this._buttons.STAND,
            DOUBLE: this._buttons.DOUBLE,
            SPLIT: this._buttons.SPLIT,
        };
        this.clearEvaluationMarks();
        // Force reflow so the animation restarts on consecutive identical actions.
        void map[chosen].offsetWidth;
        if (correct) {
            map[chosen].classList.add("flash-correct");
        } else {
            map[chosen].classList.add("flash-wrong");
            map[ideal].classList.add("flash-correct");
        }
    }

    private clearEvaluationMarks(): void {
        this._buttons.HIT.classList.remove("flash-correct", "flash-wrong");
        this._buttons.STAND.classList.remove("flash-correct", "flash-wrong");
        this._buttons.DOUBLE.classList.remove("flash-correct", "flash-wrong");
        this._buttons.SPLIT.classList.remove("flash-correct", "flash-wrong");
    }

    private showTrainingFeedback(
        correct: boolean,
        chosen: StrategyAction,
        advice: StrategyAdvice,
    ): void {
        const hint = document.getElementById("trainingHint");
        if (!hint) return;
        hint.classList.remove("neutral", "correct", "wrong");
        if (correct) {
            hint.textContent = `✓ Correct — ${chosen}`;
            hint.classList.add("show", "correct");
        } else {
            const idealLabel = advice.action === advice.ideal
                ? advice.ideal
                : `${advice.ideal} (legal here: ${advice.action})`;
            hint.textContent = `✗ Best was ${idealLabel} — you played ${chosen}`;
            hint.classList.add("show", "wrong");
        }
    }

    private refreshModeUI(): void {
        document.querySelectorAll<HTMLButtonElement>(".modeButton").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === this._mode);
        });
        const board = document.getElementById("boardGame");
        if (board) {
            board.dataset.mode = this._mode;
        }
        const statsPanel = document.getElementById("trainingPanel");
        if (statsPanel) statsPanel.classList.toggle("hidden", this._mode !== Mode.TRAINING);

        const chartVisible =
            this._mode === Mode.LEARNING ||
            (this._mode === Mode.TRAINING && this._chartVisibleInTraining);
        const chartPanel = document.getElementById("strategyChart");
        if (chartPanel) chartPanel.classList.toggle("hidden", !chartVisible);

        const toggleBtn = document.getElementById("toggleChartButton");
        if (toggleBtn) {
            toggleBtn.textContent = this._chartVisibleInTraining
                ? "Hide strategy"
                : "Show strategy";
            toggleBtn.classList.toggle("active", this._chartVisibleInTraining);
        }

        // Reset any inline reset-confirm UI when switching modes.
        const confirmEl = document.getElementById("resetConfirm");
        const resetBtn = document.getElementById("resetStatsButton");
        if (confirmEl) confirmEl.classList.add("hidden");
        if (resetBtn) resetBtn.classList.remove("hidden");

        if (this._mode !== Mode.LEARNING) {
            this.hideLearningHint();
        }
        if (!chartVisible) {
            this.clearChartHighlight();
        }
        if (this._mode !== Mode.TRAINING) {
            this.hideTrainingHint();
        }
    }

    private refreshStatsUI(): void {
        const correctEl = document.getElementById("statCorrect");
        const totalEl = document.getElementById("statTotal");
        const accuracyEl = document.getElementById("statAccuracy");
        const streakEl = document.getElementById("statStreak");
        const maxStreakEl = document.getElementById("statMaxStreak");
        const s = this._trainingStats;
        if (correctEl) correctEl.textContent = s.correct.toString();
        if (totalEl) totalEl.textContent = s.total.toString();
        if (accuracyEl) {
            accuracyEl.textContent = s.total === 0
                ? "—"
                : `${Math.round((s.correct / s.total) * 100)}%`;
        }
        if (streakEl) streakEl.textContent = s.streak.toString();
        if (maxStreakEl) maxStreakEl.textContent = s.maxStreak.toString();
    }

    private refreshLearningHint(advice: StrategyAdvice): void {
        const hint = document.getElementById("learningHint");
        if (!hint) return;
        const detail = advice.note ? ` — ${advice.note}` : "";
        const idealSuffix = advice.action === advice.ideal ? "" : ` (ideal: ${advice.ideal})`;
        hint.textContent = `Recommended: ${advice.action}${idealSuffix}${detail}`;
        hint.classList.add("show");
    }

    private hideLearningHint(): void {
        const hint = document.getElementById("learningHint");
        if (hint) hint.classList.remove("show");
    }

    private refreshTrainingHint(): void {
        const hint = document.getElementById("trainingHint");
        if (!hint) return;
        hint.classList.remove("correct", "wrong");
        hint.classList.add("neutral");
        hint.textContent = "Your turn — pick the best move";
        hint.classList.add("show");
    }

    private hideTrainingHint(): void {
        const hint = document.getElementById("trainingHint");
        if (!hint) return;
        hint.classList.remove("show", "neutral", "correct", "wrong");
    }

    private refreshChartHighlight(): void {
        const chart = document.getElementById("strategyChart");
        if (!chart) return;
        this.clearChartHighlight();
        const upcard = this._dealerHand.getCards()[0];
        if (!upcard) return;
        const cards = this._player.getHand(this._currentPlayerHand).getCards();
        if (cards.length < 2) return;
        const key = currentChartKey(cards);
        const dKey = upcard.isAce() ? "A" : upcard.getScore().toString();
        const rowKey = `${key.category}:${key.key}`;
        const cell = chart.querySelector<HTMLElement>(
            `[data-row="${rowKey}"][data-col="${dKey}"]`,
        );
        if (cell) cell.classList.add("current");
        const rowHeader = chart.querySelector<HTMLElement>(
            `[data-row-header="${rowKey}"]`,
        );
        if (rowHeader) rowHeader.classList.add("current");
        const colHeader = chart.querySelector<HTMLElement>(
            `[data-col-header="${dKey}"]`,
        );
        if (colHeader) colHeader.classList.add("current");
    }

    private clearChartHighlight(): void {
        const chart = document.getElementById("strategyChart");
        if (!chart) return;
        chart.querySelectorAll<HTMLElement>(".current").forEach((el) =>
            el.classList.remove("current"),
        );
    }
}
