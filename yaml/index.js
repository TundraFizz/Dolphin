var loader = require('./loader');
var dumper = require('./dumper');

module.exports.Type                = require('./type');
module.exports.Schema              = require('./schema');
module.exports.FAILSAFE_SCHEMA     = require('./schema/failsafe');
module.exports.JSON_SCHEMA         = require('./schema/json');
module.exports.CORE_SCHEMA         = require('./schema/core');
module.exports.DEFAULT_SAFE_SCHEMA = require('./schema/default_safe');
module.exports.DEFAULT_FULL_SCHEMA = require('./schema/default_full');
module.exports.load                = loader.load;
module.exports.loadAll             = loader.loadAll;
module.exports.safeLoad            = loader.safeLoad;
module.exports.safeLoadAll         = loader.safeLoadAll;
module.exports.dump                = dumper.dump;
module.exports.safeDump            = dumper.safeDump;
module.exports.YAMLException       = require('./exception');
