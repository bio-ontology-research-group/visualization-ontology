//constants

var MAXLEVEL = 1; //Constant that represents the Maximum number of levels to launch the query.
var CHILDTOSHOW = 3; //Constant that represents the Number of children to show.
var MAXCHARTOSHOW = 12; //Constant that represents the Number of characters in a label to show.

var labelType, useGradients, nativeTextSupport, animate;
var st;
var json;

(function() {
  var ua = navigator.userAgent,
      iStuff = ua.match(/iPhone/i) || ua.match(/iPad/i),
      typeOfCanvas = typeof HTMLCanvasElement,
      nativeCanvasSupport = (typeOfCanvas == 'object' || typeOfCanvas == 'function'),
      textSupport = nativeCanvasSupport 
        && (typeof document.createElement('canvas').getContext('2d').fillText == 'function');
  //I'm setting this based on the fact that ExCanvas provides text support for IE
  //and that as of today iPhone/iPad current text support is lame
  labelType = (!nativeCanvasSupport || (textSupport && !iStuff))? 'Native' : 'HTML';
  nativeTextSupport = labelType == 'Native';
  useGradients = nativeCanvasSupport;
  animate = !(iStuff || !nativeCanvasSupport);
})();

var Log = {
  elem: false,
  write: function(text){
    if (!this.elem)  
      this.elem = document.getElementById('log');
    this.elem.innerHTML = text;
    this.elem.style.left = (500 - this.elem.offsetWidth / 2) + 'px';
  }
};

/**
 * This function prints out recursevely the JSON structure.
 */
 function printJSON(node,level){
    if(typeof(node) === undefined){
        return;
    }
    var label = node.name;
    for(var i=0;i<level;i++){ label="\t"+label}
    console.log(label);
    $.each(node.children,function(index,child){
        printJSON(child,level+1);
    });
 }

/**
 *  This function provides the url to access the Aber OWL service.
 */
 function getAberOWLURLService(node){
    var url = "http://jagannath.pdn.cam.ac.uk/service/api/runQuery.groovy";
    //var ontology = "PATO";
    var ontology = "EFO";
    var direct = "true";
    var type = "subclass";
    var params="";
    if((node.label!=null)&&(node.label!=="˅˅˅")&&(node.label!=="˄˄˄")){
        var labels = "true";
        if(node.label.indexOf(" ")>0){
            node.label="'"+node.label+"'";
            node.label= node.label.replace(/ /g,"+");
        }
        params = "type="+type+"&query="+node.label+"&ontology="+ontology+"&labels="+labels+"&direct="+direct;
    }else{
        params = "type="+type+"&query="+decodeURIComponent(node.owlClass)+"&ontology="+ontology+"&direct"+direct;
    }
    console.log(url+"?"+params);
    return(url+"?"+params);
}; 

/**
 * This function provides the subclases of a particular node.
 */
function getSubclases(node){
    return($.getJSON(getAberOWLURLService(node)));
};

/**
 * Recursive function that provides a subtree of given node.
 */
function getRecursiveSubClasses(node,level){
    var root = null;
    var def = $.Deferred();
    root = buildNode(node,level);
    if(level>=MAXLEVEL){
        def.resolve(root);
        return(def.promise());
    }
    if(root!=null){  
        $.when(getSubclases(node)).then(function( jsonData, textStatus, jqXHR ) {
            var promises = []; 
            if((jsonData!=null)&&(typeof(jsonData)!=="undefined")){
                $.each(jsonData.result,function(index,child){
                    var promise = getRecursiveSubClasses(child,level+1);
                    promises.push(promise);
                });
                $.when.apply($,promises).then(function(){
                    if(arguments.length>0){
                        $.each(arguments, function(index,child){
                            if((child!=null)&&(typeof(child)!=="undefined")){
                                root.children.push(child);
                            }
                        });
                    }
                    def.resolve(root);
                });
            }
        });

    }
    return(def.promise());
};

/**
 * This function builds a node using provided data.
 */
function buildNode(data, level){
    var node = null
    if(data!=null){
        node = {};
        node["id"] = data.classURI;
        node["name"] = data.label;
        node["data"] = {};
        node.data["$owlClass"] = encodeURIComponent(data.owlClass);
        node.data["$level"] = MAXLEVEL - level;
        node["children"] = []; 
    //node = {"id": data.classURI,"name":data.label,"data":{"owlClass":data.owlClass},"children":[]};
    }
    return(node);
};

/**
 * This function gets the root of a tree. Basically it creates the root node using provided data. 
 */
function getRoot(owlClass,label){
    var root = null;
    if((owlClass!=null)&&(label!=null)){
        root = {};
        root["classURI"] = encodeURIComponent(owlClass);
        root["owlClass"] = encodeURIComponent(owlClass);
        root["label"] = label;
    }
    return(root);
};

