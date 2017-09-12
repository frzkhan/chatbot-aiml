const P = require('bluebird');
const fs = P.promisifyAll(require('fs'));
const _ = require('lodash');
const helpers = require('./helpers');
const libxmljs = require('libxmljs');

class Brain extends helpers {
  constructor(dir) {
    super();
    this.aimlDom = [];
    this.nodePointers = [];
    return this.loadAimlDir(dir)
        .then(data => data)
        .catch(error => {
          this.log(error);
        });
  }

  /**
   * Load an AIML into memory
   * @param  {String} file
   * @return {Undefined}
   */

  loadAimlFile(file) {
    return fs.readFileAsync(file, 'utf8')
        .then(content => {
          var dom = libxmljs.parseXml(content);
          var pattern = dom.find('//pattern');
          _.forEach(pattern, p => {
            this.nodePointers.push(p);
          })
          //console.log(pattern[0].toString(), file, pattern[0].line(), dom.path());
          this.aimlDom.push(dom);
          return P.resolve();
        })
        .catch(error => {
          this.log(error);
          return P.reject(error);
        });
  }

  /**
   * Find files in a dir and run loadAimlFile on them
   * @param  {String} dir
   * @return {Undefined}
   */
  loadAimlDir(dir) {
    return fs.readdirAsync(dir)
        .map(file => {
          var name = dir + '/' + file;
          if (name.split('.').pop() === 'aiml') {
            return this.loadAimlFile(name);
          }
        })
        .then(() => {
          //sort in ascending order
          var data = _.sortBy(this.nodePointers);
          //find positions of first unique character occurrence
          var nodeMaps = [];
          _.forEach(data, function(pattern, i) {
            var char = pattern.text().substr(0, 1);
            if ((!nodeMaps.length || nodeMaps[nodeMaps.length - 1].char !== char) && !_.isEmpty(char.trim())) {
              if (nodeMaps.length) {
                nodeMaps[nodeMaps.length - 1].end = i;
              }
              nodeMaps.push({char: char, line: pattern.line(), index: i, end: i});
            }
          })
          this.log('files loaded...');
          return P.resolve({data, nodeMaps});
        })
        .catch((error) => {
          this.log(error);
          return P.reject(error);
        });
  }
}

module.exports = Brain;
