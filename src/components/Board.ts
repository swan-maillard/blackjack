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
    public static offsetCards = 20;

    static async dealCard(card: Card | undefined, hand: HandType) {
        if (card === undefined) return;

        this.animationPlaying = true;

        let deckHTML = document.getElementById("deck") as HTMLElement;
        deckHTML.setAttribute("data-content", (parseInt(deckHTML.dataset.content) - 1).toString());


        let handsHTML = hands[hand].children as HTMLCollectionOf<HTMLElement>;
        let handHTML: HTMLElement;
        if (handsHTML.length === 0) {
            handHTML = document.createElement("div");
            handHTML.classList.add("hand2", "currentHand");
            handHTML.setAttribute("data-hand", "0");
            hands[hand].append(handHTML);
        }
        else {
            for (let i = 0; i < handsHTML.length; i++) {
                if (handsHTML[i].classList.contains("currentHand")) {
                    handHTML = handsHTML[i];
                }
            }
        }

        let deck = document.getElementById("deck");

        let newCard = document.createElement("div");
        newCard.classList.add("card", "backCard");
        newCard.style.backgroundImage = 'url(' + card.getUrl() + ')';
        newCard.style.top = (deck.getBoundingClientRect().top - handHTML.getBoundingClientRect().top).toString() + "px";
        newCard.style.left = (deck.getBoundingClientRect().left - handHTML.getBoundingClientRect().left).toString() + "px";
        handHTML.appendChild(newCard);

        await sleep(100);

        let offsetTop = -this.offsetCards;
        let offsetLeft = this.offsetCards;
        if (hand === "DEALER") offsetTop *= -1;
        if (handHTML.children.length > 1) {
            let lastCard = handHTML.lastChild.previousSibling as HTMLElement;
            newCard.style.top = (lastCard.getBoundingClientRect().top - handHTML.getBoundingClientRect().top + offsetTop).toString() + "px";
            newCard.style.left = (lastCard.getBoundingClientRect().left - handHTML.getBoundingClientRect().left + offsetLeft).toString() + "px";
        }
        else {
            newCard.style.top = "0px";
            newCard.style.left = "0px";
        }


        await sleep(this.dealingSpeed);

        newCard.classList.remove("backCard");

        setTimeout(() => {
            let cards = handHTML.children as HTMLCollectionOf<HTMLElement>;
            for (let i = 1; i < cards.length; i++) {
                if (!cards[i].classList.contains("stateMessage")) {
                    cards[i].style.top = (parseInt(cards[0].style.top) + i * offsetTop).toString() + "px";
                    cards[i].style.left = (parseInt(cards[0].style.left) + i * offsetLeft).toString() + "px";
                }
            }
        }, 100);


        this.animationPlaying = false;
    }

    static async clearHands() {
        this.animationPlaying = true;

        let cards = document.getElementsByClassName('card') as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let parent = card.parentElement as HTMLElement;

            if (parent.classList.contains("hand2")) {
                card.classList.add("backCard");
                card.style.top = (-parent.getBoundingClientRect().top - card.clientHeight).toString() + "px";
                card.style.left = "0px";
            }
        }

        let stateMessages = document.getElementsByClassName('stateMessage') as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < stateMessages.length; i++) {
            stateMessages[i].style.transform = "scale(0)";
        }

        await sleep(this.dealingSpeed);
        hands.DEALER.innerHTML = "";
        hands.PLAYER.innerHTML = "";

        this.animationPlaying = false;
    }

    static async splitCards() {
        this.animationPlaying = true;

        let handsHTML = hands.PLAYER.children as HTMLCollectionOf<HTMLElement>;
        let handHTML: HTMLElement;
        for (let i = 0; i < handsHTML.length; i++) {
            if (handsHTML[i].classList.contains("currentHand")) {
                handHTML = handsHTML[i];
            }
        }

        let card = handHTML.lastChild as HTMLElement;
        card.remove();
        let newHand = document.createElement("div");
        newHand.classList.add("hand2");
        newHand.setAttribute("data-hand", handsHTML.length.toString());
        newHand.append(card);
        hands.PLAYER.append(newHand);

        await sleep(100);

        let nbHands = handsHTML.length;

        for (let i = 0; i < nbHands; i++) {
            let cards = handsHTML[i].children;

            for (let j = 0; j < cards.length; j++) {
                let card = cards[j] as HTMLElement;
                let coeff = 2*Math.sign((nbHands - 1)/2 - i)*Math.round(Math.abs((nbHands - 1)/2 - i));
                if (nbHands % 2 === 0) coeff -= Math.sign(coeff);
                card.style.top = (-50 - j*this.offsetCards).toString() + "px";
                card.style.left = (coeff*(card.clientWidth) + j*this.offsetCards).toString() + "px";
            }

        }
        await sleep(this.dealingSpeed);

        this.animationPlaying = false;
    }

    static switchHand(hand: number) {
        let handsHTML = hands.PLAYER.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < handsHTML.length; i++) {
            if (parseInt(handsHTML[i].dataset.hand) === hand) {
                handsHTML[i].classList.add("currentHand");
            }
            else {
                handsHTML[i].classList.remove("currentHand");
            }
        }
    }

    static async showStateMessage(message: string, hand: number) {
        let handsHTML = hands.PLAYER.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < handsHTML.length; i++) {
            if (parseInt(handsHTML[i].dataset.hand) === hand) {
                handsHTML[i].classList.add("currentHand");

                if (handsHTML[i].querySelector(".stateMessage") === null) {
                    let stateMessage = document.createElement("div");
                    stateMessage.classList.add("stateMessage");
                    stateMessage.textContent = message;

                    let firstCard = handsHTML[i].firstChild as HTMLElement;
                    stateMessage.style.width = (firstCard.clientWidth).toString() + "px";
                    stateMessage.style.left = parseInt(firstCard.style.left).toString() + "px";

                    handsHTML[i].append(stateMessage);
                    await sleep(100);
                    stateMessage.style.transform = "scale(1)";
                }
                else {
                    handsHTML[i].querySelector(".stateMessage").textContent = message;
                }

            }
        }
    }

    static endPlayerTurn() {
        let handsHTML = hands.PLAYER.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < handsHTML.length; i++) {
            handsHTML[i].classList.add("currentHand");
        }
    }

}