/**
 * This function checks the node level.
 */ 
function checkLevel(node){
	if((node!=null)&&(typeof(node)!="undefined")){
		if((node.getData("level")!="undefined")&&(node.getData("level")<=MAXLEVEL)){
			var root = getRoot(node.id,node.name);
			$.when(getRecursiveSubClasses(root,0)).done(function(jsonTree){
                updateJSON(node,jsonTree);
                node.setData("level",MAXLEVEL);
			});	
		}
	}
};
/**
 * This function update the json structure.
 */
function updateJSON(node,data){
	if((data!=null)&&(data.children!=null)){  
		var object = $.parseJSON(json);  
        var path = getNodePath(node);
        if(typeof(path)!=="undefined"){      
            var nodeIndex = eval("object"+path);
            if((typeof(nodeIndex)!=="undefined")&&(Array.isArray(nodeIndex))){
            	nodeIndex.splice(0,nodeIndex.length);
                $.each(data.children,function(index,child){
                    nodeIndex.push(child); 
                    var nodeGraph = st.graph.getNode(child.id);
                    if(typeof(nodeGraph)!=="undefined"){
                    	nodeGraph.setData("level",child.data.$level); 
                    }                                      
            	});
            }
        }
        json = JSON.stringify(object);
        st.refresh();
    }
};       

/**
 * This function obtains the path of a given node in JSON.
 */
function getNodePath(node){
    var child = node;
    var parent = null;
    var path = ".children";
    if(node!=null){
        parent = node.getParents()[0];
        while(parent!=null){         
        	var pos = 0;
        	parent.eachSubnode(function(subNode){
        		if(child.id === subNode.id){
	            	path = ".children["+(pos)+"]"+path;
        		}
        		pos = pos + 1;
        	});   
        	child = parent;
    		parent = parent.getParents()[0];
        }
    }    
    return(path);
}; 

/**
 * This function clean the children array of a given node.
 */
function emptyChildren(children){
    if($.isArray(children)){
        while(children.length>0){
            children.pop();
        }
    }
    return(children);
};
                                    
