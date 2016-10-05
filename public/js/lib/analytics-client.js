// node-analytics: client
// https://github.com/andrao/node-analytics
// MIT License

// ==============
// CLIENT OPTIONS
// ==============
var na_obj = {
    ws_host:        location.hostname
  , ws_port:        8080                    // set to null if passing server object on server
  , click_class:    'na_click'
  , reach_class:    'na_reach'
  , read_class:     'na_read'
  , force_protocol: null                    // 'http' or 'https'
};

// ==============
// APPLICATION
// ==============

var na_socket;
var na_pause = {};

(function(){
    // init: complete na_obj
    na_obj.reaches = document.getElementsByClassName(na_obj.reach_class);
    na_obj.reach_data = [];
    na_obj.pauses = document.getElementsByClassName(na_obj.read_class);
    na_obj.pause_data = [];
    
    // init: connect to websocket
    na_socket = socketConnect();
    function socketConnect(){
        var p = 'http';
        if(document.URL.indexOf('https://') > -1) p = 'https'
        if(na_obj.force_protocol) p = na_obj.force_protocol.toLowerCase();
        
        var url = p + '://' + na_obj.ws_host
        if(na_obj.ws_port) url += ':' + na_obj.ws_port;
        
        return io.connect(url);
    }
    
    // Calibration
    addEvent(window, 'resize', function(){
        na_obj_calibrate()
    });
    na_obj_calibrate();
    
    // resolution
    na_emit('resolution', { width: window.innerWidth, height: window.innerHeight })
    
    // clicks
    var links = document.getElementsByClassName(na_obj.click_class);
    for(var i = 0; i < links.length; i++){
        addEvent(links[i], 'click', function(){
            // has been clicked :: emit to server
            var id = this.id || 'click_link_' + i
            na_emit('click', id);
        });
    };
    
    // reaches && pauses :: check with every scroll
    addEvent(window, 'scroll', function(){
        var h = window.innerHeight
        
        var r_Y = window.scrollY + 0.75 * h;
        for(var i = 0; i < na_obj.reaches.length; i++){
            if(!na_obj.reach_data[i].past && r_Y > na_obj.reach_data[i].y){
                // has been reached :: emit to server
                var id = na_obj.reaches[i].id || 'reach_point_' + i;
                na_emit('reach', id)
                
                // set as passed; only send once
                na_obj.reach_data[i].past = true
            }
        }
        
        // pauses: start from bottom to find which we're in;
        var p_Y = window.scrollY + 0.5 * h
        
        for(var i = 0; i < na_obj.pauses.length; i++){
            var obj = na_obj.pauses[i]
            
            // activate :: entry || exit
            if((!na_pause.active ||
                 na_pause.active !== obj) &&
               p_Y > na_obj.pause_data[i].y_IN &&
               p_Y <= na_obj.pause_data[i].y_OUT){
                
                // emit last pause
                if(na_pause.active){
                    var id = na_pause.active.id || 'read_section_' + na_pause.index;
                    
                    if(na_pause.t > 0){
                        na_emit('pause', {
                            id:     id
                          , time:   parseFloat(na_pause.t.toFixed(1))
                        });
                    }
                }
                
                // prepare next pause
                na_pause.active = obj;
                na_pause.index = i;
                na_pause.t = 0;
                
                break;
            }
        }
    });
    
    // pauses: window focus
    addEvent(window, 'focus', function(){
        na_timer_start();
        na_emit('focus');
    })
    addEvent(window, 'blur', function(){
        clearInterval(na_pause.timer);
        na_emit('blur');
    })
    
    function addEvent(obj, type, fn){
        // John Resig's addEvent : http://ejohn.org/projects/flexible-javascript-events/
        if(obj.attachEvent){
            obj['e' + type + fn] = fn;
            obj[type + fn] = function(){
                obj['e' + type + fn]( window.event );
            }
            obj.attachEvent('on' + type, obj[type + fn]);
        }
        else obj.addEventListener(type, fn);
    }
})();

function na_timer_start(){
    na_pause.timer = setInterval(function(){
        if(!na_pause.t) na_pause.t = 0;
        na_pause.t += 0.1;
    }, 100);
}
function na_obj_calibrate(){
    // Set reach y-offset values; change with resizing
    for(var i = 0; i < na_obj.reaches.length; i++){
        var y = getOffset(na_obj.reaches[i])
        
        // create if yet instantiated
        if(!na_obj.reach_data[i]){
            na_obj.reach_data[i] = {
                y:      y
              , past:   false
            }
        }
        else na_obj.reach_data[i].y = y;
    };
    
    for(var i = 0; i < na_obj.pauses.length; i++){
        var ele = na_obj.pauses[i];
        var y = getOffset(ele);
        
        na_obj.pause_data[i] = {
            y_IN:   y
          , y_OUT:  y + ele.offsetHeight
        };
    };
    
    function getOffset(ele){
        var yOffset = ele.offsetTop;
        var parent = ele.parentNode;
        
        while(parent.parentNode){
            yOffset += parent.offsetTop;
            parent = parent.parentNode
        };
        
        return yOffset;
    }
}
function na_emit(service, data){
    na_socket.emit(service, data);
}