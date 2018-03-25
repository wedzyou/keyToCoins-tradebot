/*
    Steam library
*/

var SteamUser = require('steam-user');
var SteamTotp = require('steam-totp');
var SteamCommunity = require('steamcommunity');
var TradeOfferManager = require('steam-tradeoffer-manager');

/*
    other library
*/

var fs = require('fs');
var request = require('request');
var chalk = require('chalk');
var dateTime = require('node-datetime');

/*
    config file
*/

var config = require('./config.json');
/*
global var
*/
var totalprice = 0.00;
var totalpricewithdraw = 0.00;
var totalitemswithdraw
var user;
var totalitems;
var items;
var friends;
var dt = dateTime.create();
var formatted = dt.format('Y-m-d');
var chatformatted = dt.format('m/d/Y H:M:S');

/*
    initialize bot library
*/

var client = new SteamUser();
var community = new SteamCommunity();
var manager = new TradeOfferManager({
  steam: client,
  community: community,
  language: 'en'
});

/*
    Login option
*/

var logOnOptions = {
  accountName: config.bots[0].username,
  password: config.bots[0].password,
  twoFactorCode: SteamTotp.generateAuthCode(config.bots[0].sharedSecret)
};

/*
    login to bot
*/

client.logOn(logOnOptions);
client.on('loggedOn', () => {
  console.log(chalk.blue('[STEAMBOT]') + chalk.green('Logged into Steam'));
  client.setPersona(SteamUser.Steam.EPersonaState.Online);
});

/*
    pricing function
*/

function getPriceItem(name) {
  var priceItem = 0;
  if (name) {
    var prices = require('./prices.json');
    priceItem = prices[name];
  }
  return priceItem;
}



/*
  Getting prices
*/
var priceUrl = 'https://api.csgofast.com/price/all';

function getPriceList() {
  request(priceUrl, function(dataAndEvents, r, actual) {
    ok = JSON.parse(actual);
    if (200 != r.statusCode) {
      if (fs.existsSync("./prices.json")) {
        ok = JSON.parse(fs.readFileSync("./prices.json"));
        ok = JSON.parse(fs.readFileSync("./prices.json"));
        console.log("[SERVER] Loading Prices - Server sided prices loaded!");
      }
    } else {
      fs.writeFileSync("./prices.json", actual);
      fs.writeFileSync("./prices.json", actual);
      console.log("[SERVER] Loading Prices - API prices loaded!");
    }
  });
}
//refresh prices list
getPriceList();
setInterval(getPriceList, config.priceRefreshInterval * 1000);
/*
    trade checker
*/
client.on('webSession', (sessionid, cookies) => {
  manager.setCookies(cookies);
  community.setCookies(cookies);
  community.startConfirmationChecker(10000, config.bots[0].identitySecret);
});
/*
    generate order id
*/
function makeCode() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 6; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
//empty the bot only admin
function offerItems(steamID) {
  var create = manager.createOffer(steamID);
  var itemsToSend = [];
  manager.loadInventory(config.appid, config.ContextID, true, function(err, myItems) {
    for (i = 0; i < myItems.length; i++) {
      create.addMyItem({
        "appid": AppID,
        "contextid": ContextID,
        "assetid": myItems[i].assetid
      });
    }
    create.send(function(err, status) {
      if (err) {
        console.log(err);
        return;
      } else {
        console.log('Offer #' + create.id + " " + status);
      }
    });
  });
}

/*
    load friend list
*/
client.on('friendsList', function() {
  friends = client.myFriends;

});

/*
    Handle friend request
*/


