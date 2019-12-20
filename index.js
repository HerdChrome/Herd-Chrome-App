
/*
console.log("Extension is loaded....");
var LIT = {
    main : function(){
        console.log("Loading main function");  
        LIT.injectStyle("font-awesome-4.7.0/css/font-awesome.min.css") ;   
        LIT.injectStyle("index.css") ; 
        LIT.injectScript("jquery-1.12.4.js");
        LIT.injectScript("jquery-ui.js");
        LIT.injectScript("knockout-3.2.0.js");
        LIT.injectScript("web.js");          

    },
    injectStyle : function(file){
        var style = document.createElement('link');
        style.rel = 'stylesheet';
        style.type = 'text/css';
        style.href = chrome.extension.getURL(file);
        (document.head||document.documentElement).appendChild(style);
    },
    injectScript : function(file){
        var script = document.createElement('script');
        script.src = chrome.extension.getURL(file);
        (document.head || document.documentElement).appendChild(script);
    }

}

LIT.main();
*/


console.log("Extension is loaded....");

var $LITjq;

// DB API
function LITDB () {
    var self = this;
    self.db  = {};
    self.createDB = function(){
        self.db = openDatabase('litdb', '1.0', 'LIT DB', 2 * 1024 * 1024); 
        return self;
    };
    self.createTables = function(){
        self.db.transaction(function (tx) {   
            tx.executeSql('CREATE TABLE IF NOT EXISTS CONFIG ( key unique, value)'); 
            tx.executeSql('CREATE TABLE IF NOT EXISTS PROFILES (link , fname, lname, fullname, img,  title, company, phone, email, type, level, visitcount, position, lastview, speed, lastleadview, maxview, isconnected, isaccepted, lastmsgtime)'); 
         });
    };
    self.deleteTables = function(){
        self.db.transaction(function (tx) {   
            tx.executeSql('DROP TABLE IF EXISTS CONFIG'); 
            tx.executeSql('DROP TABLE IF EXISTS PROFILES'); 
         });
    },
    self.executeSql = function(query,params){
        params = params ? params : [];
        return new Promise(function(success,fail){
            self.db.transaction(function (tx) { 
                tx.executeSql(query, params, function (tx, results) { 
                   success(results); 
                }, function (tx, err) {
                    // couldn't read database
                    fail(err);
                }); 
             });
        });
    }
}

// Message Listner
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {      
      console.log(request);
      if(request.type == 'refresh')
      {
          LIT.refresh();              
      }
      if(request.type == 'pipelineToLead'){
        console.log(request);
        LIT.extractContactDetails(request.id);  
      }
      if(request.type == "updateVisit")
      {
        LIT.updateVisit(request.id);  
      }
    });

