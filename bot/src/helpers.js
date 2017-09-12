var htmlparser = require('htmlparser');

class Helpers {
  log(msg) {
    console.log(msg);
  }

  /**
   * Output text to console with indents to make it stand out
   * @param  {String} msg Message to output
   * @return {Undefined}
   */
  debug(msg) {
    //this.log('DEBUG - ' + msg);
  }

  /**
   * Handler for plain text node. Returns content as a string.
   * @param  {libxmljs node} node Node to extract text from
   * @return {String}             INPUT's text content
   */
  handleString(node) {
    // @todo - all sorts
    return node.toString();
  }

  /**
   * Convert a XML type template to a pattern-style string
   * @param  {XML Object or String} text AIML Template
   * @return {[type]}      Normalised template
   */
  normaliseTemplate(text) {
    return text
        .toString()
        .replace(/<star ?\S*\/?>/gi, '*')
        .replace(/<template>|<\/template>/gi, '')
        .toUpperCase();
  }

  /**
   * Check if a string contains only white space
   * @param  {String}  input String to check
   * @return {Boolean}       Returns true if string is empty or just whitespace
   */
  isStringEmpty(input) {
    return input.trim() === '';
  };

  /*
   * Parse Html String
   * @param {String} string to parse
   * @return {Object} Returns parsed object
   * */
  parseHtml(string) {
    return new P((resolve, reject) => {
      var handler = new htmlparser.DefaultHandler((error, dom) => {
        if (error) {
          reject(error);
        } else {
          resolve(dom);
        }
      });

      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(string);
    });

  }

}
module.exports = Helpers;
