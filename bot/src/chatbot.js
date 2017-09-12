'use strict';
const P = require('bluebird');
const _ = require('lodash');
const Logger = require('./logger');
const helpers = require('./helpers');
const subs = require('./substitutions');
const sets = require('./sets');
const maps = require('./maps');
const botAttributes = require('./personality');

class Chatbot extends helpers {
  constructor(brain) {
    super();
    this.starRegEx = ' [\\w\\s/-]+';// @todo - add support for #,_
    this.hatRegEx = '[\\w\\s/-]*';
    this.logger = new Logger('./logs/bot.log');
    this.storedVariables = [];
    this.dbVariables = [];
    this.wildcardStack = [];
    this.inputStack = [];
    this.previousResponse = '';
    this.unknownVariableString = 'unknown';
    this.topic = '';
    this.sentence = '';
    this.template = '';
    this.startTime = '';
    this.aimlDom = brain.data;
    this.nodeMaps = brain.nodeMaps;
  }

  find(data) {
    const topic = data.data.topic;

    data.input = data.input.toUpperCase();
    const similar = _.filter(this.nodeMaps, function(node) {
      return (node.char === data.input.trim().substr(0, 1) || node.char === '*' || node.char === '^');
    });

    let closeMatch = [];
    _.forEach(similar, (o) => {
      for (let i = o.index; i <= o.end; i++) {
        const match = this.comparePattern(data.input, this.aimlDom[i].text());
        let percent = 0;
        if (match) {
          if (!_.isEmpty(topic)) {
            //check if element has topic tag
            const tag = this.aimlDom[i].parent().parent();
            if (tag.name() === 'topic' && tag.attr('name').value() === topic) {
              percent += 30;
            }
          }
          if (!_.isEmpty(data.that)) {
            if (this.checkThat(this.aimlDom[i].parent())) {
              percent += 30;
            }
          }
          if (data.input === this.aimlDom[i].text()) {
            percent += 40;
          }
          // check the number of word differences
          // to set priority higher for matched words increase percentage
          if(_.xor(_.words(this.aimlDom[i].text()), _.words(data.input)).length < _.words(data.input).length) {
            percent += _.words(this.aimlDom[i].text()).length;
          }
          closeMatch.push({dom: this.aimlDom[i], percent: percent});
          if (percent === 100) {
            break;
          }
        }
      }
    });

    const pattern = _.maxBy(closeMatch, 'percent');
    const template = pattern.dom.parent().find('template');

    const response = this.getTemplateText(template[0]);
    return response;
  }

  talk(data) {
    let response = '';
    this.startTime = new Date();
    this.sentence = _.isEmpty(data.input) ? '' : data.input;
    this.storedVariables = data.data;
    this.topic = this.storedVariables.topic;
    this.previousResponse = this.storedVariables.that;
    this.wildcardStack = this.storedVariables.wildcards;
    this.inputStack = [];
    this.userId = data.userId;

    return {
      reply: this.find({
        input: this.sentence,
        that: this.previousResponse,
        data: this.storedVariables,
        userId: this.userId,
      }),
      data: this.storedVariables,
      wildcards: this.wildcardStack,
      inputStack: this.inputStack,
    };
  }

  /**
   * Handler for the AIML <bot> tag. Get a bot's attribute from memory.
   * @param  {[type]} name [description]
   * @return {[type]}      [description]
   */
  getBotAttribute(name) {
    if (typeof botAttributes[name] == undefined) {
      return null;
    }

    return botAttributes[name];
  }

  /**
   * Handler for AIML <get> tag. Get a variable from the bot's memory.
   * @param  {String} name Name of the variable
   * @return {String}      Value of the variable
   */
  getStoredVariable(name) {
    return this.storedVariables[name];
  }

  /**
   * Handler for AIML <set> tag. Store a value in the bot's memory for later use.
   * @param {String} name  The name of the variable to set
   * @param {String} value The value of the variable
   */
  setStoredVariable(name, value) {
    this.storedVariables[name] = value;
  }

  /**
   * Unload all data from the AIML DOM
   * @return undefined
   */
  emptyMind() {
    this.aimlDom = [];
  };

  /**
   * Check whether a given category has a <that> and whether
   * if matches the previous response
   * @param  {Object}  category Libxmljs category aiml node
   * @return {Boolean}          True if <that> exists and matches
   */
  checkThat(category) {
    const that = category.find('that');

    if (that.length === 0) {
      return true;
    }

    if (that.length > 1) {
      this.debug('Error: multiple <that>s. Using first.');
    }

    return that[0].text() === this.previousResponse.toUpperCase();
  };

