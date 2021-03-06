define([
    'metapolator/errors'
  , 'obtain/obtain'
  , 'ufojs/plistLib/main'
  , 'ufojs/plistLib/IntObject'
  , './ProjectMaster'
  , './parameters/registry'
  , './parameters/defaults'
  , 'metapolator/models/MOM/Univers'
  , 'metapolator/models/Controller'
  , 'ufojs/ufoLib/glifLib/GlyphSet'
  , './ImportController'
  , './ExportController'
  , 'yaml'
  , 'metapolator/models/CPS/parsing/parseRules'
], function(
    errors
  , obtain
  , plistLib
  , IntObject
  , ProjectMaster
  , parameterRegistry
  , defaultParameters
  , Univers
  , ModelController
  , GlyphSet
  , ImportController
  , ExportController
  , yaml
  , parseRules
) {
    "use strict";

        // FIXME: make this availabe for browsers, too
    var metainfoV3 = {
            creator: 'org.ufojs.lib'
            // otherwise this ends as 'real' in the plist, I don't know
            // how strict robofab is on this, but unifiedfontobkect.org
            // says this is an int
          , formatVersion: new IntObject(3)
        }
      , metainfoV2 = {
            creator: 'org.ufojs.lib'
            // otherwise this ends as 'real' in the plist, I don't know
            // how strict robofab is on this, but unifiedfontobkect.org
            // says this is an int
          , formatVersion: new IntObject(2)
        }
      , // fontforge requires a fontinfo.plist that defines unitsPerEm
        minimalFontinfo = {unitsPerEm: new IntObject(1000)}
      , ProjectError = errors.Project
      , KeyError = errors.Key
      ;
    
    function MetapolatorProject(io, dirName) {
        this._io = io;
        this._data = {
            masters: {}
        };
        this._cache = {
            masters: {}
          , rules: {}
        }
        
        this._controller = new ModelController(parameterRegistry);
        
        // here is a way to define a directory offset
        // this is used with _p.init after the dir was created for example
        this.dirName = dirName || '.';
    }
    
    MetapolatorProject.init = function(io, name) {
        var project = new MetapolatorProject(io)
          , dirName = name+'.ufo'
          ;
        // create dirName
        if(io.pathExists(false, dirName+'/'))
            throw new ProjectError('Dir exists already: '+ dirName);
        project.init(dirName);
    };
    
    var _p = MetapolatorProject.prototype;
    _p.constructor = MetapolatorProject;
    Object.defineProperty(_p, 'dataDir', {
        get: function(){ return this.dirName + '/data/com.metapolator';}
    });
    
    Object.defineProperty(_p, 'projectFile', {
        get: function(){ return this.dataDir + '/project.yaml';}
    });
    
    Object.defineProperty(_p, 'cpsDir', {
        get: function(){ return this.dataDir + '/cps';}
    });
    
    Object.defineProperty(_p, 'cpsDefaultFile', {
        get: function(){ return 'default.cps'; }
    });
    
    Object.defineProperty(_p, 'cpsGlobalFile', {
        get: function(){ return 'global.cps'; }
    });
    
    Object.defineProperty(_p, 'layerContentsFile', {
        get: function(){ return this.dirName+'/layercontents.plist'; }
    });
    
    _p.getNewGlyphSet = function(async, dirName, glyphNameFunc, UFOVersion) {
        return GlyphSet.factory(
                    async, this._io, dirName, glyphNameFunc, UFOVersion);
    }
    
    _p.init = function(dirName) {
        // everything synchronously right now
        this.dirName = dirName;
        
        this._io.mkDir(false, this.dirName);
        
        // create dirName/metainfo.plist
        this._io.writeFile(false, this.dirName+'/metainfo.plist'
                                , plistLib.createPlistString(metainfoV3));
        
        // create dir dirName/data
        this._io.mkDir(false, this.dirName+'/data');
        // create dir dirName/data/com.metaploator
        this._io.mkDir(false, this.dataDir);
        
        // project file:
        // create     this.dataDir/project.yaml => yaml({})
        this._io.writeFile(false, this.projectFile, yaml.safeDump(this._data));
        
        // create dir this.dataDir/cps
        this._io.mkDir(false, this.cpsDir);
        this._io.writeFile(false, this.projectFile, yaml.safeDump(this._data));
        
        // create layercontents.plist
        this._io.writeFile(false, this.layerContentsFile,
                                        plistLib.createPlistString([]));
        
        // the glyphs dir must be there, so the ufo is valid. but we don't
        // use it currently :-(
        // create dir dirName/glyphs
        this._createGlyphLayer('public.default', 'glyphs');
        
        // create a default.cps
        // this is the standard wiring of cps compounds etc.
        // we include it, so it can be studied and if needed changed 
        this._io.writeFile(false, [this.cpsDir, '/', this.cpsDefaultFile].join(''),
                                        this.getDefaultCPS().toString());
        
        // this can be empty, all masters will use this by default
        this._io.writeFile(false, [this.cpsDir, '/', this.cpsGlobalFile].join(''),
                            '/* all masters use this CPS file by default*/');
    }
    
    _p.load = function() {
        // the files created in _p.init need to exist
        // however, we try to load only
        // this.dirName+'/data/com.metapolator/project.yaml' as an indicator
        // console.log('loading', this.projectFile);
        var dataString = this._io.readFile(false, this.projectFile);
        // console.log('loaded', dataString);
        this._data = yaml.safeLoad(dataString);
        
        
    }
    
    /**
     * return a ParameterCollection with the default CPS wiring, as the
     * importer expects it.
     */
    _p.getDefaultCPS = function() {
        return defaultParameters;
    }
    
    _p.hasMaster = function(masterName) {
        return masterName in this._data.masters;
    }
    
    Object.defineProperty(_p, 'masters', {
        get: function(){ return Object.keys(this._data.masters); } 
    });
    
    Object.defineProperty(_p, 'controller', {
        get: function(){ return this._controller; }
    });
    
    _p._createGlyphLayer = function(name, layerDirName) {
        if(layerDirName === undefined)
            layerDirName = 'glyphs.' + name;
        
        var layerDir = [this.dirName,'/',layerDirName].join('');
        
        // read layercontents.plist
        var layercontents = plistLib.readPlistFromString(
                this._io.readFile(false, this.layerContentsFile));
        
        // see if there is a layer with this name
        for(var i=0;i<layercontents.length;i++)
            if(layercontents[i][0] === name)
                throw new ProjectError('A glyph layer with name "'+name
                                                +'" already exists.');
        
        // see if there is a directory with the name layerDir already
        if(this._io.pathExists(false, layerDir+'/'))
            throw new ProjectError('Can\'t create glyph layer. A directory '
                                    +'with name "' + layerDir
                                    +'" already exists.');
        // create new layer dir
        this._io.mkDir(false, layerDir);
        
        // store layer in layercontents
        layercontents.push([name, layerDirName]);
        this._io.writeFile(false, this.layerContentsFile,
                                    plistLib.createPlistString(layercontents));
        
        // create empty layerDir/contents.plist
        this._io.writeFile(false, layerDir + '/contents.plist',
                                        plistLib.createPlistString({}));
    }
    
    /**
     * Returns the path needed to instanciate a GlyphSet
     */
    _p._getLayerDir = function(name) {
        // read layercontents.plist
        var layercontents = plistLib.readPlistFromString(
                this._io.readFile(false, this.layerContentsFile))
          , layerDir
          ;
        
        for(var i=0;i<layercontents.length;i++)
            if(layercontents[i][0] === name) {
                layerDir = [this.dirName,'/',layercontents[i][1]].join('');
                break;
            }
        if(!layerDir)
            throw new KeyError('Layer named "' + name + '" not found.');
        if(!this._io.pathExists(false, layerDir + '/'))
            throw new KeyError('Layer directory "' + layerDir
                                + '" does not exist, but is linked in '
                                +'layercontents.plist.');
        return layerDir;
    }
    
    /**
     * create a master entry for this masterName
     * {
     *      cpsLocalFile: masterName.cps
     *    , cpsChain: [global.cps, masterName.cps]
     * }
     * 
     * and an entry in layercontents.plist:
     * skeleton.masterName, glyphs.skeleton.masterName
     * 
     */
    _p.createMaster = function(masterName) {
        // get the name for this master from the cli
        if(this.hasMaster(masterName))
            throw new ProjectError('Master "'+masterName+'" alredy exists.');
        var master = {};
        this._data.masters[masterName] = master;
        master.cpsLocalFile = masterName + '.cps';
        master.cpsChain = [this.cpsDefaultFile, this.cpsGlobalFile, master.cpsLocalFile];
        
        // create a skeleton layer for this master
        master.skeleton = 'skeleton.' + masterName;
        this._createGlyphLayer(master.skeleton);
        
        
        this._io.writeFile(false, this.projectFile, yaml.safeDump(this._data));
        
        return this.getMaster(masterName);
    }
    _p._getMaster = function(masterName) {
        var master =  this._data.masters[masterName]
          , glyphSetDir = this._getLayerDir(master.skeleton)
          ;
        return new ProjectMaster(this._io, this, glyphSetDir
                                , master.cpsLocalFile, master.cpsChain);
    }
    
    _p.getMaster = function(masterName) {
        if(!this.hasMaster(masterName))
            throw new KeyError('Master "'+masterName+'" not in project');
        if(!this._cache.masters[masterName]) {
            this._cache.masters[masterName] = this._getMaster(masterName);
        }
        return this._cache.masters[masterName];
    }
    
    
    _p._getCPSRules = function getCPSRule(sourceName) {
        var fileName = [this.cpsDir, sourceName].join('/')
          , cpsString = this._io.readFile(false, fileName)
          ;
        return parseRules.fromString(cpsString, sourceName, parameterRegistry);
    }
    
    _p.getCPSRules = function(sourceName) {
        if(!this._cache.rules[sourceName])
            this._cache.rules[sourceName] = this._getCPSRules(sourceName);
        return this._cache.rules[sourceName];
    }
    
    /**
     * parse the doc content
     * if it parses, replace the old cps rule with the new cps rule
     * inform all *consumers* of these rules that there was an update
     * this might involve pruning some caches of ModelControllers.
     * 
     * If this doesn't parse, a CPSParserError is thrown
     */
    _p.updateCPSRule = function(sourceName, cpsString) {
        var source = parseRules.fromString(cpsString, sourceName, parameterRegistry);
        // if we are still here parsing was a success
        this._cache.rules[sourceName] = source;
        this._controller.replaceSource(source);
    }
    
    _p.open = function(masterName) {
        if(!this._controller.hasMaster(master)) {
            // console.log('open', masterName)
            var master = this.getMaster(masterName)
            , parameterCollections = master.loadCPS()
            , momMaster = master.loadMOM()
            ;
            momMaster.id = masterName;
            this._controller.addMaster(momMaster, parameterCollections);
        }
        return this._controller;
    }
    
    _p.getMasterSources = function(master) {
        if(!this._controller.hasMaster(master))
            this.open(master);
        return this._controller.getMasterSources(master);
    }
    
    _p.import = function(masterName, sourceUFODir, glyphs) {
        var importer = new ImportController(
                                        this, masterName, sourceUFODir);
        importer.import(glyphs);
    }
    
    _p.exportInstance = function(masterName, instanceName, precision) {
        // returns a models/Controller
        var model = this.open(masterName)
          , master = model.query('master#' + masterName)
          , dirName = instanceName + '.ufo'
          , glyphSet
          , exportController
          ;
        
        // create a bare ufoV2 directory
        if(this._io.pathExists(false, dirName +'/'))
             throw new ProjectError('Can\'t create instance. A directory '
                                    +'with name "' + dirName
                                    +'" already exists.');
        this._io.mkDir(false, dirName);
        
        // create dirName/metainfo.plist
        this._io.writeFile(false, dirName+'/metainfo.plist'
                                , plistLib.createPlistString(metainfoV2));
        
        // fontforge requires a fontinfo.plist that defines unitsPerEm
        this._io.writeFile(false, dirName+'/fontinfo.plist'
                                , plistLib.createPlistString(minimalFontinfo));
        
        this._io.mkDir(false,  dirName +'/glyphs');
        
        glyphSet = this.getNewGlyphSet(
                                false, dirName +'/glyphs', undefined, 2);
        
        exportController = new ExportController(master, model, glyphSet, precision);
        exportController.export();
    }
    
    return MetapolatorProject;
});
