import "./assets/style.css";
import Game from "./components/Game";
import Board from "./components/Board";

window.onload = () => {
    document.body.classList.remove("preload");

    const game = new Game();

    game.start(100, 8);

    let standButton = document.getElementById("standButton") as HTMLButtonElement;
    let hitButton = document.getElementById("hitButton") as HTMLButtonElement;
    let doubleButton = document.getElementById("doubleButton") as HTMLButtonElement;
    let shareButton = document.getElementById("shareButton") as HTMLButtonElement;

    standButton.addEventListener("click", () => game.stand());
    hitButton.addEventListener("click", () => game.hit());
    doubleButton.addEventListener("click", () => game.double());
    //shareButton.addEventListener("click", () => game.share());

    document.body.addEventListener("mouseover", e => {
        if (game.isPlaying()) {
            let target = e.target as HTMLElement;

            if (target.classList.contains("card"))  {
                let parent = target.parentElement as HTMLElement;
                if (parent.classList.contains("hand")) {
                    parent.classList.add("hover")
                    game.displayScore(parent);
                }
            }
        }

    })

    document.body.addEventListener("mouseout", e => {
        let target = e.target as HTMLElement;

        if (target.classList.contains("card"))  {
            let parent = target.parentElement as HTMLElement;
            if (parent.classList.contains("hand")) {
                parent.classList.remove("hover")
                game.hideScore();
            }
        }
    })

}

