var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();
const PORT = process.env.PORT || 3000;
var server = app.listen(PORT, function() {
    console.log('Node app is running on port', PORT);
});

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", function (request, response) {
    response.sendFile("index.html");
});

// app.use('/', indexRouter);
// app.use('/users', usersRouter);

// // catch 404 and forward to error handler
// app.use(function(req, res, next) {
//   next(createError(404));
// });

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render("error");
});

module.exports = app;

var io = require('socket.io')(server);
var http = require('http'); //importing http
var timeOutKeepAlive = 0;
var clients = [];
var color = {color: "#000000"};
var roundNumber = 3;
var timeRound = 120;
var startTimeMatch = new Date().getTime() / 1000;
var currentRound = 0;
var currentIndexUser = 0;
var currentQuestion = "";
var allUserAnswered = false;
var resultLastMatch = {};
var isFinishGame = false;
var inMatch = false;
var questions = [];

// socket.broadcast là gửi sự kiện đến cho tất cả socket khác trừ đối tượng socket
// io.emit là gửi sự kiện đến tất cả socket đã kết nối
// socket.emit

io.sockets.on("connection", function (socket) {
    console.log(socket.id);

    socket.on("init", function (data) {
        console.log("New Client:", data.name, socket.id);
        var host = false;
        if (clients.length == 0) {
            host = true;
            io.emit("changeHost", {id: socket.id});
        } else host = false;
        clients.push({ id: socket.id, socket: socket, name: data.name, point: data.point, host: host });
        console.log("Number of Clients:", clients.length);
        updateUsers();
        appendNotification("Người chơi mới: " + data.name);
        if (clients.length == 1) {
            download("https://gitlab.com/tungxuan1656/drawdoodle/-/raw/master/dataset?inline=false", "dataset.txt", function () {
                appendNotification("download finish!");
                loadData(
                    function () {
                        appendNotification("Load data success");
                    },
                    function () {
                        appendNotification("Load data error");
                    }
                );
            });
            startKeepAlive();
        }
    });

    socket.on("startGame", function (data) {
        if (clients.length < 2) {
            socket.emit("alert", { message: "Chưa Đủ Người Chơi. Cần Tối Thiểu 3 Người Chơi!" });
        } else {
            isFinishGame = false;
            clients.forEach((client) => {
                client.point = 0;
            });
            socket.emit("hideHostControl");
            console.log("start game", data);
            roundNumber = data.round;
            timeRound = data.timeRound;
            currentRound = 0;
            startRound();
            updateUsers();
        }
    });

    socket.on("comment", function (data) {
        var text = data.text;
        // filter answer
        if (inMatch && text.toLowerCase() === currentQuestion) {
            appendChatCorrectAnswer(data.name);
            if (data.name != clients[currentIndexUser].name) {
                var interval = new Date().getTime() - startTimeMatch;
                resultLastMatch[data.name] = parseInt((timeRound - interval / 1000) * 5);
                allUserAnswered = true;
                var keys = Object.keys(resultLastMatch);
                keys.forEach((key) => {
                    if (resultLastMatch[key] == 0) {
                        allUserAnswered = false;
                    }
                });
            }
        } else {
            appendChat(data.name, text);
        }
    });

    socket.on("drawClick", function (data) {
        socket.broadcast.emit("draw", {
            x: data.x,
            y: data.y,
            type: data.type,
        });
    });

    socket.on("clear_all", function (data) {
        socket.broadcast.emit("clear_all", {});
    });

    socket.on("changeColor", function (data) {
        if (data.color.toLowerCase() != "#ffffff") { color = data; }
        socket.broadcast.emit("changeColor", data);
    });

    socket.on("active-pen", function() {
        console.log("active pen", color);
        io.emit("changeColor", color);
        io.emit("changeLineWidth", {lineWidth: 2});
    });

    socket.on("active-eraser", function() {
        io.emit("changeColor", {color: "#ffffff"});
        io.emit("changeLineWidth", {lineWidth: 30});
    });

    socket.on("changeLineWidth", function (data) {
        socket.broadcast.emit("changeLineWidth", data);
    });

    socket.on("disconnect", function (data) {
        var name = "";
        console.log(socket.id);
        for (var i = clients.length - 1; i >= 0; i--) {
            if (clients[i].id === socket.id) {
                name = clients[i].name;
                clients.splice(i, 1);
                if (i == 0 && clients.length != 0) {
                    // clients[0].socket.emit("changeHost", {});
                    io.emit("changeHost", {id: clients[0].socket.id});
                    clients[0].host = true;
                }
            }
        }
        console.log("Number of Clients:", clients.length);
        if (clients.length <= 0) {
            isFinishGame = true;
            clearTimeout(timeOutKeepAlive);
        }
        updateUsers();
        appendNotification("Người chơi đã thoát: " + name);
        delete resultLastMatch[name];
    });

    function updateUsers() {
        var list_user = clients.map(function (x) {
            return { name: x.name, point: x.point };
        });
        list_user.sort((a, b) => {
            return a.point < b.point;
        });
        io.emit("updateUsers", list_user);
    }

    function appendChatCorrectAnswer(name) {
        io.emit("appendChatCorrectAnswer", { name: name });
    }

    function appendChat(name, message) {
        io.emit("appendChat", { name: name, message: message });
    }

    function appendNotification(message) {
        io.emit("appendNotification", { message: message });
    }

    function appendNotificationPoint(message) {
        io.emit("appendNotificationPoint", { message: message });
    }

    function startRound() {
        if (currentRound > roundNumber) {
            appendNotification("Đã Kết Thúc Game!");
            reGrantDrawPermission(true);
            if (clients.length > 0) {
                // clients[0].socket.emit("changeHost", {});
                io.emit("changeHost", {id: clients[0].socket.id});
            }
            console.log("Finish Game");
        } else {
            var round = currentRound + 1;
            appendNotification("Vòng " + round);
            currentIndexUser = 0;
            startMatch();
        }
    }

    function controlMatch() {
        if (isFinishGame === true) {
            reGrantDrawPermission(true);
            if (clients.length > 0) {
                // clients[0].socket.emit("changeHost", {});
                io.emit("changeHost", {id: clients[0].socket.id});
            }
            appendNotification("Đã Kết Thúc Game!");
            console.log("Finish Game");
            return;
        }
        var isFinishMatch = checkMatch();
        if (isFinishMatch === true) {
            // append notification update point
            var drawPoint = 0;
            var keys = Object.keys(resultLastMatch);
            keys.forEach((key) => {
                drawPoint += resultLastMatch[key];
            });
            if (drawPoint == null || drawPoint == undefined) drawPoint = -1;
            drawPoint = parseInt((drawPoint * 2) / keys.length);
            if (clients.length > currentIndexUser) {
                resultLastMatch[clients[currentIndexUser].name] = drawPoint;
            }
            for (var i = 0; i < clients.length; i++) {
                var point = resultLastMatch[clients[i].name];
                if (point == null || point == undefined) point = 0;
                clients[i].point += point;
                appendNotificationPoint(clients[i].name + ": " + point + " điểm");
            }
            updateUsers();
            // finish match
            io.emit("appendNotification", { message: "Từ Khoá là: " + currentQuestion });
            //
            currentIndexUser += 1;
            if (currentIndexUser >= clients.length) {
                currentRound += 1;
                startRound();
            } else {
                startMatch();
            }
        } else {
            setTimeout(controlMatch, 1000);
        }
    }

    function startMatch() {
        inMatch = false;
        currentQuestion = randomQuestion();
        appendNotification("chuẩn bị...");
        setTimeout(function () {
            inMatch = true;
            startTimeMatch = new Date().getTime();
            reGrantDrawPermission(false);
            sendQuestion();
            console.log("start Match");
            io.emit("startMatch", { timeRound: timeRound, startTime: startTimeMatch});
            appendNotification(clients[currentIndexUser].name + " đang vẽ!");
            resultLastMatch = {};
            clients.forEach((client) => {
                resultLastMatch[client.name] = 0;
            });
            resultLastMatch[clients[currentIndexUser].name] = 1;
            setTimeout(controlMatch, 1000);
        }, 3000);
    }

    function checkMatch() {
        var now = new Date().getTime();
        var timeout = false;
        if (now > startTimeMatch + timeRound * 1000) {
            timeout = true;
        }
        return allUserAnswered || timeout;
    }

    function randomQuestion() {
        var length = questions.length;
        var index = Math.floor(Math.random() * length);
        var random = questions[index];
        console.log("Random Question: ", random);
        return random;
    }

    function sendQuestion() {
        allUserAnswered = false;
        for (var i = 0; i < clients.length; i++) {
            if (i == currentIndexUser) {
                sendAnswerQuestion(clients[i].socket, currentQuestion);
            } else {
                sendQuestionHideAnswer(clients[i].socket, currentQuestion);
            }
        }
    }

    function reGrantDrawPermission(all) {
        if (all === true) {
            io.emit("grantDrawPermission", { id: "", all: all });
        } else {
            if (clients.length > currentIndexUser) {
                io.emit("grantDrawPermission", { id: clients[currentIndexUser].id, all: all });
            }
        }
    }

    function sendAnswerQuestion(socket, answer) {
        socket.emit("answerQuestion", { answer: answer });
    }

    function sendQuestionHideAnswer(socket, answer) {
        var text = "";
        for (var i = 0; i < answer.length; i++) {
            if (answer[i] == " ") text += " ";
            else if (answer[i] == "-") text += "-";
            else text += "=";
        }
        socket.emit("answerHide", { answer: text });
    }

    socket.on("execute", function (data) {
        if (data.command == "!endgame") {
            console.log("Execute command End game!");
            isFinishGame = true;
        }
        if (data.command == "!downloaddataset") {
            console.log("Download Dataset");
            download("https://gitlab.com/tungxuan1656/drawdoodle/-/raw/master/dataset?inline=false", "dataset.txt", function () {
                appendNotification("download finish!");
            });
        }
        if (data.command == "!loaddata") {
            console.log("Download data");
            loadData(
                function () {
                    appendNotification("Load data success");
                },
                function () {
                    appendNotification("Load data error");
                }
            );
        }
        if (data.command == "!gethostcontrol") {
            console.log("Grant Host Control");
            io.emit("changeHost", {id: socket.id});
        }
    });

    socket.on("hold-connection", function () {
        // console.log(socket.id, "hold connection");
    });

    function loadData(completion, error) {
        var fs = require("fs"),
            path = require("path"),
            filePath = path.join(__dirname, "dataset.txt");

        fs.readFile(filePath, { encoding: "utf-8" }, function (err, data) {
            if (!err) {
                questions = data.trim().split("\n");
                console.log("load data: " + questions);
                completion();
            } else {
                console.log(err);
                error();
            }
        });
    }

    function download(dataurl, filename, completion) {
        const https = require("https");
        const fs = require("fs");

        const file = fs.createWriteStream(filename);
        const request = https.get(dataurl, function (response) {
            response.pipe(file);
            completion();
        });
    }

    function startKeepAlive() {
        const https = require("https");
        timeOutKeepAlive = setTimeout(function() {
            https.get("https://draw-doodle-tx.herokuapp.com", function(res) {
                res.on('data', function(chunk) {
                    try {
                        // optional logging... disable after it's working
                        console.log("HEROKU RESPONSE, KEEP ALIVE SUCCESS");
                    } catch (err) {
                        console.log(err.message);
                    }
                });
            }).on('error', function(err) {
                console.log("Error: " + err.message);
            });
            startKeepAlive();
        }, 1200000);
    }
});
