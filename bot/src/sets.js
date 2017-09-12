
/**
 * sets of words
 */
	var sets = {
  affirmative: [['Ya'], ['Yea'], ['Yeah'], ['Yes'], ['Yo'], ['Yup'], ['Sure']],
  negative: [['Na'], ['Nah'], ['No'], ['Nop'], ['Nope'], ['Nopes'], ['Nops'], ['Nopss'], ['Nopsss'], ['Oh no no']],
  month: [['april'], ['august'], ['december'], ['february'], ['january'], ['july'], ['june'], ['march'], ['may'], ['november'], ['october'], ['september']],
  greetings: [['HELLO'], ['HI'], ['HEY'], ['CIAO'],['HOLA']],
  animal: [['DOG']]
	};

/**
 * Swap words in a given sentence from a given set of pairs.
 * @param  {String}	    name of set
 * @return {array}      related set
 */
module.exports.set = function(name) {
  return sets[name];
};