//on new friend request
client.on('friendRelationship', function(steamID, relationship) {
  if (relationship == SteamUser.Steam.EFriendRelationship) {
    //fs check
    if (fs.existsSync('users/' + steamID + '.json')) {
      client.chatMessage(steamID, 'Hi there Welcome back, if you want more info type !help');
      client.addFriend(steamID);
      client.inviteToGroup(steamID.toString(), config.groupid);
    } else {
      var userdata = {
        dateadd: formatted,
        coins: 0.00,
        "deposit": {
          "orderid": [],
          "price": [],
          "date": [],
          "items": []
        },
        "withdraw": {
          "orderid": [],
          "price": [],
          "date": [],
          "items": []
        }
      };
      var json = JSON.stringify(userdata);
      fs.writeFile('users/' + steamID + '.json', json, function(err) {
        if (err) throw err;
        console.log('Saved!');
      });
      fs.writeFile('users/' + steamID + '.txt', function(err) {
        if (err) throw err;
        console.log('Saved!');
        client.addFriend(steamID);
        client.chatMessage(steamID, config.welcomemsg);
        client.inviteToGroup(steamID.toString(), config.groupid);
      });


    }



  }
});
//on message
client.on('friendMessage', (steamID, message) => {
  fs.appendFile('message/' + steamID + '.txt', "\r\n[" + chatformatted + "]-" + message, function(err) {
    if (err) throw err;
  });
  fs.readFile('users/' + steamID + '.json', 'utf8', function readFileCallback(err, data) {
    if (err) {
      console.log(err);
    } else {
      obj = JSON.parse(data);
      if (message.includes("!annoucement") && steamID == config.adminID) {
        var splitms = message.split(";");
        if (splitms[1] != null) {
          for (var key in client.myFriends) {
            if (friends.hasOwnProperty(key)) {
              client.chatMessage(key, splitms[1]);
            }
          }
        }
      } else if (message == '!sendallitems' && steamID == config.adminID) {
        offerItems(steamID);
      } else if (message.includes("!credit")) {
        var splitmsg = message.split(" ");

        if (splitmsg[1] != null && splitmsg[2] != null && fs.existsSync('users/' + splitmsg[1] + '.json')) {

          fs.readFile('users/' + splitmsg[1] + '.json', 'utf8', function readFileCallback(err, data2) {
            if (err) {
              console.log(err);
            } else {
              obj1 = JSON.parse(data2);
              var value = parseFloat(splitmsg[2].replace(",", "."));
              obj.coins -= value;
              obj1.coins += value;
              fs.writeFileSync('users/' + splitmsg[1] + '.json', JSON.stringify(obj1));
              fs.writeFileSync('users/' + steamID + '.json', JSON.stringify(obj));
              client.chatMessage(steamID, "Your send " + value + " coins to " + splitmsg[1]);
            }
          });

        } else {
          client.chatMessage(steamID, "Error when sending coins use !credit SteamId numberOfCoins or the user is not friend with the bot");

        }

      } else {
        switch (message) {
          case "!help":
            client.chatMessage(steamID, 'Here the list of command:\n- !orders - gives all previous purchase details (item, price, orderid, date of purchase)\n- !account - shows you your profile statistics (steamid, purchases made, credits)\n- !credit [steamid] [ammount] - Send credit to an another person.\n- !pricing - display price of a key wich is based to calculate all other price');
            break;
          case "!orders":
            client.chatMessage(steamID, "Your last deposits was:\n");
            for (i = 0; i < obj.deposit.orderid.length; i++) {
              client.chatMessage(steamID, "Date: " + obj.deposit.date[i] + ", Order Id: " + obj.deposit.orderid[i] + ", Price: " + obj.deposit.price[i] + ", Items: " + obj.deposit.items[i] + "\n");
            }
            client.chatMessage(steamID, "Your last withdraw was:\n");
            for (i = 0; i < obj.withdraw.orderid.length; i++) {
              client.chatMessage(steamID, "Date: " + obj.withdraw.date[i] + ", Order Id: " + obj.withdraw.orderid[i] + ", Price: " + obj.withdraw.price[i] + ", Items: " + obj.withdraw.items[i] + "\n");
            }
            break;
          case "!account":
            var totalpurchase = 0;
            for (i = 0; i < obj.withdraw.orderid.length; i++) {
              totalpurchase += 1;
            }
            client.chatMessage(steamID, "Your account details :\n Steamid: " + steamID + "\n Member since: " + obj.dateadd + "\n Coins: " + obj.coins + "\n Total Purchase: " + totalpurchase);
            break;
          case "!pricing":
            client.chatMessage(steamID, " Price of a key is 100 coins in deposit and " + config.keyprice + " in withdraw");
            break;
          default:
            client.chatMessage(steamID, 'I did not recognize what you want type !help to get the list of commands');
        }
      }
    }
  });
});

