var app = require('express')();
var http = require('http').createServer(app);
var io = require("socket.io")(http);
const GameService = require("./game-service.js");

app.get('/', function (req, res){
    res.sendFile(__dirname + '/index.html');
});

var rooms = [];
var gameService = null;

function getNewNeighbor(name) {
    return {
        name: name,
        ready: false,
        strikeCount: 0
    };
}

function getNeighbor(gameCode, name) {
    let room = getRoom(gameCode);
    if (room.neighbors) {
        return room.neighbors.filter(n => n.name === name)[0];
    }
}

function getRoom(gameCode) {
    return rooms.filter(r => r.name === gameCode)[0];
}

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('a user disconnected');
    });

    socket.on('create', (gameCode, neighborhoodName) => {
        rooms.push({ name: gameCode, neighbors: [getNewNeighbor(neighborhoodName)] });
        socket.join(gameCode);
        
        gameService = new GameService();

        gameService.start();

        io.in(gameCode).emit('user-update', getRoom(gameCode).neighbors);
        io.in(gameCode).emit('game-state', gameService.table );

        console.log(`${neighborhoodName} created ${gameCode}`);
    });

    socket.on('join', (gameCode, neighborhoodName) => {
        socket.join(gameCode);
        var  room = getRoom(gameCode);

        if (!room || !room.neighbors) {
            io.emit('error', `Game not found with code ${gameCode}`)
            return;
        }

        room.neighbors.push(getNewNeighbor(neighborhoodName));

        io.in(gameCode).emit('user-update', room.neighbors);
        io.in(gameCode).emit('game-state', gameService.table  );
        
        console.log(`${neighborhoodName} is joining ${gameCode}`);
    });

    socket.on('ready', (gameCode, neighborhoodName) => {

        getNeighbor(gameCode, neighborhoodName).ready = true;

        let room = getRoom(gameCode);

        if (room.neighbors.every(n => n.ready))
        {
            gameService.deal();
            io.in(gameCode).emit('game-state', gameService.table );
            // set all neighbors ready to false;
            room.neighbors.forEach(n => n.ready = false);
        }

        let neighbor = getNeighbor(gameCode, neighborhoodName);
        
        io.in(gameCode).emit('user-update', room.neighbors);
    });

    socket.on('strike', (gameCode, neighborhoodName) => {

        getNeighbor(gameCode, neighborhoodName).strikeCount ++;

        let room = getRoom(gameCode);

        if (room.neighbors.some(n => n.strikeCount === 3))
        {
            // game over
        }

        let neighbor = getNeighbor(gameCode, neighborhoodName);
        console.log(`${neighbor.name} got a strike ${neighbor.strikeCount}`);
        
        io.in(gameCode).emit('user-update', room.neighbors);
    });

    socket.on('goal-accomplished', (index) => {
        gameService.progressGoal(index);
    });

});

http.listen(3000);