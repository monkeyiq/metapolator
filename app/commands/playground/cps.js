define([
    'metapolator/errors'
  , 'metapolator/cli/ArgumentParser'
  , 'ufojs/tools/io/staticNodeJS'
  , 'metapolator/models/CPS/parsing/parseRules'
  , 'metapolator/models/Controller'
  , 'metapolator/models/MOM/Univers'
  , 'metapolator/models/MOM/Master'
  , 'metapolator/models/MOM/Glyph'
  , 'metapolator/models/MOM/PenStroke'
  , 'metapolator/models/MOM/PenStrokePoint'
  , 'metapolator/models/CPS/Registry'
  , 'metapolator/math/Vector'
], function (
    errors
  , ArgumentParser
  , io
  , parseRules
  , Controller
  , Univers
  , Master
  , Glyph
  , PenStroke
  , PenStrokePoint
  , Registry
  , Vector
) {
    "use strict";
    var CommandLineError = errors.CommandLine
      , argumentParser = new ArgumentParser('cps')
      , module
      ;
    argumentParser.addArgument(
        'CPSFile'
      , 'A path to a cps file'
      , function(args) {
            var path = args.pop();
            if(path === undefined)
                throw new CommandLineError('No CPSFile argument found');
            return path;
        }
      );
    
    function main(commandName, argv) {
            // arguments are mandatory and at the end of the argv array
            // readArguments MUST run before readOptions
        var args = argumentParser.readArguments(argv)
            // options are after the command name and berfore the arguments
            // readOptions MUST run after readArguments
          , options = argumentParser.readOptions(argv)
          ;
        
        console.log('processed arguments', args)
        console.log('processed options', options)
        
        var cpsString = io.readFile(false, args.CPSFile)
        var parameterRegistry = new Registry();
        
        // FIXME: a ParameterDescription class/interface definition could
        // be the point here. So we can ensure a consistent api and
        // pinpoint programming errors
        parameterRegistry.register('value', {
                    type: 'string'
                  , description: 'this is a stub for the parameter description!'
        });
        
        parameterRegistry.register('height', {
                    type: 'compoundReal'
                  , description: 'the relative value of height'
        });
        
        parameterRegistry.register('heightIntrinsic', {
                    type: 'real'
                  , description: 'the intrinsic value of the height'
        });
        
        parameterRegistry.register('width', {
                    type: 'compoundReal'
                  , description: 'the relative value of width'
        });
        
        parameterRegistry.register('widthIntrinsic', {
                    type: 'real'
                  , description: 'the intrinsic value of the width'
        });
        
        parameterRegistry.register('zon', {
                    type: 'compoundVector'
                  , description: 'The center on curve point of a skeleton point'
        })
        parameterRegistry.register('zonIntrinsic', {
                    type: 'vector'
                  , description: 'the intrinsic value of the zon'
        })
        parameterRegistry.register('label', {
                    type: 'string'
                  , description: 'something new'
        })
        parameterRegistry.register('xx', {
                    type: 'real'
                  , description: 'and a number for mathses my precious'
        });
        
        var result = parseRules.fromString(cpsString, args.CPSFile, parameterRegistry)
          , controller = new Controller(parameterRegistry)
          , univers = controller.query('univers')
          , ralph = new Master()
          , heidi = new Master()
          , mastersOfTheUnivers 
          , data = {}
          ;
        ralph.id = 'ralph';
        heidi.id = 'heidi';
        
        controller.addMaster(ralph, [result])
        controller.addMaster(heidi, [result])

        mastersOfTheUnivers = univers.children;
        
        data[ralph.id] = {
            glyphs: [
                      ['a',[//strokes
                        Array(3),Array(4),Array(8)
                      ]]
                    , ['b',[//strokes
                        Array(4),Array(10),Array(14)
                    ]]
                    , ['c',[//strokes
                        Array(12),Array(5),Array(24)
                    ]]
            ]
        }
        data[heidi.id] = {
            glyphs: [
                      ['x',[//strokes
                        Array(3),Array(4),Array(8)
                        
                      ]]
                    , ['y',[//strokes
                        Array(4),Array(10),Array(14)
                    ]]
                    , ['z',[//strokes
                        Array(12),Array(5),Array(24)
                    ]]
            ]
            
        }

        var fooCounter = 0;
	var labelCounter = 0;
        for(var h=0; h<mastersOfTheUnivers.length; h++) {
            var glyphs = data[mastersOfTheUnivers[h].id].glyphs;
            for(var i=0;i<glyphs.length;i++) {
                var glyph = new Glyph();
                glyph.id = glyphs[i][0];
		fooCounter++;
		glyph.foo = 'bar' + fooCounter;
                mastersOfTheUnivers[h].add(glyph);
                for(var j=0;j<glyphs[i][1].length;j++) {
                    var stroke = new PenStroke();
                    glyph.add(stroke);
                    for(var k=0;k<glyphs[i][1][j].length;k++) {
                        var point = new PenStrokePoint( { on: Vector(1,2) } );
			point.label = 'baz' + labelCounter++;
			point.xx = 3;
                        stroke.add(point);
			console.log('point: ' + point.center );
                    }
                }
            }
        }

	console.log('m.l: ' + mastersOfTheUnivers.length );
	console.log('m0: ' + mastersOfTheUnivers[0] );
	console.log('m1: ' + mastersOfTheUnivers[1] );
	console.log('m0.gl: ' + mastersOfTheUnivers[0].children.length );
        for(var j=0; j<mastersOfTheUnivers[0].children.length; j++) {
	    var glyph = mastersOfTheUnivers[0].children[j];
	    console.log('g: ' + glyph.id );
	    console.log('g: ' + glyph.foo );

	    console.log('g.l:' + glyph.children.length );
	    glyph.children.forEach( function( stroke ) {
		console.log('  stroke: ' + stroke );
		stroke.children.forEach( function( point ) {
		    console.log('     point.id: ' + point.id + ' label:' + point.label + ' ' + point  );
		});
	    });
	}
    
        var element = controller.query('master#ralph glyph point:i(23)');
        
        console.log('element:', element.particulars);
        console.log('element:', element.label);
        var computed = controller.getComputedStyle(element)
          , valueInstance = computed.get('width')
          ;
        
        
        console.log('result ' + valueInstance.value, valueInstance._components.join('|'));
        

// * { 
//      label : 1234; 
//      xx    : 5;
// }

// glyph#y penstroke:i(0) point:i(0) {
//      xx    : 6;
// }

        
        element = controller.query('master#heidi glyph#y penstroke:i(0) point:i(0)')
        console.log('element:', element.particulars);
        console.log('element:', element.label);
        console.log('element:', element.xx);
//        console.log('element:', element);
        computed = controller.getComputedStyle(element)
        valueInstance = computed.get('zon')
	console.log('label: ' + computed.get('label'));
	console.log('xx.base   : ' + computed.getCPSValue('xx'));
	console.log('xx.updated: ' + computed.getCPS('xx'));
	console.log('xx.value  : ' + (computed.getCPS('xx') ? computed.getCPS('xx') : computed.getCPSValue('xx')));
        console.log('result ' + valueInstance.value, valueInstance._components.join('|'));
        console.log('computed ' + computed.get('value'));
        
        
        // console.log(''+result);
    }
    
    
    module = {main: main};
    Object.defineProperty(module, 'help', {
        get: argumentParser.toString.bind(argumentParser)
    });
    return module;
})

