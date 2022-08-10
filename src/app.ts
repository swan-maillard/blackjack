import "./assets/style.css";
import Game from "./components/Game";

window.onload = () => {
    document.body.classList.remove("preload");

    const game = new Game();

    game.start(1000, 8);

    let standButton = document.getElementById("standButton") as HTMLButtonElement;
    let hitButton = document.getElementById("hitButton") as HTMLButtonElement;
    let doubleButton = document.getElementById("doubleButton") as HTMLButtonElement;
    let splitButton = document.getElementById("splitButton") as HTMLButtonElement;

    standButton.addEventListener("click", () => game.nextHand());
    hitButton.addEventListener("click", () => game.hit());
    doubleButton.addEventListener("click", () => game.double());
    splitButton.addEventListener("click", () => game.split());

    let cardHover: HTMLElement;

    document.body.addEventListener("mousemove", e => {
        let target = e.target as HTMLElement;

        if (target.classList.contains("card")) {
            let hand = target.parentElement as HTMLElement;
            if (hand.classList.contains("hand2")) {
                hand.classList.add("hover")
                game.displayScore(hand);
                cardHover = hand;
            }
        }
        else if (cardHover !== undefined) {
            if (cardHover.classList.contains("hand2")) {
                cardHover.classList.remove("hover")
                game.hideScore();
            }
            cardHover = undefined;
        }

    });

}