// Namespace for Our APP
var LIT = {
    db:{},
    demo: true,
    getConfig : function(){
        return {
            url : '', // leave it as empty
            pipelineLength : 10, // set the limit
            pipelineToLeadPerDay : 5, // set the limit
            profileViewTime: 1000*15*1, // 1 minutes
            pipelineViewTime: 1000*15, // 15 seconds
            today:'', // leave it as empty
            todayProfileViewCount : 0, // leave it as 0
            pipelineCount : 0,
            msgHead : '',
            msgBody : ''
        };
    },
    getAutoLoadCheck: function(){
        return  {
            pipeline : false,
            lead : false,
            config : false,
            maintenance : false,
            droped : false
        };
    },
    autoLoadCheck: {},
    config: {},
    VM:{},
    refresh : function(){
        LIT.autoLoadCheck = LIT.getAutoLoadCheck();
        LIT.pullData();
        LIT.doAutoView(); 
    },
    injectStyle: function (file) {
        var style = document.createElement('link');
        style.rel = 'stylesheet';
        style.type = 'text/css';
        style.href = chrome.extension.getURL(file);
        (document.head || document.documentElement).appendChild(style);
    },
    injectScript: function (file) {
        var script = document.createElement('script');
        script.src = chrome.extension.getURL(file);
        (document.head || document.documentElement).appendChild(script);
    },
    waitForElement: function(selector) {
        return new Promise(function (res, rej) {
            waitForElementToDisplay(selector, 200);
            function waitForElementToDisplay(selector, time) {
                if (document.querySelector(selector) != null) {
                    res(document.querySelector(selector));
                }
                else {
                    setTimeout(function () {
                        waitForElementToDisplay(selector, time);
                    }, time);
                }
            }
        });
    },
    waitForDataLoad : function(){
        return new Promise(function(res,rej){
            waitForDataToLoad(200);
            function waitForDataToLoad (time){
                if(LIT.autoLoadCheck.config == true && 
                    LIT.autoLoadCheck.profile ==true &&
                    LIT.autoLoadCheck.lead == true &&
                    LIT.autoLoadCheck.droped == true
                    ){
                        res();
                }
                else{
                    setTimeout(function () {
                        waitForDataToLoad(time);
                    }, time);
                }
            }           
        });
    },
    waitForJqueryUI: function () {
        if (typeof jQuery !== 'undefined' && typeof jQuery.fn.jquery !== 'undefined' && typeof jQuery.ui !== 'undefined') {
            $LITjq = jQuery.noConflict(true);
            jQuery = $ = $LITjq.noConflict(true);
            LIT.main();
        }
        else {
            console.log("jQuery UI not loaded...");
            window.setTimeout(LIT.waitForJqueryUI, 500);
        }
    },
    html: `
    <div id='LITWindow' class='LIT-window LIT-Window-Min'> 
        <div id='LITMinWindow' class='LIT-show'>
            <button id="LIT-open" class="LIT-button">Open LinkedIn Tool <i class="fa fa-expand" aria-hidden="true" ></i></button>
            <span class="LIT-button LIT-WindowDragHandle">
                <i class="fa fa-arrows-alt" aria-hidden="true" ></i> 
            </span>
        </div>
        <div id='LITMaxWindow' class='LIT-hide'>
            <div class="LIT-TitleBar">
                <span class="LIT-Float-Left">
                LinkedIn Tool
                </span>
                <span class="LIT-button LIT-WindowDragHandle LIT-Float-Right">
                    <i class="fa fa-arrows-alt" aria-hidden="true" ></i> 
                </span>
                <button id="LIT-close" class="LIT-button LIT-Float-Right">
                    <i class="fa fa-compress" aria-hidden="true" ></i> 
                </button>
            </div>
            <div class="LIT-tab" data-bind="foreach: tabs">
                <button  data-bind="text: $data, 
                css: { active : $data == $root.chosenTabId() },
                click: $root.goToTab">
                </button>
            </div>
            <div class="LIT-tabcontent">
                <div data-bind="if: chosenTabId() === 'Dashboard'">
                    <div>
                        <table class="LIT-table">                          
                            <tr>
                                <td>Add New Pipeline</td>
                                <td>
                                    <span>
                                        <span class="LIT-button LIT-importButton"  data-bind="click: addNewPipeline">
                                            <i class="fa fa-plus" aria-hidden="true" ></i> 
                                        </span>
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td>Message Subject Template</td>
                                <td>
                                <input type="text" data-bind="value: msgHead">
                                <span>
                                        <span class="LIT-button LIT-importButton"  data-bind="click: saveMsgHead">
                                            <i class="fa fa-save" aria-hidden="true" ></i> 
                                        </span>
                                </span>
                                
                                </td>
                            </tr>
                            <tr>
                                <td>Message Body Template</td>
                                <td>
                                <textarea rows="4" cols="20" data-bind="value: msgBody">
                                
                                </textarea>
                                <span>
                                        <span class="LIT-button LIT-importButton"  data-bind="click: saveMsgBody">
                                            <i class="fa fa-save" aria-hidden="true" ></i> 
                                        </span>
                                </span>
                                </td>
                            </tr>
                            <tr>
                                <td>Trigger Auto View</td>
                                <td>
                                    <span>
                                        <span class="LIT-button LIT-importButton"  data-bind="click: triggerAutoView">
                                            <i class="fa fa-cogs" aria-hidden="true" ></i> 
                                        </span>
                                    </span>
                                </td>
                            </tr>                           
                            <tr>
                                <td>Reset All</td>
                                <td>
                                    <span>
                                        <span class="LIT-button LIT-importButton LIT-RedButton"  data-bind="click: resetAll">
                                            <i class="fa fa-trash" aria-hidden="true" ></i> 
                                        </span>
                                    </span>
                                </td>
                            </tr>
                            
                        </table>    
                    </div>
                </div>
                <div data-bind="if: chosenTabId() === 'Pipeline'">
                    <div>
                        <table class="LIT-table">
                            <tr>
                                <td>
                                    <span>URL</span>
                                
                                    <span class="LIT-button LIT-Float-Right LIT-align-openurlbutton">
                                        <i class="fa " 
                                        data-bind="
                                        css: { 
                                            'fa-external-link' : searchURL().length > 0  , 
                                            'fa-arrow-down' : searchURL().length == 0
                                        },
                                        click: copyAndOpenURL"
                                        aria-hidden="true" ></i> 
                                    </span>
                                </td>
                                <td><input type="text" id="pipelineURL" name="pipelineURL" class="LIN-input" data-bind="value: searchURL"></td>
                            </tr>
                            <tr>
                                <td>Status</td>
                                <td> <span data-bind="text: pipelineStatus"></span> </td>
                            </tr>
                            <tr>
                                <td>Collected Count</td>
                                <td><span data-bind="text: profileCount"></span></td>
                            </tr>   
                            <tr>
                                <td>Action</td>
                                <td>
                                    <span data-bind="
                                    css: { 
                                        'LIT-hide' : searchURL().length == 0,
                                        'LIT-show' : searchURL().length > 0
                                    }">
                                        <span class="LIT-button LIT-importButton"  data-bind="click: addPipeline">
                                            <i class="fa " data-bind="
                                            css: { 
                                                'fa-refresh' : (isCollectingProfile() === true)  ,
                                                'fa-spin' : (isCollectingProfile() === true ) ,
                                                'fa-arrow-down' : (isCollectingProfile() === false)
                                            }"
                                            aria-hidden="true" ></i> 
                                        </span>
                                    </span>
                                </td>
                            </tr>
                        </table>    
                    </div>
                    <div data-bind="foreach: profiles()">
                        <span data-bind="text: $parent.profiles()[$index()].company , visible: $index() === 0 || ($parent.profiles()[$index()].company != $parent.profiles()[$index()-1].company)" class="LIT-card-companyname"></span>
                        <div class="LIT-card">
                            <img data-bind="attr: { src: $root.getImage($data.img) }" class="LIT-img" alt="Avatar">
                            <div class="LIT-card-container">
                                <b><a class="LIT-medium-font" data-bind="text: ($data.fname +' '+ $data.lname) , attr: { href: $data.link }"></a></b>
                                <br><br>
                                <span class="LIT-small-font" data-bind="text: ($data.title + ' @ '+ $data.company)"></span> 
                                <br>
                            </div>
                        </div>   
                            
                    </div>
                </div>

                <div data-bind="if: chosenTabId() === 'Lead'">
                    <div>
                        <table class="LIT-table">
                            <tr>
                                <td>Status</td>
                                <td> <span data-bind="text: leadStatus"></span> </td>
                            </tr>
                            <tr>
                                <td>Collected Count</td>
                                <td><span data-bind="text: leadCount"></span></td>
                            </tr>   
                            <tr>
                                <td>Action</td>
                                <td>
                                    <span data-bind="
                                    css: { 
                                        'LIT-hide' : profileCount() == 0,
                                        'LIT-show' : profileCount() > 0
                                    }">
                                        <span class="LIT-button LIT-importButton"  data-bind="click: importLead">
                                            <i class="fa " data-bind="
                                            css: { 
                                                'fa-refresh' : (isCollectingLead() === true)  ,
                                                'fa-spin' : (isCollectingLead() === true ) ,
                                                'fa-arrow-down' : (isCollectingLead() === false)
                                            }"
                                            aria-hidden="true" ></i> 
                                        </span>
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td>E-Mail</td>
                                <td>
                                    <label class="LIT-switch">
                                        <input type="checkbox" data-bind="checked: showLevelEmail">
                                        <span class="LIT-slider round"></span>
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <td>Phone</td>
                                <td>
                                    <label class="LIT-switch">
                                        <input type="checkbox" data-bind="checked: showLevelPhone">
                                        <span class="LIT-slider round"></span>
                                    </label>
                                </td>
                            </tr>
                        </table>    
                    </div>
                    <div data-bind="foreach: leads()">
                        <div class="LIT-card " data-bind="
                        css: { 
                            'LIT-hide' :  $root.showLevel() != $data.level,
                            'LIT-show' :  $root.showLevel() == $data.level
                        }">
                            <img data-bind="attr: { src: $root.getImage($data.img) }" class="LIT-img" alt="Avatar">
                            <div class="LIT-card-container">
                                <b><a class="LIT-medium-font" data-bind="text: ($data.fname +' '+ $data.lname) , attr: { href: $data.link }"></a></b>
                                <br><br>
                                <span class="LIT-small-font" data-bind="text: ($data.title + ' / '+ $data.company)"></span> 
                                <br>
                            </div>
                            <div class="LIT-card-button-container">
                                <span class="LIT-button LIT-card-button" data-bind="click: $root.moveToMaintenance">
                                    <i class="fa fa-handshake-o" aria-hidden="true" ></i> 
                                </span>
                                <span class="LIT-button LIT-card-button" data-bind="click: $root.tryAgain">
                                    <i class="fa fa-level-down" aria-hidden="true" ></i> 
                                </span>
                                <span class="LIT-button LIT-card-button" data-bind="click: $root.dropProfile">
                                    <i class="fa fa-trash" aria-hidden="true" ></i> 
                                </span>
                            </div>
                        </div>        
                    </div>
                </div>
                
                <div data-bind="if: chosenTabId() === 'Maintenance'">
                    <div data-bind="foreach: maintenances()">
                        <span data-bind="text: $parent.maintenances()[$index()].company , visible: $index() === 0 || ($parent.maintenances()[$index()].company != $parent.maintenances()[$index()-1].company)" class="LIT-card-companyname"></span>
                        <div class="LIT-card">
                            <img data-bind="attr: { src: $root.getImage($data.img) }" class="LIT-img" alt="Avatar">
                            <div class="LIT-card-container">
                                <b><a class="LIT-medium-font" data-bind="text: ($data.fname +' '+ $data.lname) , attr: { href: $data.link }"></a></b>
                                <br><br>
                                <span class="LIT-small-font" data-bind="text: ($data.title + ' / '+ $data.company)"></span> 
                                <br>
                            </div>
                            <div class="LIT-card-button-container-maintenance">
                                <select class="LIT-dropdown" data-bind="options:  $root.availableSpeeds ,
                                value: $data.chosenSpeed , event:{ change: $root.changeSpeed}"></select>
                                <input class="LIT-dropdown" type="text" data-bind="value: $data.chosenView , event:{ change: $root.changeView}"></input>
                                <span class="LIT-dropdown" data-bind="text: $data.chosenViewPercentage "></span>
                            </div>
                        </div>        
                    </div>
                </div>

                <div data-bind="if: chosenTabId() === 'Dropped'">
                    <div data-bind="foreach: droped()">
                        <div class="LIT-card">
                            <img data-bind="attr: { src: $root.getImage($data.img) }" class="LIT-img" alt="Avatar">
                            <div class="LIT-card-container">
                                <b><a class="LIT-medium-font" data-bind="text: ($data.fname +' '+ $data.lname) , attr: { href: $data.link }"></a></b>
                                <br><br>
                                <span class="LIT-small-font" data-bind="text: ($data.title + ' / '+ $data.company)"></span> 
                                <br>
                            </div>
                            <div class="LIT-card-button-container">
                                <span class="LIT-button LIT-card-button" data-bind="click: $root.addBack">
                                    <i class="fa fa-plus" aria-hidden="true" ></i> 
                                </span>
                            </div>
                        </div>        
                    </div>
                </div>

                <div data-bind="if: chosenTabId() === 'Data'">
                    <div data-bind="foreach: allProfiles()">
                    <span data-bind="text: $parent.allProfiles()[$index()].company , visible: $index() === 0 || ($parent.allProfiles()[$index()].company != $parent.allProfiles()[$index()-1].company)" class="LIT-card-companyname"></span>
                        <div class="LIT-card">
                            <img data-bind="attr: { src: $root.getImage($data.img) }" class="LIT-img" alt="Avatar">
                            <div class="LIT-card-container">
                                <b><a class="LIT-medium-font" data-bind="text: ($data.fname +' '+ $data.lname) , attr: { href: $data.link }"></a></b>
                                <br><br>
                                <span class="LIT-small-font" data-bind="text: ($data.title + ' / '+ $data.company)"></span> 
                                <br>
                                <span class="LIT-small-font" data-bind="text: ($data.email + ' / '+ $data.phone)"></span>
                            </div>
                            <div class="LIT-card-button-container">
                                <span class="LIT-button LIT-card-button" data-bind="click: $root.addBack">
                                    <i class="fa fa-plus" aria-hidden="true" ></i> 
                                </span>
                            </div>
                        </div>        
                    </div>
                </div>

            </div>
        </div>
    </div>
    `,
    minWindow: function () {

    },
    maxWindow: function () {

    },
    eventRegistration: function () {
        $LITjq("#LIT-open").click(function () {

            $("#LITMinWindow").slideToggle("slow", function () {
                $LITjq("#LITWindow").removeClass("LIT-Window-Min").addClass("LIT-Window-Max");
                $("#LITMaxWindow").slideToggle("slow");
            });

        });

        $LITjq("#LIT-close").click(function () {

            $("#LITMaxWindow").slideToggle("slow", function () {
                $LITjq("#LITWindow").removeClass("LIT-Window-Max").addClass("LIT-Window-Min");
                $("#LITMinWindow").slideToggle("slow");
            });
        });
    },
    setDraggable: function () {
        console.log("Jquery Version : " + $.fn.jquery);
        console.log("Jquery UI Version : " + $.ui.version);

        $LITjq('#LITWindow').draggable(
            {
                scroll: false,
                containment: "window",
                handle: '.LIT-WindowDragHandle'
            }
        );

    },
    addHolder: function () {
        /*
        // append to body
        var div = document.createElement('div');
        div.setAttribute("id", "LITHolder");
        div.innerHTML = LIT.html;
        document.body.append(div);
        */
        $LITjq("body").append(LIT.html);
    },
    getHolder: function () {

    },
    knockoutBind: function () {
        /*
        // Here's my data model
        var ViewModel = function(first, last) {
            this.firstName = ko.observable(first);
            this.lastName = ko.observable(last);
        
            this.fullName = ko.computed(function() {
                // Knockout tracks dependencies automatically. It knows that fullName depends on firstName and lastName, because these get called when evaluating fullName.
                return this.firstName() + " " + this.lastName();
            }, this);
        };
        */
        LIT.VM = new LITViewModel();
        ko.applyBindings(LIT.VM); // This makes Knockout get to work
    },
    syncConfig : function(){
        LIT.db.executeSql('SELECT COUNT(*) rowid FROM CONFIG ').then((r)=>{
            var NoOfRows = r.rows.item(0).rowid;
            if(NoOfRows){
                // Get Config
                LIT.db.executeSql('SELECT key , value FROM CONFIG').then((r)=>{
                    //console.log(r);
                    var count = r.rows.length;    
                    for(var k =0; k< count;k++){
                        var v = r.rows.item(k);
                        LIT.config[v.key] = v.value;
                    }
                    //console.log(LIT.config);
                    LIT.VM.setConfig();
                });
            }
            else{
                // set Config
                for (var k in LIT.config){
                    if (LIT.config.hasOwnProperty(k)) {
                          LIT.db.executeSql('INSERT INTO CONFIG ( key , value) VALUES (?,?)',[k,LIT.config[k]]);
                    }
                }
                LIT.VM.setConfig();
            }
        });
    },
    appendToProfileList : function(rows){
        var count=rows.length;
        var total  = LIT.VM.profiles().length + LIT.VM.leads().length +  LIT.VM.maintenances().length +  LIT.VM.droped().length;
        if(!LIT.config.pipelineCount)LIT.config.pipelineCount =1;
        var diff  = (LIT.config.pipelineLength * LIT.config.pipelineCount) - total ;
        count = ((diff <= 0) ? 0 : ((diff > count)? count: diff)) ;
        if(count == 0)
        {
            LIT.pullData();return;
        }
        for(var k=0; k < count ; k++){
            var row =rows[k];
            LIT.db.executeSql('INSERT INTO PROFILES ( link, fname, lname, fullname, img,  title, company, phone, email, type, level, visitcount, position, lastview, speed , lastleadview, maxview, isconnected, isaccepted, lastmsgtime) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                row.link,
                row.fname,
                row.lname,
                row.fullName,
                row.img,
                row.title,
                row.company,
                '',
                '',
                'pipeline',
                0,
                0,
                (new Date).getTime(),
                0,
                0,
                0,
                1,
                0,
                0,
                0
            ]).then(()=>{ 
                count--;
                if(!count){
                    LIT.autoLoadCheck.profile = false;
                    // Inserted all
                    LIT.pullProfiles();
                    // check and load more profile into pipeline
                    LIT.waitForDataLoad().then(()=>{
                        var total  = LIT.VM.profiles().length + LIT.VM.leads().length +  LIT.VM.maintenances().length +  LIT.VM.droped().length;
                        if(total < (LIT.config.pipelineLength * LIT.config.pipelineCount)){
                            $('.artdeco-pagination__button--next').click(); // for normal
                            $('.search-results__pagination-next-button').click(); // for salse navigation                           
                            setTimeout(() => {
                                LIT.VM.importProfile();
                            }, 1000*5);
                        }
                    })
                }
            });
        }
    },
    tryAgain : function(id){
        LIT.db.executeSql("UPDATE PROFILES SET position= ? WHERE rowid=?",[(new Date).getTime(),id]).then(()=>{
            LIT.pullLeads();
        })        
    },
    dropProfile: function(id){
        LIT.db.executeSql("UPDATE PROFILES SET type=? WHERE rowid=?",["droped",id]).then(()=>{
            LIT.pullLeads();
            LIT.pullDroped();
        }) 
    },
    addBack: function(id){
        LIT.db.executeSql("UPDATE PROFILES SET type=? WHERE rowid=?",["lead",id]).then(()=>{
            LIT.pullLeads();
            LIT.pullDroped();
        })
    },
    moveToMaintenance : function(id){
        LIT.db.executeSql("UPDATE PROFILES SET type=? WHERE rowid=?",["maintenance",id]).then(()=>{
            LIT.pullLeads();
            LIT.pullMaintenance();
        })
    },
    changeSpeed : function(id,speed){
        LIT.db.executeSql("UPDATE PROFILES SET speed=? WHERE rowid=?",[speed,id]).then(()=>{
        })
    },
    changeView : function(id, view){
        LIT.db.executeSql("UPDATE PROFILES SET maxview=? WHERE rowid=?",[view,id]).then(()=>{
        })
    },
    pullData : function(){
        LIT.syncConfig();
        LIT.pullAllProfiles();
        LIT.pullProfiles();
        LIT.pullLeads();
        LIT.pullDroped();
        LIT.pullMaintenance();
    },
    pullAllProfiles : function(){
        LIT.db.executeSql("SELECT rowid, * FROM PROFILES ORDER BY company ASC , position ASC").then((r)=>{
            var profiles = [];
            var count = r.rows.length;
            for(var k=0; k< count; k++){
                profiles.push(r.rows.item(k));
            }
            LIT.VM.loadAllProfiles(profiles);
        });
    },
    pullProfiles : function(){
        LIT.db.executeSql("SELECT rowid, * FROM PROFILES WHERE type='pipeline' ORDER BY company ASC , position ASC").then((r)=>{
            var profiles = [];
            var count = r.rows.length;
            for(var k=0; k< count; k++){
                profiles.push(r.rows.item(k));
            }
            LIT.VM.loadProfiles(profiles);
        });
    },
    pullLeads : function(){
        LIT.db.executeSql("SELECT rowid, * FROM PROFILES WHERE type='lead' ORDER BY position ASC").then((r)=>{
            var leads = [];
            var count = r.rows.length;
            for(var k=0; k< count; k++){
                leads.push(r.rows.item(k));
            }
            LIT.VM.loadLeads(leads);
        });
    },
    pullMaintenance : function(){
        LIT.db.executeSql("SELECT rowid, * FROM PROFILES WHERE type='maintenance' ORDER BY position ASC").then((r)=>{
            var leads = [];
            var count = r.rows.length;
            for(var k=0; k< count; k++){
                leads.push(r.rows.item(k));
            }
            LIT.VM.loadMaintenances(leads);
        });
    },
    pullDroped : function(){
        LIT.db.executeSql("SELECT rowid, * FROM PROFILES WHERE type='droped' ORDER BY position ASC").then((r)=>{
            var droped = [];
            var count = r.rows.length;
            for(var k=0; k< count; k++){
                droped.push(r.rows.item(k));
            }
            LIT.VM.loadDroped(droped);
        });
    },
    importNextLead : function(){
        var profiles = LIT.VM.profiles();
        var profile = {}
        if(profiles.length > 0)
        {
            profile = profiles[0];
        }
        console.log("Profile to Lead :");
        chrome.runtime.sendMessage({type: 'iAmMain'});
        var msg = {id: profile.rowid, link : profile.link, type: 'getLead'};
        console.log(msg);
        chrome.runtime.sendMessage(msg);
    },
    doAutoView : function(){ // Pipeline auto view
        LIT.waitForDataLoad().then(()=>{
            console.log("todayProfileViewCount : "+ LIT.config.todayProfileViewCount);
            console.log("today : "+ LIT.config.today);

            if(LIT.config.pipelineToLeadPerDay == LIT.config.todayProfileViewCount ){
                 chrome.runtime.sendMessage({type: 'notify', name: 'reachedLimit'});
                 LIT.doAutoView2();
                 return;
            }
            if(LIT.VM.profiles().length == 0){
                chrome.runtime.sendMessage({type: 'notify', name: 'emptyPipeline'});
                LIT.doAutoView2();
                return;
            }
            if(LIT.config.today == LIT.getDate() &&LIT.config.pipelineToLeadPerDay > LIT.config.todayProfileViewCount)
            {
                LIT.importNextLead(); return;
            }
            if(LIT.config.today != LIT.getDate()){
                LIT.importNextLead(); return;
            }

        })        
    },
    doAutoView2 : function(){ // Maintenance auto view
        LIT.waitForDataLoad().then(()=>{
            var profiles = LIT.VM.maintenances();
            for(var i=0;i<profiles.length;i++){
                var profile = profiles[i];
                var d = 0;
                if(profile.lastview ==0){
                    // visit it
                    var msg = {id: profile.rowid, link : profile.link, type: 'simplyView' };
                    console.log(msg);
                    chrome.runtime.sendMessage(msg);
                    return;
                }
                if(profile.speed == '0x' || profile.speed == '0') return;
                if(profile.speed == '1x')
                    d = 1000 * 60 * 60 * 24 * (7/1); 
                if(profile.speed == '2x')
                    d = 1000 * 60 * 60 * 24 * (7/2);                     
                if(profile.speed == '3x')
                    d = 1000 * 60 * 60 * 24 * (7/3); 

                var t = (new Date).getTime();
                if(t > profile.lastview + d )
                {
                    // visit it
                    var msg = {id: profile.rowid, link : profile.link, type: 'simplyView' };
                    console.log(msg);
                    chrome.runtime.sendMessage(msg);
                    return;
                }                
            }
            LIT.doAutoView3();
            
        })
    },
    doAutoView3 : function(){ // Lead auto view
        LIT.waitForDataLoad().then(()=>{
            var profiles = LIT.VM.leads();
            for(var i=0;i<profiles.length;i++){
                var profile = profiles[i];
                if(profile.lastleadview ==0){
                    // visit it
                    var msg = {id: profile.rowid, link : profile.link, type: 'simplyView' };
                    console.log(msg);
                    chrome.runtime.sendMessage(msg);
                    return;
                }
                var d = 1000 * 60 * 60 * 24 * (7/1); 
                var t = (new Date).getTime();
                if(t > profile.lastleadview + d )
                {
                    // visit it
                    var msg = {id: profile.rowid, link : profile.link, type: 'simplyView' };
                    console.log(msg);
                    chrome.runtime.sendMessage(msg);
                    return;
                }                
            }
            LIT.doAutoView4();
        })
    },
    doAutoView4 : function(){ // Drop auto view
        LIT.waitForDataLoad().then(()=>{
            var profiles = LIT.VM.droped();
            for(var i=0;i<profiles.length;i++){
                var profile = profiles[i];
                if(profile.lastview ==0){
                    // visit it
                    var msg = {id: profile.rowid, link : profile.link, type: 'simplyView' };
                    console.log(msg);
                    chrome.runtime.sendMessage(msg);
                    return;
                }
                var d = 1000 * 60 * 60 * 24 * (7/1); 
                var t = (new Date).getTime();
                if(t > profile.lastview + d )
                {
                    // visit it
                    var msg = {id: profile.rowid, link : profile.link, type: 'simplyView' };
                    console.log(msg);
                    chrome.runtime.sendMessage(msg);
                    return;
                }                
            }
            
        })
    },
    extractContactDetails : function(id){
        console.log("extractContactDetails");
        LIT.waitForElement('#pv-contact-info').then((e)=>{
            var temp = $('.ci-phone').text().match(/\d/g);
            var phone = Array.isArray(temp)? temp.join('') : '' ;
            var email = $('.ci-email').text().replace('Email','').trim();
            LIT.movePipelineToLead(id,phone,email);
        });
        // for Salse Navigation
        if(window.location.pathname.startsWith("/sales/people/")) 
        {
            LIT.movePipelineToLead(id,'','');
        }
           
        
    },
    childDone : function(){
        LIT.autoLoadCheck.config = false;
        LIT.syncConfig();
        LIT.waitForDataLoad().then(()=>{
            chrome.runtime.sendMessage({type: 'childDone'}); 
        });
    },    
    movePipelineToLead : function(id,phone,email){
        console.log("movePipelineToLead");
        var level = 0;
        level =  ((phone.length > 2) ? 1 : level);
        level =  ((email.length > 2) ? 2 : level);
        level =  ((email.length > 2  && phone.length > 2) ? 3 : level);
        
        // UPDATE CONFIG SET value='' WHERE key='today'
        // UPDATE CONFIG SET value=0 WHERE key='todayProfileViewCount'
        LIT.db.executeSql("UPDATE PROFILES SET type='lead', phone=?, email=? , visitcount=1 , level=?  , lastleadview=?  WHERE rowid=?",[phone,email,level,(new Date).getTime(),id]).then((r)=>{
            if(LIT.config.today != LIT.getDate())
            {
                LIT.db.executeSql("UPDATE CONFIG SET value= ? WHERE key=?",[LIT.getDate(),'today']).then(()=>{
                    LIT.db.executeSql("UPDATE CONFIG SET value= ? WHERE key=?",[1,'todayProfileViewCount']).then(()=>{
                        
                        chrome.runtime.sendMessage({type: 'notify', name: 'contact',email: email, phone : phone});
                        LIT.childDone();
                        
                    })
                }) 
            }
            else{
                LIT.db.executeSql("UPDATE CONFIG SET value= ? WHERE key=?",[LIT.config.todayProfileViewCount +1,'todayProfileViewCount']).then((r)=>{
                        
                    chrome.runtime.sendMessage({type: 'notify', name: 'contact',email: email, phone : phone});
                    LIT.childDone();
                        
                })
            }                       
        });        
    },
    updateVisit : function(id){
        setTimeout(() => {
            
            LIT.db.executeSql("SELECT rowid, * FROM PROFILES WHERE rowid=?",[id]).then((r)=>{
                var count = r.rows.length;
                var profile;
                if(count > 0)
                {
                    profile = r.rows.item(0);
                    profile.visitcount = profile.visitcount + 1;
                    if(profile.type == "maintenance" && profile.isconnected){
                        LIT.db.executeSql("UPDATE PROFILES SET visitcount=? , lastview=? WHERE rowid=?",[profile.visitcount,(new Date).getTime(),id]).then((r)=>{
                            chrome.runtime.sendMessage({type: 'notify', name: 'autoView'});
                            LIT.childDone();
                        })
                    }
                    if(profile.type == "maintenance" && !profile.isconnected){                        
                        // for salse
                        if(window.location.pathname.startsWith("/sales/people/")) {
                            LIT.slaseConnect(profile,id)
                        }
                        else{// for normal
                            LIT.normalConnect(profile,id)
                        }                        
                    }
                    if(profile.type == "droped" && profile.isconnected){
                        // for salse
                        if(window.location.pathname.startsWith("/sales/people/")) {
                            LIT.salseMsg(profile,id)
                        }
                        else{// for normal

                        }
                    }
                    if(profile.type == "droped" && !profile.isconnected){
                        // for salse
                        if(window.location.pathname.startsWith("/sales/people/")) {
                            LIT.slaseConnect(profile,id)
                        }
                        else{// for normal
                            LIT.normalConnect(profile,id)
                        }               
                    }
                    if(profile.type == "lead"){
                        LIT.db.executeSql("UPDATE PROFILES SET visitcount=? , lastleadview=? WHERE rowid=?",[profile.visitcount,(new Date).getTime(),id]).then((r)=>{
                            chrome.runtime.sendMessage({type: 'notify', name: 'autoView'});
                            LIT.childDone();
                        })
                    }
                }
            });
        }, LIT.config.profileViewTime);
    },
    normalConnect : function(profile,id){        
        if($('.pv-s-profile-actions--connect').length){
            $('.pv-s-profile-actions--connect').click();
            LIT.waitForElement('.send-invite__actions').then(()=>{
                $('.send-invite__actions').find('button')[1].click();

                LIT.db.executeSql("UPDATE PROFILES SET visitcount=? , lastview=? , isconnected=1 WHERE rowid=?",[profile.visitcount,(new Date).getTime(),id]).then((r)=>{
                    chrome.runtime.sendMessage({type: 'notify', name: 'connect'});
                    LIT.childDone();
                })
            });            
        }
        else{
            LIT.db.executeSql("UPDATE PROFILES SET visitcount=? , lastview=? , isconnected=1 WHERE rowid=?",[profile.visitcount,(new Date).getTime(),id]).then((r)=>{
                chrome.runtime.sendMessage({type: 'notify', name: 'connect'});
                LIT.childDone();
            })
        }
    },
    slaseConnect : function(profile,id){
        LIT.waitForElement('.profile-topcard__right-column').then(()=>{
            if(LIT.triggerConnect())
            {
                LIT.waitForElement('.connect-cta-form__send').then(()=>{
                    if(!LIT.demo)
                    {
                        $('.connect-cta-form__send').click();
                    }
                    LIT.db.executeSql("UPDATE PROFILES SET visitcount=? , lastview=? , isconnected=1 WHERE rowid=?",[profile.visitcount,(new Date).getTime(),id]).then((r)=>{
                        chrome.runtime.sendMessage({type: 'notify', name: 'connect'});
                        LIT.childDone();
                    })                              
                });
            }
            else{
                    LIT.db.executeSql("UPDATE PROFILES SET visitcount=? , lastview=? , isconnected=1 WHERE rowid=?",[profile.visitcount,(new Date).getTime(),id]).then((r)=>{
                    chrome.runtime.sendMessage({type: 'notify', name: 'connect'});
                    LIT.childDone();
                }) 
            }
        });
    },
    salseMsg : function(profile,id){
        LIT.waitForElement('.profile-topcard__right-column').then(()=>{
            if(!LIT.isPendingConnection()){
                var msgHead = LIT.formateMsg(LIT.config.msgHead, profile);
                var msgBody = LIT.formateMsg(LIT.config.msgBody, profile);
                LIT.openMessageComposer();
                LIT.waitForElement('.compose-form__container').then(()=>{
                    LIT.updateMessageComposer(msgHead,msgBody);
                    setTimeout(() => {
                        LIT.db.executeSql("UPDATE PROFILES SET visitcount=? , lastview=? WHERE rowid=?",[profile.visitcount,(new Date).getTime(),id]).then((r)=>{
                            chrome.runtime.sendMessage({type: 'notify', name: 'sentMsg'});
                            LIT.childDone();
                        })
                    }, 10000);                                    
                });
            }
            else{
                LIT.db.executeSql("UPDATE PROFILES SET visitcount=? , lastview=? WHERE rowid=?",[profile.visitcount,(new Date).getTime(),id]).then((r)=>{
                    chrome.runtime.sendMessage({type: 'notify', name: 'autoView'});
                    LIT.childDone();
                })
            }
            
        });
    },
    formateMsg : function(msg,profile){
        var out = msg;
        // replace first name
        out = out.split("<fname>").join(profile.fname);
        // replace last name
        out = out.split("<lname>").join(profile.lname);
        // replace title
        out = out.split("<title>").join(profile.title);
        // replace company name
        out = out.split("<company>").join(profile.company);
        return out;
    },
    getDate : function(){
            var today = new Date();
            var dd = String(today.getDate()).padStart(2, '0');
            var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
            var yyyy = today.getFullYear();

            return dd + '-' + mm + '-' + yyyy;
    },
    getPercentage : function(min,max){
        if(!min) return '0%';
        if(!max) return '0%';
        if(min >= max) return '100%';
        return ((min/max)*100) + '%';
    },
    triggerConnect : function(){
        var item = $('.profile-topcard__right-column').find('artdeco-dropdown-item');
        if(item.filter((i)=>{ return $(item[i]).text().trim() == 'Connect' }).length == 0) return false;
        item.filter((i)=>{ return $(item[i]).text().trim() == 'Connect' }).click();
        //$('.connect-cta-form__send').click();
        return true;
    },
    isPendingConnection : function(){
        if(LIT.demo) return false;

        if($('artdeco-dropdown-content').find('.cursor-text').text().trim() == "Pending")
            return true;
        return false;
    },
    openMessageComposer : function(){
        var buttons = $('.profile-topcard__right-column').find('button');
        buttons.filter((i)=>{return $(buttons[i]).text().trim() == "Message"}).click();
    },
    updateMessageComposer : function(head,body){
        var composer = $('.compose-form__container');
        var buttons = $(composer).find('button');

        $(composer).find('.compose-form__subject-field').val(head);
        $(composer).find('.compose-form__message-field').val(body);

        // Send Message
        //buttons.filter((i)=>{return $(buttons[i]).text().trim() == "Send"}).click();
        
    },
    main: function () {
        console.log("Loading main function");
        LIT.injectStyle("font-awesome-4.7.0/css/font-awesome.min.css");
        LIT.injectStyle("index.css");

        //
        LIT.config = LIT.getConfig();
        LIT.autoLoadCheck= LIT.getAutoLoadCheck();

        LIT.addHolder();
        LIT.knockoutBind();
        LIT.setDraggable();
        LIT.eventRegistration();

        //Creating Database and get connection pool
        LIT.db = new LITDB();
        LIT.db.createDB();
        LIT.db.createTables();
        LIT.pullData();
        LIT.waitForDataLoad().then(()=>{
            chrome.runtime.sendMessage({type: 'childReady'}); 
            chrome.runtime.sendMessage({type: 'isThereAdmin'});   
        });    
    }
}

