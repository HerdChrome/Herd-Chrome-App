// Registering Messaging 

var mainTab = 0;
var ChildTabArray =[];

var lastEmptyNotify = 0;
var lastLimitNotify = 0;

var LITNotification ={
    reachedLimit: function(){
        console.log("showing Notification");
        lastLimitNotify = new Date().getDate();
        chrome.notifications.create('reminder', {
            type: 'basic',
            iconUrl: '128.png',
            title: 'Lead Collected for the Day !',
            message: 'Reached the Daily Limit !'
         }, function(notificationId) {});
    },
    emptyPipeline : function(){
        console.log("showing Notification");
        lastEmptyNotify = new Date().getDate();
        chrome.notifications.create('reminder', {
            type: 'basic',
            iconUrl: '128.png',
            title: 'Empty Pipeline!',
            message: 'No More Pipeline profile to collect !'
         }, function(notificationId) {});
         console.log("done Notification");

    },
    contact : function(email,phone){
        console.log("showing Notification");
        chrome.notifications.create('reminder', {
            type: 'basic',
            iconUrl: '128.png',
            title: 'New Lead',
            message: 'You Recieved a new lead!'
         }, function(notificationId) {});
         console.log("done Notification");

    },
    autoView : function(){
        console.log("showing Notification");
        chrome.notifications.create('reminder', {
            type: 'basic',
            iconUrl: '128.png',
            title: 'New Auto View',
            message: 'You have viewed a profile automatically!'
         }, function(notificationId) {});
         console.log("done Notification");
    },
    connect : function(){
        console.log("showing Notification");
        chrome.notifications.create('reminder', {
            type: 'basic',
            iconUrl: '128.png',
            title: 'New Connection',
            message: 'You have sent connection request to a profile!'
         }, function(notificationId) {});
         console.log("done Notification");
    },
    sentMsg : function(){
        console.log("showing Notification");
        chrome.notifications.create('reminder', {
            type: 'basic',
            iconUrl: '128.png',
            title: 'New Message Sent',
            message: 'You have sent Message to a profile!'
         }, function(notificationId) {});
         console.log("done Notification");
    }
};

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if(request.type == "notify"){
            if(request.name == "reachedLimit" && lastLimitNotify != new Date().getDate())LITNotification.reachedLimit();
            if(request.name == "emptyPipeline" && lastEmptyNotify != new Date().getDate())LITNotification.emptyPipeline();
            if(request.name == "contact")LITNotification.contact(request.email,request.phone );
            if(request.name == "autoView")LITNotification.autoView();
            if(request.name == "connect")LITNotification.connect();
            if(request.name =="sentMsg")LITNotification.sentMsg();
        }
        if(request.type ==  "isThereAdmin"){
            if(mainTab == 0) {
                mainTab = sender.tab.id;
            }           
        }
        if(request.type == "iAmMain" ){
            mainTab = sender.tab.id;
        }
        if (request.type == "getLead")
        {
            console.log(request);
            var url =  request.link;
            var leadID = request.id;
            chrome.tabs.create({ url: url+'detail/contact-info/', active: true },function(tab){
                var childTab = tab.id; 
                ChildTabArray.push({leadID : leadID, childTab: childTab});               
            }); 
        }
        if(request.type == "simplyView"){
            console.log(request);
            var url =  request.link;
            var leadID = request.id;
            chrome.tabs.create({ url: url, active: true },function(tab){
                var childTab = tab.id; 
                ChildTabArray.push({leadID : leadID, childTab: childTab});               
            });
        }
        if(request.type == "childReady"){
            console.log(request);
            // get LeadId
            var arr =  ChildTabArray.filter((i)=>{return i.childTab == sender.tab.id});
            if(arr.length == 1)
            {
                if(sender.tab.url.includes("detail/contact-info/"))
                    chrome.tabs.sendMessage(arr[0].childTab, {type: "pipelineToLead", id : arr[0].leadID});
                else
                    chrome.tabs.sendMessage(arr[0].childTab, {type: "updateVisit", id : arr[0].leadID  });
            }
            

        }
        if(request.type == "childDone"){
            console.log(request);
            var arr =  ChildTabArray.filter((i)=>{return i.childTab == sender.tab.id});
            if(arr.length == 1)
            {
                // close child tab
                ChildTabArray = ChildTabArray.filter((i)=>{return i.childTab != sender.tab.id});
                chrome.tabs.remove(arr[0].childTab, function() { });                
                chrome.tabs.sendMessage(mainTab, {type: "refresh"});
            }
        }
    });

chrome.tabs.onRemoved.addListener(function(tabid, removed) {
    if(tabid == mainTab && mainTab !=0)    mainTab = 0;
})

function autoViewTrigger (){
    if(mainTab != 0)
    {
        chrome.tabs.sendMessage(mainTab, {type: "refresh"});
    }
    else{

    }
    setTimeout(autoViewTrigger, 1000*60*60*6); // every 6 hour
}
autoViewTrigger();