  /**
   * Compare a user's sentence to an AIML pattern
   * @param  {String} sentence User's sentence
   * @param  {String} pattern  AIML pattern
   * @return {Boolean}         True if sentence matches pattern
   */
  comparePattern(sentence, aimlPattern) {
    // @todo - improvement
    // add spaces to prevent false positives
    if (sentence.charAt(0) !== ' ') {
      sentence = ' ' + sentence;
    }

    if (sentence.charAt(sentence.length - 1) !== ' ') {
      sentence = sentence + ' ';
    }

    sentence = sentence.toUpperCase(); // @todo - remove this
    const regexPattern = this.aimlPatternToRegex(aimlPattern).replace(/[?]/g, '\\?');
    const matches = sentence.match(new RegExp(regexPattern, 'gi'));

    if (matches && (matches[0].length >= sentence.length ||
        regexPattern.indexOf(this.starRegEx) > -1)) {
      this.wildcardStack.push(this.getWildCardValues(sentence, aimlPattern));
      return true;
    }

    return false;
  }

  /**
   * Convert a string with wildcards (*s) to regex
   * @pattern  String pattern The string with wildcards
   * @return String      The altered string
   */
  aimlPatternToRegex(pattern) {
    let lastChar = pattern.charAt(pattern.length - 1);
    let firstChar = pattern.charAt(0);

    // add spaces to prevent e.g. foo matching food
    if (firstChar !== '*' || firstChar !== '^') {
      pattern = ' ' + pattern;
    }

    let lastCharIsStar = lastChar === '*';

    // remove spaces before *s
    pattern = pattern.replace(' *', '*');

    // remove spaces before ^s
    pattern = pattern.replace(' ^', '^');

    // replace * wildcards with regex
    pattern = pattern.replace(/\*/g, this.starRegEx);

    // replace ^ wildcards with regex
    pattern = pattern.replace(/\^/g, this.hatRegEx);

    //sets regexp
    pattern = pattern.replace(/\$number/g, '([0-9]+)');

    let patternSets = pattern.match(/(\$\w+)/gi);

    if (patternSets !== null) {
      _.forEach(patternSets, (item) => {
        if (sets.set(item.substr(1))) {
          pattern = pattern.replace(/(\$\w+)/i, '(\\b' +
              sets.set(item.substr(1)).join('\\b|\\b') + '\\b)');
        }
      })
    }

    if (!lastCharIsStar) {
      pattern = pattern + '[\\s|?|!|.]*';
    }

    return pattern;
  }

  /**
   * Extract wildcard values from a sentence using a given pattern
   * @param  {String} sentence Sentence to extract values from
   * @param  {String} pattern  AIML pattern to match against
   * @return {Array}           Wildcard values
   */
  getWildCardValues(sentence, pattern) {
    pattern = pattern + ' ';
    pattern = pattern.replace(/(\$\w+)/g, '*');
    const replaceArray = pattern.split(/[*|^]/g); // @todo - problem here need to fix

    if (replaceArray.length < 2) {
      return this.wildcardStack[this.wildcardStack.length - 1];
    }

    // replace non-wildcard parts with a pipe
    _.forEach(replaceArray, (item) => {
      sentence = sentence.replace(item, '|');
    })

    // split by pipe and we're left with values and empty strings
    sentence = sentence.trim().split('|');

    let output = [];
    let chunk = '';

    for (let i = 0; i < sentence.length; i++) {
      chunk = sentence[i].trim();

      if (chunk === '') continue;

      if (chunk.charAt(chunk.length - 1) === '?') {
        chunk = chunk.substr(0, chunk.length - 1);
      }

      output.push(chunk);
    }

    return output;
  }

  /**
   * Parse an AIML pattern and get the resulting text
   * @param  {Object} pattern Libxmljs pattern node
   * @return {String}          Outputted text
   */
  getPatternText(pattern) {
    //this.log('Using pattern: ' + pattern.toString());

    const children = pattern.childNodes();
    let output = '';
    for (let i = 0; i < children.length; i++) {
      switch (children[i].name().toLowerCase()) {
        case 'pattern':
          output += this.getPatternText(children[i]);
          break;
        case 'set':
          output += '$' + this.getPatternText(children[i]);
          break;
        case 'get':
          if (children[i].attr('name') &&
              this.getStoredVariable(children[i].attr('name').value())) {
            output += this.getStoredVariable(children[i].attr('name').value());

          } else if (children[i].attr('default')) {
            output += children[i].attr('default').value();
          } else {
            output += this.unknownVariableString;
          }

          break;

        case 'text':
          output += this.handleString(children[i]);
          break;
        default:
          output += ' [' + children[i].name() + ' not implemented] ';
          break;
      }

    }

    return output;
  };

