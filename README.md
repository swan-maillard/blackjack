# Blackjack Game

## Description

This project is a **Blackjack** game developed using **TypeScript**, where you play against the dealer following the classic rules of Blackjack. The goal is simple: get as close to 21 as possible without going over, and beat the dealer in the process.

![Screenshot of the baord game](https://swan-maillard.github.io/static/media/project1.ed6ade7332c6a42e6fc3.png)

### Key Features:
- **Classic Blackjack Rules**: 
  - Both the player and the dealer aim to reach a hand value closest to 21 without exceeding it.
  - If a hand exceeds 21, it's a bust, and that player loses.
- **Player Actions**:
  - **Hit**: Draw another card to improve your hand.
  - **Stay**: Keep your current hand.
  - **Double Down**: Double your bet and receive one final card.
  - **Split**: If your initial two cards have the same value, split them into two separate hands.
- **Dealer's Play**:
  - The dealer must hit until they reach a total of 17 or higher.
  
For more details on Blackjack rules, check out [this Wikipedia page](https://en.wikipedia.org/wiki/Blackjack).

## Planned Future Features

1. **Virtual Money System**:
   - Players will start with a fixed amount of virtual money.
   - Place bets before each round, with winnings and losses calculated based on the game outcome.
   - Track your balance as you play multiple rounds, adding a more strategic layer to the game.

2. **Optimal Strategy Feedback**:
   - Provide real-time feedback on the player’s decisions, helping them improve their game by suggesting optimal moves based on Blackjack strategy charts.
   - Guide users to make statistically better choices (e.g., when to hit, stay, or double down).
   - Learn more about Blackjack basic strategy [here](https://www.blackjackapprenticeship.com/blackjack-strategy-charts/).

## Installation & Setup

Follow these steps to run the project locally:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/swan-maillard/blackjack.git
   ```

2. **Navigate to the project folder**:
   ```bash
   cd blackjack
   ```

3. **Install the dependencies**:
   ```bash
   npm install
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

5. **Start the game**:
   ```bash
   npm start
   ```

6. **Open the game**:  
   Once the server is running, open your browser and go to the provided localhost address to start playing the game.

## Authors

- Swan Maillard (maillard.swan@gmail.com)

## License

This project is licensed under the **MIT License**. For more details, please refer to the `LICENSE` file.
