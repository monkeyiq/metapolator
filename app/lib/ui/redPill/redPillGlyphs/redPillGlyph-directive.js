define([
    'metapolator/webAPI/document'
  , 'metapolator/project/ExportController'
  , 'ufojs/tools/pens/PointToSegmentPen'
  , 'ufojs/tools/pens/SVGPen'
  , 'ufojs/tools/pens/TransformPen'
  , 'ufojs/main'
    ], function(
    document
  , ExportController
  , PointToSegmentPen
  , SVGPen
  , TransformPen
  , main
) {
    "use strict";
    
    var svgns = 'http://www.w3.org/2000/svg'
        , enhance = main.enhance
        ;

    function svgPenFactory(layer, glyphset) {
        var pathElement = document.createElementNS(svgns, 'path')
          , svgPen = new SVGPen(pathElement, glyphset)
          ;
        // make empty
        while (layer.firstChild)
            layer.removeChild(layer.firstChild);
        layer.appendChild(pathElement);
        return svgPen;
    }
    
    function getSVG(element) {
        var svg = element[0].getElementsByTagName('svg')[0];
        if(!svg) {
            svg = document.createElementNS(svgns, 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('viewBox', '0 0 1000 1000');
            element.append(svg);
        }
        return svg;
    }
    function getLayer(svg, name) {
        // Use classnames, because ids are available from the host document
        // as well, and thus they could create unwanted situations.
        // Classes are also available from the host document, but they don't
        // need to be unique.
        // These classes should be unique within this svg document.
        var uniqueClass = 'layer-'+name
          , layer = svg.getElementsByClassName(uniqueClass)[0];
        if(!layer) {
            layer = document.createElementNS(svgns, 'g');
            layer.setAttribute('transform', 'matrix(1, 0, 0, -1, 0, 800)');
            layer.setAttribute('class', uniqueClass);
            svg.appendChild(layer);
        }
        return layer;
    }

    /**
     * When a component is discovered during the rendering of a glyph
     * this method is called. We have to lookup the referenced glyph
     * and perform a render of that glyph with the desired
     * tranformation. Note that this can be recursive, in that the
     * referred to glyph may itself have componenets which will need
     * to be rendered.
     *
     * This method requires this.glyphSet to have certain members
     * to work. These are; 
     * @param ep an ExportController object
     * @param model
     * @param renderer to use
     * @param get() which can be used to lookup a glyph by name.
     *
     */
    function SVGPen_addComponent(glyphName, transform) {
        console.log( "SVGPen_addComponent(top) gn: " + glyphName );
        var glyph = (typeof this.glyphSet.get === 'function')
            ? this.glyphSet.get(glyphName)
            : this.glyphSet[glyphName];

        if(glyph !== undefined) {
            console.log("have looked up glyph..." + glyph.id );
            var transformPen = new TransformPen(this, transform);
            var pointPen     = new PointToSegmentPen(transformPen)

            var ep = this.glyphSet.ep;
            console.log( " ep: " + ep );
//            console.log( "ren: " + this.glyphSet.renderer );
            console.log( "mod: " + this.glyphSet.model );
            console.log( "transformPen: " + transformPen );

            ep.drawGlyphToPointPen( this.glyphSet.renderer, 
                                    this.glyphSet.model, 
                                    glyph, pointPen );
            console.log( "SVGPen_addComponent(done) for glyph: " + glyphName );
        }

        // just a silly little test to see if the draw works.
        // this.moveTo( [ 0, 0 ] );
        // this.lineTo( [ 10, 0 ] );
        // this.lineTo( [ 10, 10 ] );
        // this.lineTo( [ 0, 10 ] );
        // this.closePath();
    }
    
    function getLayerGenerator(ep, svg, model, glyph, layername, renderer) {
        var layer = getLayer(svg, layername)
        , momMaster = glyph.parent
        , svgPen = svgPenFactory(layer,
                                 { 
                                     // the SVGPen_addComponent() needs these to survive.
                                       ep:       ep
                                     , model:    model
                                     , renderer: renderer
                                     , get: function(glyphName) 
                                             { return momMaster.findGlyph(glyphName); } 
                                 })
          , pointPen = new PointToSegmentPen(svgPen)
          ;

        //
        // Monkey patch the addComponent onto the svgPen. This is a
        // hard patch on the class itself, and works ok.
        // 
        enhance(SVGPen, { addComponent : SVGPen_addComponent });

        return ep.drawGlyphToPointPenGenerator(renderer, model, glyph, pointPen);
    }

    function iterateGenerator(gen) {
        var done = false;
        try {
            done = gen.next().done;
        }
        catch(error) {
            if(error.message === "Generator has already finished")
                done = true;
            else
                throw error;
        }
        // clear this from the list
        return done;
    }
    
    /**
     *
     * @param glyph is a MOM glyph object
     */
    function render(scope, element, glyph, model) {
        console.warn("render() g: " + glyph );
        console.warn("render() s: " + scope );
        console.warn("render() m: " + model );

        var ep = Object.create(ExportController.prototype)
          , svg = getSVG(element)
          , _getLayerGenerator = getLayerGenerator.bind(null, ep, svg, model, glyph)
          , layers = [
              _getLayerGenerator('outline', 
                                 ExportController.renderPenstrokeOutline.bind( null, {} ))
              , _getLayerGenerator('centerline', 
                                   ExportController.renderPenstrokeCenterline.bind( null, {} ))
            ]
          ;
        
        function layerCtrl() {
            // execute
            var done = layers.map(iterateGenerator);
            // remove finished generators
            layers = layers.filter(function(item, i){return !done[i];});
            if(layers.length)
                scope.timeoutId = setTimeout(layerCtrl, 0);
        }
        if(scope.timeoutId)
            clearTimeout(scope.timeoutId);
        scope.timeoutId = setTimeout(layerCtrl, 0);
    }
    
    function redPillGlyphDirective(model) {
        function link(scope, element, attrs) {
            render(scope, element, scope.mtkGlyphElement, model);
            scope.$on('cpsUpdate', render.bind(null, scope, element, scope.mtkGlyphElement, model));
            element.on('$destroy', function() {
                clearTimeout(scope.timeoutId);
            });
        }
        return {
            restrict: 'E'
          , link: link
          , scope: { mtkGlyphElement: '=' }
        };
    }
    
    redPillGlyphDirective.$inject = ['ModelController'];
    return redPillGlyphDirective;
});
