var recursive = require('recursive-readdir');
var winston = null;
var Command = require('ronin').Command;
var async = require('async');
var trash = require('trash');
var path = require('path');
var fs = require('fs');

var EXTENSIONS = [
    'aux',
    '4ct',
    '4tc',
    'oc',
    'md5',
    'dpth',                    
    'out',
    'jax',
    'idv',
    'lg',
    'tmp',
    'xref',
    'log',                            
    'auxlock',
    'dvi',
    'pdf'
];

var ALL_EXTENSIONS = [
    'html',
    'png',
    'svg'       
    ]

function isCleanableFile( filename, callback ) {
    callback (EXTENSIONS.indexOf(path.extname( filename ).replace(/^\./,'')) >= 0);
}

/** @function determineFilesToCompile examines all the files in the given directory (and its subdirectories) and calls callback with a list of files that require compilation */
function determineFilesToClean( directory, callback ) {
    async.waterfall([
	// Fetch all the possible filenames
	function(callback) {
	    winston.debug( "Recursively list all files in " + directory );
	    recursive(directory, callback);
	},

	// Identify the output files
	function(filenames, callback) {
	    winston.debug( "Do not delete files in the .git repo itself" );

	    var isGitFile = function(filename, callback) {
		callback( path.resolve(filename).split( path.sep ).indexOf('.git') >= 0 );
	    };
	    
	    async.reject( filenames, isGitFile, function(filenames) {
		callback( null, filenames );
	    });
	},
	
	// Identify the output files
	function(filenames, callback) {
	    winston.debug( "Only delete files with certain extensions" );
	    
	    async.filter( filenames, isCleanableFile, function(filenames) {
		callback( null, filenames );
	    });
	},

	// BADBAD: do not delete files if they are committed to the repository
	
    ], function(err, results) {
	callback(err, results);
    });
}
	
var CleanCommand = module.exports = Command.extend({
    use: ['winston', 'find-repository-root'],
    
    desc: 'Remove files generated by pdflatex and htlatex',

    options: {
        all: {
            type: 'boolean',
	    default: false
        },
	
        'delete': {
            type: 'boolean',
	    default: false
        }	
    },
    
    run: function (all, actuallyDelete) {
	var global = this.global;
	winston = global.winston;

	// Include more extenions if "--all" is given
	if (all) {
	    ALL_EXTENSIONS.forEach( function(e) {
		EXTENSIONS.push(e);
	    });
	}
	
	determineFilesToClean( global.repository, function(err, filenames) {
	    if (filenames.length == 0)
		winston.info("Nothing to clean.");
	    else {
	    
		if (!actuallyDelete) {
		    trash( filenames ).then( function() {
			winston.info("Moved " + filenames.length + " output files to the trash.");
		    });
		} else {
		    async.each( filenames, function( filename, callback ) {
			fs.unlink( filename, callback );
		    }, function(err) {
			if (err)
			    throw new Error(err);
			else
			    winston.info("Deleted " + filenames.length + " output files.");
		    });
		}
		
	    }
	});
    }
});
