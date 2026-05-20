import "./assets/style.css";
import Game from "./components/Game";

window.addEventListener("load", () => {
    document.body.classList.remove("preload");

    const game = new Game();
    void game.start(1000, 6);

    const byId = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
        document.getElementById(id) as T | null;

    byId("standButton")?.addEventListener("click", () => void game.nextHand());
    byId("hitButton")?.addEventListener("click", () => void game.hit());
    byId("doubleButton")?.addEventListener("click", () => void game.double());
    byId("splitButton")?.addEventListener("click", () => void game.split());

    document.querySelectorAll<HTMLButtonElement>(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const value = parseInt(chip.dataset.value ?? "0", 10);
            if (value > 0) game.addToPendingBet(value);
        });
    });

    byId("clearBetButton")?.addEventListener("click", () => game.clearPendingBet());
    byId("dealButton")?.addEventListener("click", () => void game.confirmBet());
    byId("newGameButton")?.addEventListener("click", () => void game.newGame());

    let cardHover: HTMLElement | null = null;
    document.body.addEventListener("mousemove", (e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        const cardEl = target.classList.contains("card")
            ? target
            : (target.closest(".card") as HTMLElement | null);

        if (cardEl) {
            const hand = cardEl.parentElement;
            if (hand && hand.classList.contains("hand2")) {
                if (cardHover && cardHover !== hand) {
                    cardHover.classList.remove("hover");
                }
                hand.classList.add("hover");
                game.displayScore(hand);
                cardHover = hand;
                return;
            }
        }

        if (cardHover) {
            cardHover.classList.remove("hover");
            game.hideScore();
            cardHover = null;
        }
    });
});
