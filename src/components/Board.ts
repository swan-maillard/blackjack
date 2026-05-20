import Card from "./Card";

export type HandType = "DEALER" | "PLAYER";

function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as T;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let _hands: Record<HandType, HTMLElement> | null = null;
function hands(): Record<HandType, HTMLElement> {
    if (!_hands) {
        _hands = {
            DEALER: requireEl("dealerHand"),
            PLAYER: requireEl("playerHand"),
        };
    }
    return _hands;
}

interface DealOptions {
    hidden?: boolean;
}

export default class Board {
    public static animationPlaying = false;
    public static dealingSpeed = 500;
    public static flipSpeed = 600;
    public static offsetCards = 26;

    private static getCurrentHand(side: HandType): HTMLElement {
        const sideEl = hands()[side];
        const children = sideEl.children as HTMLCollectionOf<HTMLElement>;
        if (children.length === 0) {
            const handEl = document.createElement("div");
            handEl.classList.add("hand2", "currentHand");
            handEl.dataset.hand = "0";
            sideEl.append(handEl);
            return handEl;
        }
        for (let i = 0; i < children.length; i++) {
            if (children[i].classList.contains("currentHand")) {
                return children[i];
            }
        }
        return children[0];
    }

    private static countCards(handEl: HTMLElement): number {
        let count = 0;
        for (const child of Array.from(handEl.children)) {
            if (child.classList.contains("card")) count++;
        }
        return count;
    }

    private static buildCardEl(card: Card): HTMLElement {
        const wrapper = document.createElement("div");
        wrapper.classList.add("card");

        const inner = document.createElement("div");
        inner.classList.add("card-inner");

        const back = document.createElement("div");
        back.classList.add("card-face", "card-back");

        const front = document.createElement("div");
        front.classList.add("card-face", "card-front");
        front.style.backgroundImage = `url('${card.getUrl()}')`;

        inner.append(back, front);
        wrapper.append(inner);
        return wrapper;
    }

    static async dealCard(card: Card | undefined, side: HandType, options: DealOptions = {}): Promise<void> {
        if (!card) return;
        this.animationPlaying = true;

        const handEl = this.getCurrentHand(side);
        const deckEl = requireEl("deck");
        const cardEl = this.buildCardEl(card);
        if (options.hidden) cardEl.classList.add("hidden-card");

        const deckRect = deckEl.getBoundingClientRect();
        const handRect = handEl.getBoundingClientRect();
        cardEl.style.top = `${deckRect.top - handRect.top}px`;
        cardEl.style.left = `${deckRect.left - handRect.left}px`;
        handEl.appendChild(cardEl);

        // Force layout so the starting position is honored before transition
        void cardEl.offsetWidth;

        const cards = Array.from(handEl.children).filter((c) =>
            c.classList.contains("card"),
        ) as HTMLElement[];
        const myIndex = cards.length - 1;
        const offsetTop = (side === "DEALER" ? 1 : -1) * this.offsetCards;
        const offsetLeft = this.offsetCards;

        // Anchor subsequent cards off card[0] so split-positioned stacks line up
        const baseTop = myIndex > 0 ? parseInt(cards[0].style.top, 10) || 0 : 0;
        const baseLeft = myIndex > 0 ? parseInt(cards[0].style.left, 10) || 0 : 0;

        cardEl.style.top = `${baseTop + myIndex * offsetTop}px`;
        cardEl.style.left = `${baseLeft + myIndex * offsetLeft}px`;

        // Realign any intermediate cards in case the hand layout was reshaped (split)
        for (let i = 1; i < myIndex; i++) {
            cards[i].style.top = `${baseTop + i * offsetTop}px`;
            cards[i].style.left = `${baseLeft + i * offsetLeft}px`;
        }

        await sleep(this.dealingSpeed);

        if (!options.hidden) {
            cardEl.classList.add("flipped");
            await sleep(this.flipSpeed);
        }

        this.animationPlaying = false;
    }

    static async revealHoleCard(): Promise<void> {
        const handEl = this.getCurrentHand("DEALER");
        const hidden = handEl.querySelector<HTMLElement>(".hidden-card");
        if (!hidden) return;
        this.animationPlaying = true;
        hidden.classList.remove("hidden-card");
        hidden.classList.add("flipped");
        await sleep(this.flipSpeed);
        this.animationPlaying = false;
    }

    static async clearHands(): Promise<void> {
        this.animationPlaying = true;
        const cardEls = document.querySelectorAll<HTMLElement>(".hand .card");
        cardEls.forEach((card) => {
            const parent = card.parentElement;
            if (!parent) return;
            const parentRect = parent.getBoundingClientRect();
            card.classList.remove("flipped");
            card.style.opacity = "0";
            card.style.top = `${-parentRect.top - card.clientHeight}px`;
            card.style.left = "0px";
        });

        const stateMessages = document.querySelectorAll<HTMLElement>(".stateMessage");
        stateMessages.forEach((el) => el.classList.remove("show"));

        await sleep(this.dealingSpeed);
        hands().DEALER.innerHTML = "";
        hands().PLAYER.innerHTML = "";
        this.animationPlaying = false;
    }

