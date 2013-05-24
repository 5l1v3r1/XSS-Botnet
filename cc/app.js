

/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path');

require("./lib/Barrett");
require("./lib/BigInt");
require("./lib/RSA");

var app = express();

// all environments
app.set('port', process.env.PORT || 3977);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

setMaxDigits(19);
var serverKey = new RSAKeyPair(
 "bf79e379f1535ddf1de7571f65b04b5",
 "bf79e379f1535ddf1de7571f65b04b5",
 "907e4e9bdca8832febfa32d958dee42d"
);

// Storage
var queue = [];
var results = {};
var pullKey = null;

// Funcs
function getKey() {
    return [0,0,0,0].map(function(){ return Math.random().toString(16).substring(2) }).join('');
}

app.get('/', function(req, res){
    res.send('Yo dawg.');
});

app.get('/queue', function(req, res){

    console.log(req.query);

    if (queue.length) {
        var count = 0;

        while (count < queue.length) {
            var item = queue.pop();
            count++;

            var fail = false;
            for (var condition in item.conditions) {
                
                console.log('testing condition:', req.query[condition], 'vs', item.conditions[condition]);
                console.log(typeof item.conditions[condition] == 'string' && req.query[condition] != item.conditions[condition]);
                console.log(typeof item.conditions[condition] == 'number' && req.query[condition] > item.conditions[condition]);

                var isNum = item.conditions[condition].match(/^\d+$/);

                if ( (isNum && req.query[condition] > item.conditions[condition])
                  || (!isNum && req.query[condition] != item.conditions[condition]) ) {

                    queue.unshift(item);
                    fail = true;
                    break;
                }
            }

            if (fail) {
                continue;
            }

            // Success!
            if (--item.repeat > 0) {
                queue.unshift(item);
            } else {
                results[item.key].expired = true;
            }
            console.log('Sending item:', item);
            return res.send(item.payload);
        }
        console.log('No valid items in queue');
        return res.send(204);

    } else {
        console.log('No items in queue');
        return res.send(204);
    }
});

app.post('/queue', function(req, res){

    try {
        var key = getKey();
        var task = decryptedString(serverKey, req.body.data);
        var item = {
            key: key,
            payload: '___.fire({return:"http://' + req.headers.host + '/push",key:"' + key + '",task:' + task + '});',
            conditions: req.body.conditions || {},
            repeat: req.body.repeat || 1
        };

        console.log('adding:', key, ':', task, req.body.repeat, 'times');
        queue.unshift(item);

        results[key] = [];

        res.send(204);

    } catch (e) {
        res.status(400); // Give no clues as to what goes on here
    }
});

app.get('/push', function(req, res){

    console.log(results);
    console.log(req.query.key);

    if (results[req.query.key] !== undefined) {
        results[req.query.key].push(req.query.result);
        res.send(204);

    } else {
        res.send(403);
    }
});

app.get('/pullkey', function(req, res){
    pullKey = getKey();
    res.send({ key: encryptedString(serverKey, pullKey) });
});

app.get('/pull', function(req, res){

    console.log(pullKey);

    if (pullKey != null && req.query.key == pullKey) {

        pullKey = null;
        res.send( encryptedString(serverKey, JSON.stringify(results)) );

        for (var key in results) {
            if (results[key].expired) {
                delete results[key];
            }
        }

    } else {
        res.send(403);
    }
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
