var app = require('express')();
var http = require('http').createServer(app);
var io = require("socket.io")(http);
const GameService = require("./game-service.js");

app.get('/', function (req, res){
    res.sendFile(__dirname + '/index.html');
});

var rooms = [];
var gameService = null;

function getNewNeighbor(name, socketId) {
    return {
        name: name,
        ready: false,
        strikeCount: 0,
        socketId: socketId
    };
}

function getNeighbor(gameCode, name) {
    let room = getRoom(gameCode.toUpperCase());
    if (room.neighbors) {
        return room.neighbors.filter(n => n.name === name)[0];
    }
}

function getRoom(gameCode) {
    return rooms.filter(r => r.name === gameCode.toUpperCase())[0];
}

io.on('connection', (socket) => {
    console.log(`a user connected: ${socket.id}`);
    console.log(`open rooms: ${rooms.length}`);

    socket.on('disconnect', () => {
        console.log(`${socket.id} was disconnected`);
        console.log(`in game ${socket.gameCode}`);
        if (socket.gameCode){
            var room = getRoom(socket.gameCode);
            if (room.neighbors) {
                room.neighbors = room.neighbors.filter(n => n.name !== socket.username);
                logList(room.neighbors);
                io.in(socket.gameCode).emit('user-update', room.neighbors);

                //check to see if everyone left and destroy the game?
            }
        }
    });

    socket.on('create', (gameCode, neighborhoodName) => {
        rooms.push({ name: gameCode, neighbors: [getNewNeighbor(neighborhoodName, socket.id)] });
        socket.join(gameCode);
        socket.username = neighborhoodName;
        socket.gameCode = gameCode;
        
        gameService = new GameService();

        gameService.start();

        io.in(gameCode).emit('user-update', getRoom(gameCode).neighbors);
        io.in(gameCode).emit('game-state', gameService.table );
        io.to(socket.id).emit('game-confirmation', { neighborhoodName, gameCode });

        console.log(`${socket.username} created ${socket.gameCode}`);
    });

    socket.on('join', (gameCode, neighborhoodName) => {
        var  room = getRoom(gameCode);

        if (!room || !room.neighbors) {
            io.emit('error', `Game not found with code ${gameCode}`)
            return;
        }
        
        gameCode = gameCode.toUpperCase();
        socket.join(gameCode);
        socket.username = neighborhoodName;
        socket.gameCode = gameCode;

        room.neighbors.push(getNewNeighbor(neighborhoodName, socket.id));

        io.in(gameCode.toUpperCase()).emit('user-update', room.neighbors);
        io.in(gameCode.toUpperCase()).emit('game-state', gameService.table  );
        io.to(socket.id).emit('game-confirmation', { neighborhoodName, gameCode });
        
        console.log(`${neighborhoodName} is joining ${gameCode.toUpperCase()}`);
    });

    socket.on('ready', (gameCode, neighborhoodName) => {

        getNeighbor(gameCode, neighborhoodName).ready = true;

        let room = getRoom(gameCode);

        if (room.neighbors.every(n => n.ready))
        {
            gameService.deal();
            io.in(gameCode.toUpperCase()).emit('game-state', gameService.table );
            // set all neighbors ready to false;
            room.neighbors.forEach(n => n.ready = false);
        }

        let neighbor = getNeighbor(gameCode, neighborhoodName);
        
        io.in(gameCode.toUpperCase()).emit('user-update', room.neighbors);
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
        
        io.in(gameCode.toUpperCase()).emit('user-update', room.neighbors);
    });

    socket.on('goal-accomplished', (index) => {
        gameService.progressGoal(index);
    });

});

function logList(array) {
    array.forEach(item => console.log(item));
}

http.listen(process.env.PORT || 5000);