function init(){
    //var owlClass = "<http://purl.obolibrary.org/obo/PATO_0000001>";
    //var label = "quality";
    var owlClass = "http://www.ebi.ac.uk/efo/EFO_0000001";
    var label = "experimental factor";
    var root = getRoot(owlClass,label);
    $.when(getRecursiveSubClasses(root,0)).done(function(jsonTree){
        json=JSON.stringify(jsonTree);      
        //Implement a node rendering function called 'nodeline' that plots a straight line
        //when contracting or expanding a subtree.
        $jit.ST.Plot.NodeTypes.implement({
            'nodeline': {
                'render': function(node, canvas, animating) {
                    if(animating === 'expand' || animating === 'contract') {   
                        var pos = node.pos.getc(true), nconfig = this.node, data = node.data;
                        var width  = nconfig.width, height = nconfig.height;
                        var algnPos = this.getAlignedPos(pos, width, height);
                        var ctx = canvas.getCtx(), ort = this.config.orientation;
                        ctx.beginPath();
                        if(ort == 'left' || ort == 'right') {
                            ctx.moveTo(algnPos.x, algnPos.y + height / 2);
                            ctx.lineTo(algnPos.x + width, algnPos.y + height / 2);
                        } else {
                            ctx.moveTo(algnPos.x + width / 2, algnPos.y);
                            ctx.lineTo(algnPos.x + width / 2, algnPos.y + height);
                        }
                        ctx.stroke();
                    }
                }                 
            }
                  
        });
        //init Spacetree
        //Create a new ST instance
        st = new $jit.ST({
            'injectInto': 'infovis',
            //set animation transition type
            transition: $jit.Trans.Quart.easeInOut,
            //set distance between node and its children
            levelDistance: 80,
            //set max levels to show. Useful when used with
            //the request method for requesting trees of specific depth
            levelsToShow: 1,
            //set node and edge styles
            //set overridable=true for styling individual
            //nodes or edges
            Node: {
                overridable: true,
                width: 80,
                height: 20,
                color:'#ccc'
            },
                
            onBeforeCompute: function(node){  
                if(typeof(node)!="undefined"){
                    Log.write("loading " + node.name);      
                }   
            },
                
            onAfterCompute: function(){
                Log.write("done");
            },                
            //This method is called on DOM label creation.
            //Use this method to add event handlers and styles to
            //your node.                
            onCreateLabel: function(label, node){     
                label.id = node.id;    
                label.innerHTML = node.name;  
                //We have to split the node's name     
                if(node.name.length>MAXCHARTOSHOW){
                    label.innerHTML = node.name.substr(0,MAXCHARTOSHOW)+"...";
                }

                label.onclick = function(){  
                    checkLevel(node);
                	st.onClick(node.id);           
                }; 
                //set label styles
                var style = label.style;
                style.color = '#333';
                style.fontSize = '0.8em';
                style.textAlign= 'center';
                style.width = '80px';
                style.height ='20px';              
            },
            //Add a request method for requesting on-demand json trees.   
            //This method gets called when a node  
            //is clicked and its subtree has a smaller depth  
            //than the one specified by the levelsToShow parameter.  
            //In that case a subtree is requested and is added to the dataset.  
            //This method is asynchronous, so you can make an Ajax request for that  
            //subtree and then handle it to the onComplete callback.  
            //Here we just use a client-side tree generator (the getTree function).  
            request: function(nodeId,level,onComplete){ 
                var node = st.graph.getNode(nodeId);    
                var subtree = $jit.json.getSubtree(eval('('+json+')'),nodeId);
                //console.log(level+"-->"+node.name+"-->"+node.selected+"-->"+subtree.children.length);
                if((node.selected)&&(subtree.children.length>0)){
                	if(subtree.children.length>CHILDTOSHOW){
                        var pos = 0;
                        $.each(subtree.children,function(index,child){
                            if(index==CHILDTOSHOW){
                                child.name="˅˅˅";
                                child.data["$min"] = CHILDTOSHOW;
                                child.data["$max"] = CHILDTOSHOW+CHILDTOSHOW;
                                child.children = emptyChildren(child.children);
                            }
                            if(index>CHILDTOSHOW){
                                subtree.children.splice(pos,1);
                                pos = pos - 1;                  
                            }
                            pos = pos + 1;
                        });               
                    }
                }
                if((node.selected)&&(subtree.children.length==0)&&((node.name==="˅˅˅")||(node.name==="˄˄˄"))){
                	var parent = node.getParents()[0];
                	st.select(parent.id);
                	parent.eachSubnode(function(child){
            			st.graph.removeNode(child.id);		
                    });
                    st.labels.clearLabels(); 
                    nodeId = parent.id;
                    subtree = $jit.json.getSubtree(eval('('+json+')'),nodeId);
                    //console.log(node.getData("min")+"-->"+node.getData("max"));
                    for(var posX=0, posY=0;posX < subtree.children.length;posX++,posY++){
                        if(node.getData("min") == posY){
                            subtree.children[posX].name="˄˄˄";
                            subtree.children[posX].data["$min"] = node.getData("min")-CHILDTOSHOW;
                            subtree.children[posX].data["$max"] = node.getData("min");
                            subtree.children[posX].children = emptyChildren(subtree.children[posX].children);
                        }
                        if(node.getData("max")+1 == posY){
                            subtree.children[posX].name = "˅˅˅";
                            subtree.children[posX].data["$min"]= node.getData("max");
                            subtree.children[posX].data["$max"] = node.getData("max")+CHILDTOSHOW;
                            subtree.children[posX].children = emptyChildren(subtree.children[posX].children);
                        }
                        if((posY<node.getData("min"))||(posY>(node.getData("max")+1))){
                            subtree.children.splice(posX,1); 
                            posX = posX - 1;
                        } 
                    	
            		}         

                }
                onComplete.onComplete(nodeId,subtree);
            },
            //This method is called right before plotting
            //a node. It's useful for changing an individual node
            //style properties before plotting it.
            //The data properties prefixed with a dollar
            //sign will override the global node style properties.
            onBeforePlotNode: function(node){
                //add some color to the nodes in the path between the
                //root node and the selected node.
                if ((node._depth%2) == 0) {
                    node.data.$color = '#f77';
                }
            }
    	});
	    //load json data
	    st.loadJSON(eval( '(' + json + ')' ));
	    //compute node positions and layout
	    st.compute();
	    //emulate a click on the root node.
	    st.onClick(st.root);
	    //end
	    //Add event handlers to switch spacetree orientation.
	    function get(id) {
	        return document.getElementById(id);  
	    };

	    var top = get('r-top'), 
	    left = get('r-left'), 
	    bottom = get('r-bottom'), 
	    right = get('r-right');
	    
	    function changeHandler() {
	        if(this.checked) {
	            top.disabled = bottom.disabled = right.disabled = left.disabled = true;
	            st.switchPosition(this.value, "animate", {
	                onComplete: function(){
	                    top.disabled = bottom.disabled = right.disabled = left.disabled = false;
	                }
	            });
	        }
	    };        
	    top.onchange = left.onchange = bottom.onchange = right.onchange = changeHandler;  
    	//end.
    });
}