// View Model 
function LITViewModel() {
    // Data
    var self = this;
    self.result = [];
    self.tabs = ['Dashboard', 'Pipeline', 'Lead', 'Maintenance', 'Dropped','Data'];
    self.chosenTabId = ko.observable(self.tabs[0]);
    self.searchURL = ko.observable('');

    self.allProfiles = ko.observableArray(self.result);
    self.profiles = ko.observableArray(self.result);
    self.isCollectingProfile = ko.observable(false);
    self.pipelineStatus = ko.observable('Yet To Start');
    self.profileCount = ko.observable(0);

    self.leads = ko.observableArray(self.result);
    self.isCollectingLead = ko.observable(false);
    self.leadStatus = ko.observable('Yet To Start');
    self.leadCount = ko.observable(0);

    self.showLevelPhone = ko.observable(false);
    self.showLevelEmail = ko.observable(false);
    self.showLevel = ko.computed(function() {
        return (self.showLevelPhone() && self.showLevelEmail() ? 3 : (self.showLevelEmail() ? 2 : (self.showLevelPhone() ? 1 : 0))) ;
    });

    self.maintenances = ko.observableArray(self.result);
    self.availableSpeeds = ko.observableArray(['0x','1x','2x','3x']);
    
    self.msgHead = ko.observable('');
    self.msgBody = ko.observable('');


    self.droped =  ko.observableArray(self.result);

    // Behaviours    
    self.goToTab = function (tab) {
        self.chosenTabId(tab);
        console.log("Go To Tab :" + tab);
    };

    self.copyAndOpenURL = function () {
        if (self.searchURL().length == 0)
        {
            self.searchURL(window.location.href);
            LIT.db.executeSql('UPDATE CONFIG SET value=? WHERE key=?',[window.location.href,'url']).then((r)=>{
                LIT.syncConfig();
            });
        }            
        else
            window.open(self.searchURL());
    };
    self.importProfile = function () {
        console.log("Importing profile");
        self.isCollectingProfile(true);
        self.pipelineStatus("In Progress");
        $("html").animate({ scrollTop: $(document).height() }, 500, function () {
            $("html").animate({ scrollTop: $(document).height()/2 }, 500, function(){
                $("html").animate({ scrollTop: 0 }, 500, function () {
                    $("html").animate({ scrollTop: $(document).height() }, 500, function () {
                        $("html").animate({ scrollTop: $(document).height()/2 }, 500, function () {
                            setTimeout(self.collectProfile, LIT.config.pipelineViewTime);
                        });
                    });
                });
            });            
        });
    };

    self.getImage = function (img) {
        if (img == 'Not Found') return 'https://www.w3schools.com/howto/img_avatar.png';
        return img;
    };

    self.collectProfile = function () {
        var data = [];
        // for normal LinkedIn
        if($('.search-results__list li').length > 0)
        {
            $('.search-results__list li').each(function () {
                var fullname = $.trim($(this).find('.actor-name').text());
                var fullName = fullname.split(' '),
                    firstName = fullName.shift(),
                    lastName = fullName.join(" ");
    
                var temp = $.trim($(this).find('.subline-level-1').text()).split(' at ');
                var title = temp.shift();
                var company = temp.join(" ");
    
                var link = $.trim($(this).find('.search-result__result-link').attr("href"));
                if (link === undefined) { link = '/#'; }
                //console.log(link);
                var img = $(this).find('img').attr("src");
                if (img === undefined) { img = 'Not Found'; }
                var entry = {
                    fullName: fullname,
                    fname: firstName,
                    lname: lastName,
                    title: title,
                    company: company,
                    link: window.location.origin + link,
                    img: img
                }
                data.push(entry);
            });
        }
        // for normal Salse navigation LinkedIn
        if($('.search-results__result-item').length > 0)
        {
            $('.search-results__result-item').each(function () {
                var fullname = $.trim($(this).find('figure').find('img').attr('alt'));
                if(fullname.length == 0)
                    fullname =$.trim($(this).find('.result-lockup__name').text());
                var fullName = fullname.split(' '),
                    firstName = fullName.shift(),
                    lastName = fullName.join(" ");

                var title =  $(this).find('.result-lockup__highlight-keyword').text().trim().split('\n').filter((e)=>{return e.trim().length})[0];
                var company = $(this).find('[class$=-company]').text().trim().split('\n')[0];
    
                var link = $.trim($(this).find('figure').find('a').attr('href'));
                if (link === undefined) { link = '/#'; }
                //console.log(link);
                var img = $(this).find('figure').find('img').attr('src');
                if (img === undefined) { img = 'Not Found'; }
                if (img.includes('data:image')) { img = 'Not Found'; }
                var entry = {
                    fullName: fullname,
                    fname: firstName,
                    lname: lastName,
                    title: title,
                    company: company,
                    link: window.location.origin + link,
                    img: img
                }
                data.push(entry);
            });
        }
        console.log(data);
        LIT.appendToProfileList(data);        
    }

    self.setConfig = function(){  
        console.log("Setting Config in VM ");      
        self.searchURL(LIT.config.url);
        self.profileCount(self.profiles().length);
        self.msgHead(LIT.config.msgHead);
        self.msgBody(LIT.config.msgBody);
        LIT.autoLoadCheck.config = true;
    }
    self.setPipelineStatus = function(){
        LIT.waitForDataLoad().then(()=>{
            var total  = self.profiles().length + self.leads().length +  self.maintenances().length +  self.droped().length;
            if( total == (LIT.config.pipelineLength * LIT.config.pipelineCount) )
            {
                self.isCollectingProfile(false);
                self.pipelineStatus("Completed");
            }
            if(total < (LIT.config.pipelineLength * LIT.config.pipelineCount) && total > 0 )
            {
                self.isCollectingProfile(true);
                self.pipelineStatus("In-Progress");
            }  
            if( total == 0 )
            {
                self.isCollectingProfile(false);
                self.pipelineStatus("Yet To Start");
            }
        });
    }

    self.loadAllProfiles =function(data){
        self.allProfiles(data);
    }

    self.loadProfiles =function(data){
        self.profiles(data);
        self.profileCount(self.profiles().length);
        self.setPipelineStatus();
        self.setLeadStatus();
        LIT.autoLoadCheck.profile = true;      
    }

    self.importLead = function () {
        console.log("Importing profile");
        self.isCollectingLead (true);
        self.leadStatus('In-Progress');
        self.leadCount(self.leads().length);
        LIT.importNextLead();
    };

    self.setLeadStatus = function(){
        var total  =  self.leads().length +  self.maintenances().length +  self.droped().length;
        
        if( self.profiles().length == 0 && total > 0)
        {
            self.isCollectingLead(false);
            self.leadStatus("Completed");
        }
        if(self.profiles().length > 0 && total > 0)
        {
            self.isCollectingLead(true);
            self.leadStatus("In-Progress");
        }
        if( self.profiles().length > 0 && total == 0)
        {
            self.isCollectingLead(false);
            self.leadStatus("Yet To Start");
        }
    }   

    self.loadLeads =function(data){
        self.leads(data);
        self.leadCount(self.leads().length);
        self.setPipelineStatus();
        self.setLeadStatus();
        LIT.autoLoadCheck.lead = true;
    }
    self.loadMaintenances = function(data){
        /* Add Observable */
        for(var i=0;i<data.length;i++){
            data[i].chosenSpeed = ko.observable( data[i].speed? data[i].speed:'0x');
            data[i].chosenView = ko.observable( data[i].maxview? data[i].maxview:'0');
            data[i].chosenViewPercentage = ko.observable(LIT.getPercentage(data[i].visitcount , data[i].maxview));
        }
        self.maintenances(data);
        self.setPipelineStatus();
        self.setLeadStatus();
        LIT.autoLoadCheck.maintenance = true;
    }
    self.loadDroped =function(data){
        self.droped(data);
        self.setPipelineStatus();
        self.setLeadStatus();
        LIT.autoLoadCheck.droped = true;
    }
    self.resetAll = function(){
        LIT.db.deleteTables();
        setTimeout(self.recreate,500);
    }
    self.triggerAutoView = function(){
        //LIT.refresh();
        LIT.doAutoView4();
    }
    self.recreate = function(){
        LIT.db.createTables();
        LIT.config =  LIT.getConfig();        
        LIT.pullData();
    }

    self.tryAgain = function(profile){
        //console.log("Try again profile");
        //console.log(profile);
        LIT.tryAgain(profile.rowid);
    }
    self.dropProfile = function(profile){
        //console.log("Droped profile");
        //console.log(profile);
        var msg = {id: profile.rowid, link : profile.link, type: 'simplyView' };
        console.log(msg);
        chrome.runtime.sendMessage(msg);
        LIT.dropProfile(profile.rowid);
    }
    self.addBack = function(profile){
        LIT.addBack(profile.rowid);
    }
    self.moveToMaintenance = function(profile){
        var msg = {id: profile.rowid, link : profile.link, type: 'simplyView' };
        console.log(msg);
        chrome.runtime.sendMessage(msg);
        LIT.moveToMaintenance(profile.rowid);
    }
    self.changeSpeed = function(profile){
        LIT.changeSpeed(profile.rowid, profile.chosenSpeed());
    }
    self.changeView = function(profile){
        profile.chosenViewPercentage(LIT.getPercentage(profile.visitcount , profile.chosenView()));
        LIT.changeView(profile.rowid, profile.chosenView());
    }
    self.addNewPipeline = function(){
        self.searchURL('');
        self.chosenTabId('Pipeline');
    }
    self.addPipeline = function(){
        // increase pipeline count
        LIT.db.executeSql("UPDATE CONFIG SET value= ? WHERE key=?",[LIT.config.pipelineCount +1,'pipelineCount']).then((r)=>{
            LIT.syncConfig();
            self.importProfile();
        });
                
    }
    self.saveMsgHead = function(){
        LIT.db.executeSql('UPDATE CONFIG SET value=? WHERE key=?',[self.msgHead(),'msgHead']).then((r)=>{
            LIT.syncConfig();
        });
    }
    self.saveMsgBody = function(){
        LIT.db.executeSql('UPDATE CONFIG SET value=? WHERE key=?',[self.msgBody(),'msgBody']).then((r)=>{
            LIT.syncConfig();
        });
    }
};

LIT.waitForJqueryUI();