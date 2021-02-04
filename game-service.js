const fs = require('fs');
const goalDeck = require('./goal-deck.json');

class GameService {
    deck = [];
    baseDeck = [];

    table = {
        left: [],
        right: [],
        goals: []
    }

    goalsAccomplishedThisRound = [];

    constructor() {
        this.baseDeck = JSON.parse(fs.readFileSync('./base-deck.json'));
        this.deck = [];
        this.table.left = [];
        this.table.right = [];
        this.table.goals = [];
        this.goalsAccomplishedThisRound = [false, false, false];
    }

    start() {
        this.shuffle();
        this.dealGoals();
        this.deal();
        this.deal();
    }

    dealGoals() {
        this.table.goals =  [this.drawGoalCard(0), this.drawGoalCard(1), this.drawGoalCard(2)]
    }

    drawGoalCard(i) {
        const cardNumber = Math.floor(Math.random() * 5);
        const g = goalDeck.groups[i][cardNumber];
        g.index = cardNumber + 1;
        g.progress = 'f';
        return g;
    }

    deal() {
        if (this.deck.length <= 3) {
            this.shuffle();
        }

        this.goalsAccomplishedThisRound.forEach((goalAccomplished, index) => {
            if (goalAccomplished) { this.flipGoal(index); }
        });

        this.goalsAccomplishedThisRound = [false, false, false];

        this.table.right = this.table.left;

        this.table.left = [this.drawCard(), this.drawCard(), this.drawCard()];
    }


    drawCard() {
        const randIndex = Math.floor(Math.random() * this.deck.length);
        const rand = this.deck[randIndex];
        this.deck.splice(randIndex, 1);
        return rand;
    }

    shuffle() {
        this.deck  = Object.assign([], this.baseDeck.cards);
    }

    progressGoal(index) {
        this.goalsAccomplishedThisRound[index] = true;
    }

    flipGoal(index) {
        const currentState = this.table.goals[index].progress;
        if (currentState === 'f'){ this.table.goals[index].progress = 'b'; }
        else if (currentState === 'b'){ this.table.goals[index].progress = 'x'; }
        console.log(`flipping ${index} to ${this.table.goals[index].progress}`);
    }
}

module.exports = GameService;