    static async splitCards(): Promise<void> {
        this.animationPlaying = true;
        const playerSide = hands().PLAYER;
        const handEl = this.getCurrentHand("PLAYER");

        // Move the last card into a new hand2 div
        const cards = Array.from(handEl.children).filter((c) =>
            c.classList.contains("card"),
        ) as HTMLElement[];
        const lastCard = cards[cards.length - 1];
        lastCard.remove();

        const handsHTML = playerSide.children as HTMLCollectionOf<HTMLElement>;
        const newHand = document.createElement("div");
        newHand.classList.add("hand2");
        newHand.dataset.hand = handsHTML.length.toString();
        newHand.append(lastCard);
        playerSide.append(newHand);

        await sleep(30);

        const nbHands = handsHTML.length;
        for (let i = 0; i < nbHands; i++) {
            const handCards = Array.from(handsHTML[i].children).filter((c) =>
                c.classList.contains("card"),
            ) as HTMLElement[];
            for (let j = 0; j < handCards.length; j++) {
                const c = handCards[j];
                let coeff =
                    2 *
                    Math.sign((nbHands - 1) / 2 - i) *
                    Math.round(Math.abs((nbHands - 1) / 2 - i));
                if (nbHands % 2 === 0) coeff -= Math.sign(coeff);
                c.style.top = `${-50 - j * this.offsetCards}px`;
                c.style.left = `${coeff * c.clientWidth + j * this.offsetCards}px`;
            }
        }
        await sleep(this.dealingSpeed);
        this.animationPlaying = false;
    }

