let app = require('express')();
let PORT = process.env.PORT || 3000;
let socketio = require('socket.io');
let crypto = require('crypto');
let fs = require('fs');
let bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
let user = [];
let users = {};

const encryptionKey = 'aes-256-cbc';
const iv = crypto.randomBytes(16);

function encrypt(text) {
  let cipher = crypto.createCipher('aes-256-cbc', Buffer.from(encryptionKey));
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('hex');
}
let server = app.listen(PORT);
let io = socketio(server);

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/public/home.html');
});
app.get('/create', function(req, res) {
  res.sendFile(__dirname + '/public/create.html');
})
app.post('/create-room', (req, res) => {
  fs.mkdirSync(__dirname + '/rooms/' + req.body.room, function(err) {
    console.log(err);
  });
  let manifest = `
  {
    "name": "${req.body.room}",
    "pin": "${encrypt(req.body.pin)}"
  }
  `
  fs.writeFileSync(__dirname + '/rooms/' + req.body.room + '/manifest.json', manifest);
  let chatroomoutline = `
  
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Room</title>
</head>
<body>
<style>
body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}
.chat-box {
  float: right;
  width: 350px;
  height: 500px;
  margin: 0px 0px 25px 25px;
  padding: 10px;
  background-color: #f8f8f8;
  border-radius: 5px;
  box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2);
}

.chat-box-header {
  padding: 10px 0px;
  border-bottom: 1px solid #ccc;
  font-weight: bold;
}

.chat-box-body {
  height: 400px;
  overflow-y: scroll;
  padding: 10px;
  list-style-type: none;
}

.chat-box-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2);
}

.chat-box-send {
  width: 100%;
  padding: 10px;
  background-color: #2196f3;
  color: #fff;
  text-align: center;
  border-radius: 5px;
  box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2);
}
</style>
<div class="chat-box">
  <div class="chat-box-header">${req.body.room} Chat Room</div>
  <ul class="chat-box-body"><div id="msgs"></div><textarea class="chat-box-input" placeholder="Enter message" id="inp"></textarea><button class="chat-box-send" id="send">Send!</button></ul>
</div>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
  <script>
    var socket = io();

  var messages = document.getElementById('msgs');
  var send = document.getElementById('send');
  var input = document.getElementById('inp');

  send.addEventListener('click', function() {
    if (input.value) {
      socket.emit('message', input.value);
      input.value = '';
    }
  });

  socket.on('message', function(msg) {
    var item = document.createElement('li');
    item.innerText = msg.user + ': ' + msg.data;
    messages.appendChild(item);
  });
  </script>
</body>
</html>
  `
  fs.writeFileSync(__dirname + '/rooms/' + req.body.room + '/chat.html', chatroomoutline);
  res.send("Chat created.")
})
app.post('/process', function(req, res) {
  let pin = req.body.pin;
  let room = req.body.room;
  user.push({ user: req.body.user, room: room });
  if (fs.existsSync(__dirname + '/rooms/' + room + '/manifest.json')) {
    let manifest = fs.readFileSync(__dirname + '/rooms/' + room + '/manifest.json');
    let file = JSON.parse(manifest);
    if (file.pin == encrypt(pin)) {
      res.sendFile(__dirname + '/rooms/' + room + '/chat.html');
    } else {
      res.send("Incorrect Pin.");
    }
  } else {
    res.send("Room does not exist.");
  }
})
app.get('/enter', function(req, res) {
  res.sendFile(__dirname + '/public/enter.html');
});
io.on('connection', function(socket) {
  users[socket.id] = {};
  user.forEach(function(u) {
    users[socket.id].user = u.user;
    users[socket.id].room = u.room;
  })
  for (let i in users) {
    if (users[i].room == users[socket.id].room) {
      socket.to(i).emit('message', { user: socket.id, data: users[socket.id].user + ' has connected to the server!' });
    }
  }
  socket.emit('message', { user: socket.id, data: users[socket.id].user + ' has connected to the server!' });
  console.log('User ' + socket.id + ' has connected to the server!');
  socket.on('message', function(data) {
    console.log('message:' + data);
    for (let i in users) {
      if (users[i].room == users[socket.id].room) {
        socket.to(i).emit('message', { user: users[socket.id].user, data: data });
      }
    }
    socket.emit('message', { data: data, user: users[socket.id].user });
  });
  io.on('disconnect', function() {
    console.log('disconnect');
  });
})
