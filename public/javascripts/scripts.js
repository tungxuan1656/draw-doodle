(function () {
    var App = {};

    App.init = function () {
        App.userName = Math.random().toString(36).substring(2);
        (function() {
            var person = prompt("Nhập tên người chơi:");
            if (person != null && person != "") {
                App.userName = person;
            }
        })();
        App.point = 0;
        App.buttonStart = $("#button-start");
        App.slider = $("#myRange");
        App.canvas = document.getElementById("canvas");
        App.canvas.height = 500;
        App.canvas.width = 700;
        App.ctx = App.canvas.getContext("2d");
        App.ctx.fillStyle = "solid";
        App.ctx.strokeStyle = "#000000";
        App.ctx.lineWidth = 2;
        App.ctx.lineCap = "round";
        App.socket = io();
        App.isDraw = true;
        App.timeOutInterval = undefined;
        App.color = "#000000";

        App.socket.on('connect', function() {
            App.socket.emit("init", {name: App.userName, point: App.point});
        });

        App.users = [];

        // App.socket.emit("init", {name: App.userName});
        
        App.socket.on("alert", function(data) {
            alert(data.message);
        });

        App.socket.on("appendChat", function(data) {
            App.appendToCmts(App.getElementComment(data.name, data.message));
        });

        App.socket.on("appendChatCorrectAnswer", function(data) {
            App.appendToCmts(App.getElementAnswerCorrect(data.name));
        });

        App.socket.on("appendNotification", function(data) {
            App.appendToCmts(App.getElementNotification(data.message));
        });

        App.socket.on("appendNotificationPoint", function(data) {
            App.appendToCmts(App.getElementNotificationPoint(data.message));
        });

        App.socket.on("draw", function(data) {
            return App.draw(data.x, data.y, data.type);
        });

        App.socket.on("clear_all", function(data) {
            return App.clear_all();
        });

        App.socket.on("hideHostControl", function(data){
            $("#host-control").hide();
        });

        App.socket.on("changeColor", function(data) {
            // console.log(data.color);
            App.pickr.setColor(data.color);
            App.ctx.strokeStyle = data.color;
        });

        App.socket.on("updateUsers", function(data) {
            var usersContainer = $("#users-container");
            usersContainer.empty();
            data.forEach(user => {
                usersContainer.append(App.getElementUser(user.name, user.point));
            });
        });

        App.socket.on("changeLineWidth", function(data) {
            // console.log(data.lineWidth);
            App.ctx.lineWidth = data.lineWidth;
            App.slider.val(data.lineWidth);
        });

        App.socket.on("changeHost", function(data) {
            if (data.id == App.socket.id) {
                $("#host-control").show();
            }
            else {
                $("#host-control").hide();
            }
        });

        App.socket.on("grantDrawPermission", function(data) {
            if (data.all === true) {
                App.isDraw = true;
                $("#view-control").show();
                return;
            }
            if (data.id === App.socket.id) {
                $("#view-control").show();
                App.isDraw = true;
            }
            else {
                $("#view-control").hide();
                App.isDraw = false;
            }
        });

        App.socket.on("answerQuestion", function(data) {
            // console.log(data);
            $("#answer").empty();
            $("#answer").append(data.answer);
        });

        App.socket.on("answerHide", function(data) {
            // console.log(data);
            $("#answer").empty();
            $("#answer").append(data.answer);
        });

        App.socket.on("startMatch", function(data) {
            // refresh label time-out
            // console.log(data.timeRound);
            // console.log(data.startTime);
            var timeRound = parseInt(data.timeRound);
            var startTime = parseInt(data.startTime);
            if (timeRound == null || timeRound == undefined) return;
            if (timeRound == null || timeRound == undefined) return;
            clearTimeout(App.timeOutInterval);
            setLabelTimeout(timeRound, startTime);
        });

        function setLabelTimeout(timeRound, startTime) {
            $("#time-out").empty();
            var time = parseInt(timeRound - (new Date().getTime() - startTime) / 1000);
            $("#time-out").append(time);
            if (time < 0) return;
            App.timeOutInterval = setTimeout(function() {
                setLabelTimeout(timeRound, startTime);
            }, 1000);
        }

        App.buttonStart.on("click", function() {
            var round = parseInt($("#round-number").val());
            if (round == null || round == undefined) round = 1;
            var timeRound = parseInt($("#time-round").val());
            if (timeRound == null || timeRound == undefined) timeRound = 120;
            App.socket.emit("startGame", {round: round, timeRound: timeRound});
        });

        App.draw = function (x, y, type) {
            if (type === "dragstart") {
                App.ctx.beginPath();
                return App.ctx.moveTo(x, y);
            } else if (type === "drag") {
                App.ctx.lineTo(x, y);
                return App.ctx.stroke();
            } else {
                return App.ctx.closePath();
            }
        };
        App.clear_all = function () {
            App.ctx.clearRect(0, 0, App.canvas.width, App.canvas.height);
        };

        App.pickr = Pickr.create({
            el: ".color-picker",
            theme: "classic", // or 'monolith', or 'nano'

            default: "#000000",

            components: {
                // Main components
                preview: true,
                opacity: false,
                hue: true,

                // Input / output Options
                interaction: {
                    hex: false,
                    rgba: false,
                    hsla: false,
                    hsva: false,
                    cmyk: false,
                    input: false,
                    clear: false,
                    save: false,
                },
            },
        });

        App.slider.on("input change", function() {
            if (App.isDraw == true) {
                App.ctx.lineWidth = App.slider.val();
                App.socket.emit("changeLineWidth", {lineWidth: App.slider.val()});
            }
        });

        App.pickr.on('init', instance => {
            // console.log('init', instance);
        }).on('hide', instance => {
            if (App.isDraw == true) {
                App.ctx.strokeStyle = App.color;
                App.socket.emit("changeColor", {color: App.color});
            }
        }).on('show', (color, instance) => {
            // console.log('show', color, instance);
        }).on('save', (color, instance) => {
            // console.log('save', color, instance);
            if (App.isDraw == true) {
                App.ctx.strokeStyle = color.toHEXA();
                App.socket.emit("changeColor", {color: color.toHEXA().toString()});
            }
        }).on('clear', instance => {
            // console.log('clear', instance);
        }).on('change', (color, instance) => {
            var sColor = color.toHEXA().toString();
            App.color = sColor;
            App.pickr.setColor(sColor);
        }).on('changestop', instance => {
            // console.log('changestop', instance);
        }).on('cancel', instance => {
            // console.log('cancel', instance);
        }).on('swatchselect', (color, instance) => {
            // console.log('swatchselect', color, instance);
        });

        App.socket.on("active-pen", function() {
            var pen = $("#button-pen");
            var eraser = $("#button-eraser");

            pen.removeClass("button-inactive");
            eraser.addClass("button-inactive");

            App.pickr.setColor("#000000");
            App.ctx.strokeStyle = "#000000";
            App.ctx.lineWidth = 2;
        });

        App.socket.on("active-eraser", function() {
            var pen = $("#button-pen");
            var eraser = $("#button-eraser");
    
            eraser.removeClass("button-inactive");
            pen.addClass("button-inactive");

            App.pickr.setColor("#ffffff");
            App.ctx.strokeStyle = "#ffffff";
            App.ctx.lineWidth = 30;
        });

        App.appendToCmts = function(element) {
            var cmtsArea = $("#cmts");
            cmtsArea.append(element);
            cmtsArea.animate({scrollTop: cmtsArea.prop("scrollHeight")});
        };

        App.getElementUser = function(name, point) {
            return "<div class=\"user\"><span class=\"user-name\">" + name +"</span><br><span class=\"user-point\">Điểm: " + point + "</span></div>";
        };

        App.getElementComment = function(name, message) {
            return "<p class=\"cmt\"><span class=\"user-name\">" + name + ": " + "</span><span class=\"user-comment\">" + message + "</span></p>";
        };

        App.getElementAnswerCorrect = function(name) {
            return "<p class=\"cmt\"><span class=\"user-answer-correct\">" + name + " đã trả lời đúng!" + "</span></p>";
        };

        App.getElementNotification = function(message) {
            return "<p class=\"cmt notification\">" + message + "</p>";
        };

        App.getElementNotificationPoint = function(message) {
            return "<p class=\"cmt notification-point\">" + message + "</p>";
        };

        window.setInterval(function() {
            App.socket.emit("hold-connection");
        }, 10000);
    };
    /*
  	Draw Events
    */
    function sendDraw(x, y, type) {
        if (App.isDraw === false) {
            return;
        } 
        App.socket.emit("drawClick", {
            x: x,
            y: y,
            type: type
        });
        App.draw(x,y,type);
    }

    function handle_mousedown(e){
        x = e.pageX;
        y = e.pageY;
        type = "dragstart";
        sendDraw(x,y,type);
        function handle_dragging(e){
            x = e.pageX;
            y = e.pageY;
            type = "drag";
            sendDraw(x,y,type);
        }
        function handle_mouseup(e){
            $('#canvas')
            .off('mousemove', handle_dragging)
            .off('mouseup', handle_mouseup);
            x = e.pageX;
            y = e.pageY;
            type = "dragend";
            sendDraw(x,y,type);
            // console.log("send dragend");
        }
        $('#canvas')
        .on('mouseup', handle_mouseup)
        .on('mousemove', handle_dragging);
    }

    $("#canvas").mousedown(handle_mousedown);

    $("#button-clear-all").on("click", function() {
        if (App.isDraw == true) {
            // console.log("clear");
            App.socket.emit("clear_all", {});
            App.clear_all();
        }
    });

    $("#form-comment").submit(function(e) {
        var text = $("#input").val();
        if (text == "" && text == null) return;

        $("#input").val("");
        App.socket.emit("comment", {name: App.userName, text: text});
        return false;
    });

    $("#button-execute").on("click", function() {
        var command = $("#input-command").val();
        console.log("execute " + command);
        App.socket.emit("execute", {"command": command});
    });

    $("#button-pen").on("click", function() {
        
        App.socket.emit("active-pen");
    });

    $("#button-eraser").on("click", function() {
        App.socket.emit("active-eraser");
    });

    $(function () {
        // console.log("init");
        return App.init();
    });

})(window);
