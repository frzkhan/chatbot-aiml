
/**
 * Swap words for their equivalents.
 */
var maps = {
  month: {
    january:'01',
    february:'02',
    march: '03',
    april: '04',
    may:'05',
    june:'06',
    july:'07',
    august:'08',
    september:'09',
    october:'10',
    november:'11',
    december:'12',
  },
  days:{
    '1st':'01',
    '2nd':'02',
    '3rd':'03',
    '4th':'04',
    '5th':'05',
    '6th':'06',
    '7th':'07',
    '8th':'08',
    '9th':'09',
    '10th':'10',
    '11th':'11',
    '12th':'12',
    '13th':'13',
    '14th':'14',
    '15th':'15',
    '16th':'16',
    '17th':'17',
    '18th':'18', //@todo - add more
  }
};

/**
 * find map with the given name and return
 * @param  {String} name     name of map
 * @param  {String} value    value of map
 * @return {String}          string related to value
 */
module.exports.map = function(name, value) {
  value = value.toLowerCase();
  name = name.toLowerCase();
  if (typeof maps[name] === 'undefined') {
    throw 'Invalid map.';
  }

  return maps[name][value];
};