  /**
   * Parse an AIML template and get the resulting text
   * @param  {Object} template Libxmljs template node
   * @return {String}          Outputted text
   */
  getTemplateText(template) {
    //this.log('Using template: ' + template.toString());
    let output = '';
    const children = template.childNodes();

    _.forEach(children, (element, i) => {

      switch (element.name().toLowerCase()) {
        case 'template':
          output += this.getTemplateText(element);
          break;
        case 'text':
          if (element.text().trim() !== '') {
            output += this.handleString(element);
          }

          break;
        case 'a': // link tag - return as text
          output += element.toString();
          break;
        case 'br':
          output += '<br>';
          break;
        case 'srai':
          output += this.find({
            input: this.getTemplateText(element),
            that: this.previousResponse,
            data: this.storedVariables,
          });
          break;
        case 'random':
          const listItems = element.find('li');
          const rand = Math.floor(Math.random() * listItems.length);
          const randomElement = listItems[rand];

          output += this.getTemplateText(randomElement);
          break;
        case 'bot':
          output += this.getBotAttribute(element.attr('name').value());
          break;
        case 'get':
          var value = this.getStoredVariable(element.attr('name').value());
          if (element.attr('name') && value) {
            output += value;
          } else if (element.attr('default')) {
            output += element.attr('default').value();
          } else {
            output += this.unknownVariableString;
          }

          break;
        case 'set':
          var value = this.getTemplateText(element);
          this.setStoredVariable(element.attr('name').value(), value);
          output += value;
          break;
        case 'size':
          let size = 0;

          _.forEach(this.aimlDom, item => {
            size += item.find('category').length;
          })
          output += size;
          break;
        case 'star':
          let index = 0;

          if (element.attr('index')) {
            index = element.attr('index').value() - 1;
          }

          const wildcards = this.wildcardStack[this.wildcardStack.length - 1];

          if (typeof wildcards[index] === 'undefined') {
            this.debug('Error: <star> with no matching * value');
          } else {
            output += _.capitalize(wildcards[index].toLowerCase());
          }

          break;
        case 'date':
          output += new Date().toISOString();
          break;
        case 'sr':

          //@todo - incomplete
          break;
        case 'map':
          if (element.attr('name')) {
            const mapName = element.attr('name').value();
            const mapValue = this.getTemplateText(element);
            output += maps.map(mapName, mapValue);
          }

          break;
        case 'that':
          output += this.previousResponse;
          break;
        case 'thatstar':
          wildcards = this.wildcardStack[this.wildcardStack.length-1][0];
          index = 0;

          if (element.attr('index')) {
            index = element.attr('index').value() - 1;
          }

          if (!wildcards) {
            this.debug('Error: <thatstar> with no matching * value.');
          } else {
            output += wildcards[index];
          }

          break;
        case 'li':
          output += this.getTemplateText(element);
          break;
        case 'gender':
        case 'person2':
        case 'person':
          let text = this.getTemplateText(element);
          const set = element.name().toLowerCase();
          if (!text) {
            text = this.wildcardStack[this.wildcardStack.length-1][0];
          }

          output += subs.swap(text, set);

          break;
        case 'formal':
          text = this.getTemplateText(element);

          output += text.toLowerCase().replace(/(?:^|\s)\S/g, formal =>
              formal.toUpperCase());

          break;
        case 'sentence':
          text = this.getTemplateText(element).toLowerCase();
          output += text[0].toUpperCase() + text.slice(1);
          break;
        case 'uppercase':
          output += this.getTemplateText(element).toUpperCase();
          break;
        case 'lowercase':
          output += this.getTemplateText(element).toLowerCase();
          break;
        case 'condition':
          const expr = element.attr('expr') ? element.attr('expr').value() : 'e';
          if (element.attr('name')) {
            const name = element.attr('name').value();
            const value = this.getStoredVariable(name) || '';
            const list = element.find('li');
            const found = _.find(list, (li) => {
              let result = false;
              if (!li.attr('value')) return true;
              switch (expr) {
                case 'g':
                  result = value.toLowerCase() > li.attr('value').value().toLowerCase();
                  break;
                case 'ge':
                  result = value.toLowerCase() >= li.attr('value').value().toLowerCase();
                  break;
                case 'l':
                  result = value.toLowerCase() < li.attr('value').value().toLowerCase();
                  break;
                case 'le':
                  result = value.toLowerCase() <= li.attr('value').value().toLowerCase();
                  break;
                case 'e':
                default:
                    result = value.toLowerCase() == li.attr('value').value().toLowerCase();
                  break;
              }
              return result;
            });

            if (found) {
              output += this.getTemplateText(found);
            }
          }

          break;
        case 'think':
          // Parse template but don't output results
          this.getTemplateText(element);
          break;
        case 'version':
          output += 'v2';
          break;
        default:
          output += ' [' + element.name() + ' not implemented] ';
          break;
      }
    });

    return output;
  }
}
module.exports = Chatbot;
