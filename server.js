const _ = require('lodash');
const prompt = require('prompt');
const Brain = require('./bot/src/brain');
const Chatbot = require('./bot/src/chatbot');
let aiml = [];
let startTime;
console.log('initializing brain...');
new Brain('./bot/aiml')
  .then(brain => {
    return new Chatbot(brain);
  })
  .then(chatbot => {
    console.log('training complete');
    prompt.start();
    ask(chatbot);
  });
var data = {
  topic: '',
  that: '',
};
function ask(chatbot){
  prompt.get(['text'], function (err, result) {
    if(err) {
      return;
    }
    data.that = result.text;
    var response = chatbot.talk({
      data: {
        topic: data.topic,
        that: data.that,
        wildcards: []
      },
      input: result.text.toUpperCase()
    });
    data.topic = response.data.topic;
    console.log('BOT >', response.reply);
    ask(chatbot);
  });
}
