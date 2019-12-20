

console.log("Extension is loaded....");

var $LITjq;

var LIT = {
    waitForJqueryUI : function(){
        if(typeof jQuery !== 'undefined' && typeof jQuery.fn.jquery !== 'undefined' && typeof jQuery.ui !== 'undefined'){
            $LITjq = jQuery.noConflict(true);
            jQuery= $ = $LITjq.noConflict(true);
            LIT.main();
        }
        else{
            console.log("jQuery UI not loaded...");
            window.setTimeout(LIT.waitForJqueryUI, 500);
        }
    },
    html : `
    <div id='LITWindow' class='LIT-window'> 
        <div id='LITMinWindow' class='LIT-show'>
            <button class="LIT-button">Open LinkedIn Tool <i class="fa fa-expand" aria-hidden="true" ></i></button>
            <span class="LIT-button LIT-WindowDragHandle">
                <i class="fa fa-arrows-alt" aria-hidden="true" ></i> 
            </span>
        </div>
        <div id='LITMaxWindow' class='LIT-hide'>
            <p>First name: <input data-bind='value: firstName' /></p> 
            <p>Last name: <input data-bind='value: lastName' /></p> 
            <h2>Hello, <span data-bind='text: fullName'> </span>!</h2>  
        </div>  
    </div>
    `,
    minWindow : function(){
        
    },
    maxWindow : function(){

    },
    setDraggable : function(){
        console.log("Jquery Version : " + $.fn.jquery);
        console.log("Jquery UI Version : " + $.ui.version);

        $LITjq('#LITWindow').draggable(
            {
                scroll: false,
                containment : "window",
                handle: '.LIT-WindowDragHandle'
            }
        );

    },
    addHolder : function(){
        /*
        // append to body
        var div = document.createElement('div');
        div.setAttribute("id", "LITHolder");
        div.innerHTML = LIT.html;
        document.body.append(div);
        */
       $LITjq( "body" ).append(LIT.html);
    },
    getHolder : function(){

    },
    knockoutBind : function(){
        // Here's my data model
        var ViewModel = function(first, last) {
            this.firstName = ko.observable(first);
            this.lastName = ko.observable(last);
        
            this.fullName = ko.computed(function() {
                // Knockout tracks dependencies automatically. It knows that fullName depends on firstName and lastName, because these get called when evaluating fullName.
                return this.firstName() + " " + this.lastName();
            }, this);
        };
        
        ko.applyBindings(new ViewModel("Planet", "Earth")); // This makes Knockout get to work
    },
    main : function(){
        console.log("Loading main function");             
        LIT.addHolder();
        LIT.knockoutBind();
        LIT.setDraggable();
    }
}

LIT.waitForJqueryUI();