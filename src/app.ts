import "./assets/style.css";
import Game, { Mode } from "./components/Game";
import {
    PAIR_ROWS, SOFT_ROWS, HARD_ROWS, DEALER_COLS,
    PAIR_CHART, SOFT_CHART, HARD_CHART,
} from "./components/Strategy";

window.addEventListener("load", () => {
    document.body.classList.remove("preload");

    buildStrategyChart();

    const game = new Game();
    void game.start(1000, 6);

    const byId = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
        document.getElementById(id) as T | null;

    byId("standButton")?.addEventListener("click", () => void game.stand());
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

    document.querySelectorAll<HTMLButtonElement>(".modeButton").forEach((btn) => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode as Mode | undefined;
            if (!mode) return;
            game.setMode(mode);
        });
    });

    byId("toggleChartButton")?.addEventListener("click", () => game.toggleTrainingChart());
    byId("closeChartButton")?.addEventListener("click", () => {
        // Close X is only visible in Training; hides the chart in that mode.
        if (game.getMode() === Mode.TRAINING) game.toggleTrainingChart();
    });

    const resetBtn = byId<HTMLButtonElement>("resetStatsButton");
    const confirmEl = byId("resetConfirm");
    const showResetConfirm = (show: boolean): void => {
        resetBtn?.classList.toggle("hidden", show);
        confirmEl?.classList.toggle("hidden", !show);
    };
    resetBtn?.addEventListener("click", () => showResetConfirm(true));
    byId("resetNoButton")?.addEventListener("click", () => showResetConfirm(false));
    byId("resetYesButton")?.addEventListener("click", () => {
        game.resetTrainingStats();
        showResetConfirm(false);
    });

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

function buildStrategyChart(): void {
    const body = document.getElementById("chartBody");
    if (!body) return;

    const sections: Array<{
        title: string;
        rows: ReadonlyArray<string | number>;
        category: "pair" | "soft" | "hard";
        labelFor: (k: string | number) => string;
        chart: Record<string | number, Record<string, string>>;
    }> = [
        {
            title: "Pairs",
            rows: PAIR_ROWS,
            category: "pair",
            labelFor: (k) => String(k),
            chart: PAIR_CHART as unknown as Record<string | number, Record<string, string>>,
        },
        {
            title: "Soft totals",
            rows: SOFT_ROWS,
            category: "soft",
            labelFor: (k) => `A,${(k as number) - 11}`,
            chart: SOFT_CHART as unknown as Record<string | number, Record<string, string>>,
        },
        {
            title: "Hard totals",
            rows: HARD_ROWS,
            category: "hard",
            labelFor: (k) => (k as number) === 17 ? "17+" : String(k),
            chart: HARD_CHART as unknown as Record<string | number, Record<string, string>>,
        },
    ];

    for (const section of sections) {
        const header = document.createElement("tr");
        header.className = "section-row";
        const cell = document.createElement("th");
        cell.colSpan = DEALER_COLS.length + 1;
        cell.textContent = section.title;
        header.appendChild(cell);
        body.appendChild(header);

        for (const r of section.rows) {
            const tr = document.createElement("tr");
            const th = document.createElement("th");
            th.scope = "row";
            th.textContent = section.labelFor(r);
            th.dataset.rowHeader = `${section.category}:${r}`;
            tr.appendChild(th);
            for (const col of DEALER_COLS) {
                const td = document.createElement("td");
                const v = section.chart[r as string | number]?.[col] ?? "";
                td.textContent = v;
                td.className = `cell cell-${v}`;
                td.dataset.row = `${section.category}:${r}`;
                td.dataset.col = col;
                tr.appendChild(td);
            }
            body.appendChild(tr);
        }
    }
}