    static switchHand(hand: number): void {
        const handsHTML = hands().PLAYER.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < handsHTML.length; i++) {
            const idx = parseInt(handsHTML[i].dataset.hand ?? "-1", 10);
            handsHTML[i].classList.toggle("currentHand", idx === hand);
        }
    }

    static async showStateMessage(message: string, hand: number, side: HandType = "PLAYER"): Promise<void> {
        const sideEl = hands()[side];
        const handsHTML = sideEl.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < handsHTML.length; i++) {
            const idx = parseInt(handsHTML[i].dataset.hand ?? "0", 10);
            if (idx !== hand) continue;

            let stateMessage = handsHTML[i].querySelector<HTMLElement>(".stateMessage");
            const isNew = !stateMessage;
            if (!stateMessage) {
                stateMessage = document.createElement("div");
                stateMessage.classList.add("stateMessage");
                handsHTML[i].appendChild(stateMessage);
            }
            stateMessage.dataset.kind = message.toLowerCase();
            stateMessage.textContent = message;

            // Anchor the badge over the actual cards of THIS hand, so split hands
            // each show their own badge instead of stacking at the same spot.
            const cardsOfHand = Array.from(handsHTML[i].children).filter((c) =>
                c.classList.contains("card"),
            ) as HTMLElement[];
            if (cardsOfHand.length > 0) {
                const tops = cardsOfHand.map((c) => parseInt(c.style.top, 10) || 0);
                const lefts = cardsOfHand.map((c) => parseInt(c.style.left, 10) || 0);
                const topmost = Math.min(...tops);
                const avgLeft = lefts.reduce((a, b) => a + b, 0) / lefts.length;
                const cardWidth = cardsOfHand[0].clientWidth || 120;
                stateMessage.style.left = `${avgLeft + cardWidth / 2}px`;
                stateMessage.style.top = `${topmost - 8}px`;
            }

            if (isNew) await sleep(30);
            stateMessage.classList.add("show");
        }
    }

    static endPlayerTurn(): void {
        const handsHTML = hands().PLAYER.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < handsHTML.length; i++) {
            handsHTML[i].classList.add("currentHand");
        }
    }

    // ---------- Chip stack ----------
    //
    // Chips render as ONE column (no per-denomination piles). Each chip is absolutely
    // positioned by its --chip-index inside a container. The container is either
    // #chipStack (during bet phase or single-hand play) or a per-hand .hand-chips
    // div nested in each .hand2 (after split). `Location` is "bet" or a hand index.

    private static readonly CHIP_DENOMINATIONS: readonly number[] = [500, 100, 25, 5];

    private static decompose(amount: number): number[] {
        const out: number[] = [];
        let remaining = Math.max(0, Math.round(amount));
        for (const d of this.CHIP_DENOMINATIONS) {
            while (remaining >= d) {
                out.push(d);
                remaining -= d;
            }
        }
        return out;
    }

    private static makeChipEl(denom: number, index: number): HTMLElement {
        const chip = document.createElement("div");
        chip.classList.add("stack-chip", `chip-${denom}`);
        chip.style.setProperty("--chip-index", index.toString());
        const label = document.createElement("span");
        label.textContent = denom.toString();
        chip.appendChild(label);
        return chip;
    }

    private static findHand2(handIdx: number): HTMLElement | null {
        const children = hands().PLAYER.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < children.length; i++) {
            if (parseInt(children[i].dataset.hand ?? "-1", 10) === handIdx) return children[i];
        }
        return null;
    }

    private static getOrCreateHandPile(handEl: HTMLElement): HTMLElement {
        let pile = handEl.querySelector<HTMLElement>(":scope > .hand-chips");
        if (pile) return pile;
        pile = document.createElement("div");
        pile.classList.add("hand-chips");
        // Center the pile horizontally on the hand's cards.
        const cards = Array.from(handEl.children).filter((c) =>
            c.classList.contains("card"),
        ) as HTMLElement[];
        let centerLeft = 60; // .hand2 is 120 wide
        if (cards.length > 0) {
            const lefts = cards.map((c) => parseInt(c.style.left, 10) || 0);
            const avg = lefts.reduce((a, b) => a + b, 0) / lefts.length;
            centerLeft = avg + (cards[0].clientWidth || 120) / 2;
        }
        pile.style.left = `${centerLeft}px`;
        handEl.appendChild(pile);
        return pile;
    }

    /**
     * Inside a container (#chipStack or a .hand-chips), find or create the
     * sub-pile for a given denomination. Sub-piles are kept ordered largest-first.
     */
    private static getOrCreateDenomPile(container: HTMLElement, denom: number): HTMLElement {
        let pile = container.querySelector<HTMLElement>(
            `:scope > .chip-pile[data-denom="${denom}"]`,
        );
        if (pile) return pile;
        pile = document.createElement("div");
        pile.classList.add("chip-pile");
        pile.dataset.denom = denom.toString();
        const siblings = Array.from(
            container.querySelectorAll<HTMLElement>(":scope > .chip-pile"),
        );
        let anchor: HTMLElement | null = null;
        for (const s of siblings) {
            const sDenom = parseInt(s.dataset.denom ?? "0", 10);
            if (denom > sDenom) {
                anchor = s;
                break;
            }
        }
        container.insertBefore(pile, anchor);
        return pile;
    }

    private static getContainer(location: "bet" | number): HTMLElement | null {
        if (location === "bet") return requireEl("chipStack");
        const handEl = this.findHand2(location);
        return handEl ? this.getOrCreateHandPile(handEl) : null;
    }

    private static chipCountIn(pile: HTMLElement): number {
        return pile.querySelectorAll(":scope > .stack-chip").length;
    }

    static addBetChip(denom: number): void {
        if (denom <= 0) return;
        const container = this.getContainer("bet");
        if (!container) return;
        const pile = this.getOrCreateDenomPile(container, denom);
        pile.appendChild(this.makeChipEl(denom, this.chipCountIn(pile)));
    }

    static clearChipStack(): void {
        requireEl("chipStack").innerHTML = "";
        document.querySelectorAll<HTMLElement>(".hand-chips").forEach((p) => p.remove());
    }

    /**
     * Move the current bet chips out of the right-side stack into per-hand piles
     * under each split hand. Called from Game.split.
     */
    static distributeChipsToHands(handBets: ReadonlyArray<number>): void {
        requireEl("chipStack").innerHTML = "";
        document.querySelectorAll<HTMLElement>(".hand-chips").forEach((p) => p.remove());
        for (let i = 0; i < handBets.length; i++) {
            const handEl = this.findHand2(i);
            if (!handEl) continue;
            const container = this.getOrCreateHandPile(handEl);
            for (const d of this.decompose(handBets[i])) {
                const pile = this.getOrCreateDenomPile(container, d);
                pile.appendChild(this.makeChipEl(d, this.chipCountIn(pile)));
            }
        }
    }

    static async receiveChipsFromDealer(location: "bet" | number, amount: number): Promise<void> {
        const container = this.getContainer(location);
        if (!container) return;
        const denoms = this.decompose(amount);
        if (denoms.length === 0) return;
        const newChips: HTMLElement[] = denoms.map((d) => {
            const pile = this.getOrCreateDenomPile(container, d);
            const chip = this.makeChipEl(d, this.chipCountIn(pile));
            chip.classList.add("flying-in");
            pile.appendChild(chip);
            return chip;
        });
        void newChips[0].offsetWidth;
        newChips.forEach((c, i) => setTimeout(() => c.classList.remove("flying-in"), i * 70));
        await sleep(650 + newChips.length * 70);
    }

    static async sendChipsToDealer(location: "bet" | number): Promise<void> {
        const container = this.getContainer(location);
        if (!container) return;
        const chips = Array.from(container.querySelectorAll<HTMLElement>(".stack-chip")).reverse();
        if (chips.length === 0) return;
        chips.forEach((c, i) => setTimeout(() => c.classList.add("flying-up"), i * 50));
        await sleep(650 + chips.length * 50);
        chips.forEach((c) => c.remove());
    }

    static async fadeChipsAway(location: "bet" | number): Promise<void> {
        const container = this.getContainer(location);
        if (!container) return;
        const chips = Array.from(container.querySelectorAll<HTMLElement>(".stack-chip"));
        if (chips.length === 0) return;
        chips.forEach((c, i) => setTimeout(() => c.classList.add("fading-out"), i * 30));
        await sleep(500 + chips.length * 30);
        chips.forEach((c) => c.remove());
    }
}
