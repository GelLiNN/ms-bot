const builder = require('botbuilder');
const restify = require('restify');
const env = require('dotenv');
env.config();

// create bot
const connector = new builder.ChatConnector();
const bot = new builder.UniversalBot(
    connector,
    [
        function (session) {
            session.beginDialog('getUserInfo', session.userData.info);
        },
        function (session, results) {
            const info = session.userData.info = results.response;
            session.endConversation(info.name +
                ', I\'m getting you some information on ' + info.symbol + ':');
            session.sendTyping();
            var card = new builder.HeroCard(session);
            card.title(info.symbol);
            card.text('Information about the company from Yahoo Finance');
            card.tap(new builder.CardAction.openUrl(session,
                process.env.YAHOO_FINANCE_URL + info.symbol));

            var message = new builder.Message(session).attachments([card]);
            session.send(message);
        }
    ]
);

const recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
recognizer.onEnabled(function (context, callback) {
    if (context.dialogStack().length > 0) {
        // dont use LUIS if user is in conversation
        callback(null, false);
    } else {
        callback(null, true);
    }
});
bot.recognizer(recognizer);

bot.dialog('searchCompany', [
    function (session, args, next) {
        const query = builder.EntityRecognizer.findEntity(args.intent.entities, 'query');
        if (session.message.text.toLowerCase() == 'search') {
            builder.Prompts.text(session, 'What company are you interested in?');
        } else {
            next({ response: query.entity });
        }
    }
])

bot.dialog('getUserInfo', [
    function (session, args, next) {
        session.dialogData.info = args || {};
        if (!session.dialogData.info.name) {
            builder.Prompts.text(session, 'I am StockBot. What\'s your name?',
            { retryPrompt: 'You didn\'t tell me your name. What is it?'});
        } else {
            next();
        }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.info.name = results.response;
        }
        if (!session.dialogData.info.symbol) {
            builder.Prompts.text(session,
                'Hi ' + session.dialogData.info.name +
                '. What company stock symbol are you interested in?');
        } else {
            next();
        }
    },
    function (session, results) {
        if (results.response) {
            session.dialogData.info.symbol = results.response;
        }
        session.endDialogWithResult({ response: session.dialogData.info });
    }
])

bot.dialog('switchCompany', [
    function (session, next) {
        session.endDialog('Alright, lets change it up.');
        builder.Prompts.text(session, 'What is the symbol for that?');
        next();
    },
    function (session, results) {
        if (results.response) {
            session.dialogData.info.symbol = results.response;
        }
    }
]).triggerAction({
    matches: 'SearchCompany',
    onSelectAction: function (session, args) {
        // runs before stop dialog launches
        session.beginDialog(args.action, args);
    }
})

// create server to host bot
const server = restify.createServer();
server.post('/api/messages', connector.listen());
server.listen(
    process.env.PORT || 3978,
    function() {
        console.log('Bot Server Initialized!');
    }
);