/*
on offer
*/

manager.on('newOffer', offer => {
  totalprice = 0.00;
  totalitems = 0;
  user = offer.partner.getSteamID64();
  items = "";
  fs.readFile('users/' + user + '.json', 'utf8', function readFileCallback(err, data) {
    if (err) {
      console.log(err);
    } else {
      obj = JSON.parse(data);
      if (offer.itemsToGive.length === 0) { //deposit

        for (i = 0; i < offer.itemsToReceive.length; i++) {

          if (offer.itemsToReceive[i].appid == 730 && offer.itemsToReceive[i].market_hash_name.includes("Case") && offer.itemsToReceive[i].market_hash_name.includes("Key")) {
            totalprice += 100.0;
            totalitems += 1;
            items += "/" + offer.itemsToReceive[i].market_hash_name + "/";
          }

        }

        if (offer.itemsToReceive.length == totalitems) {

          offer.accept((err, status) => {
            if (err) {
              console.log(err);
            } else { //saving order to the user file
              var code = makeCode();
              console.log(`Deposit accepted`);
              obj.coins += totalprice;
              obj.deposit.items.push(items);
              obj.deposit.date.push(formatted);
              obj.deposit.price.push(totalprice);
              obj.deposit.orderid.push(code);
              fs.writeFileSync('users/' + user + '.json', JSON.stringify(obj));
              client.chatMessage(user, 'Your deposit of ' + totalprice + ' coins with ' + totalitems + ' keys is accepted, your oder id is #' + code);

            }
          });
        } else {

          offer.decline(err => {
            if (err) {
              console.log(err);
            } else {
              console.log('Deposit declined not giving csgo key');
              client.chatMessage(user, 'Your deposit attemp as failed please deposit only csgo Case Key');
            }
          });

        }

      } else if (offer.itemsToReceive.length === 0) { //withdraw
        totalpricewithdraw = 0;
        totalitemswithdraw = 0;
        items = "";
        for (i = 0; i < offer.itemsToGive.length; i++) {
          if (offer.itemsToGive[i].appid == 730) {
            totalpricewithdraw += getPriceItem(offer.itemsToGive[i].market_hash_name) * config.keyprice / 2.80; //calculate price of items in coin (+5% for profit) and 2.80 approximative key price
            totalitemswithdraw += 1;
            items += "/" + offer.itemsToGive[i].market_hash_name + "/";
          }
        }
        if (offer.itemsToGive.length == totalitemswithdraw && totalpricewithdraw <= obj.coins) {

          offer.accept((err, status) => {
            if (err) {
              console.log(err);
            } else {
              var code = makeCode();
              console.log(`Withdraw accepted`);
              obj.coins -= totalpricewithdraw;
              obj.withdraw.items.push(items);
              obj.withdraw.date.push(totalitemswithdraw);
              obj.withdraw.price.push(totalpricewithdraw);
              obj.withdraw.orderid.push(code);
              fs.writeFileSync('users/' + user + '.json', JSON.stringify(obj));
              client.chatMessage(user, 'Your Withdraw of ' + totalpricewithdraw + ' in exchange of ' + totalitemswithdraw + ' keys is accepted');
              community.getSteamUser(steamID, function(ERR, USER) {
                if (ERR) {
                  console.log("## An error occurred while getting user profile: " + ERR);
                } else {
                  USER.comment(config.commentAfterTrade, (ERR) => {
                    if (ERR) {
                      console.log("## An error occurred while commenting on user profile: " + ERR);
                    } else {
                      console.log('comment was posted')
                    }
                  });
                }
              });
            }
          });

        } else {

          offer.decline(err => {
            if (err) {
              console.log(err);
            } else {
              console.log("You don't have enought coins or you are not withdrawing csgo items, type !account to see your balance");
            }
          });
        }
      } else {
        offer.decline(err => {
          if (err) {
            console.log(err);
          } else {
            console.log("You can not withdraw and deposit at the same time");
          }
        });

      }
    }
  });
});
