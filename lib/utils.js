/**
 * Some utility functions.
 */

function parseBooleanFromString(input) {
  try {
    input = ('' + input).toLowerCase();
    return (input === 'true' || input === 'yes' || input === 'y' || input === 'si' || input === 'sí' || input === true);
  }
  catch(e) {
    return false;
  }
}


module.exports = {
  parseBooleanFromString: parseBooleanFromString
};
