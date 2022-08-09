import Card from "./Card";

type HandType = ("DEALER"|"PLAYER");
const hands = {
    DEALER: document.getElementById("dealerHand") as HTMLElement,
    PLAYER: document.getElementById("playerHand") as HTMLElement,
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default class Board {
    public static animationPlaying = false;
    public static dealingSpeed = 700;

    static async dealCard(card: Card | undefined, hand: HandType) {
        if (card === undefined) return;

        this.animationPlaying = true;

        let cardsNumber = document.getElementById("deckCardsNumber") as HTMLElement;
        let nbCards = cardsNumber.textContent as string;
        cardsNumber.textContent = (parseInt(nbCards) - 1).toString();

        let handHTML = hands[hand];

        let deck = document.getElementById("deck") as HTMLElement;
        let backCard = deck.cloneNode(true) as HTMLElement;
        document.body.appendChild(backCard);

        let offsetTop = 20*handHTML.children.length;
        let offsetRight = 20*handHTML.children.length;
        if (hand === "DEALER") offsetTop *= -1;
        backCard.style.top = (handHTML.getBoundingClientRect().top - offsetTop).toString() + "px";
        backCard.style.right = (handHTML.getBoundingClientRect().right - backCard.clientWidth - offsetRight).toString() + "px";

        await sleep(this.dealingSpeed);

        backCard.remove();
        let frontCard = document.createElement("div");
        frontCard.classList.add("card")
        frontCard.style.backgroundImage = 'url(' + card.getUrl() + ')';
        frontCard.style.bottom = offsetTop.toString() + "px";
        frontCard.style.left = offsetRight.toString() + "px";
        handHTML.appendChild(frontCard);

        this.animationPlaying = false;
    }

    static async clearHands() {
        this.animationPlaying = true;

        let cards = document.getElementsByClassName('card') as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let parent = card.parentElement as HTMLElement;

            if (parent.classList.contains("hand")) {
                card.style.backgroundImage = "url(" + Card.getBackUrl() + ")";
                card.style.bottom = (parent.getBoundingClientRect().bottom).toString() + "px";
                card.style.left = (-parent.getBoundingClientRect().left).toString() + "px";
            }
        }
        await sleep(this.dealingSpeed);
        hands.DEALER.innerHTML = "";
        hands.PLAYER.innerHTML = "";

        this.animationPlaying = false;
    }
}
