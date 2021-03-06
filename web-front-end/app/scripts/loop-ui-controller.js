/**
Copyright 2013 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
**/
'use strict';

var PLATFORM_ID_ANDROID = 0;
var PLATFORM_ID_IOS = 1;

var LOADING = 0;
var SITE_LIST = 1;
var SIGN_OUT = 2;

var TIMER_INTERVAL = 60000;

/* jshint unused: false, sub:true */
function LoopController(autoLoop) {
  var currentState;
  var idToken;
  var sitesModel;
  var loopModel;
  var deviceListController;
  var autorun = autoLoop;

  var pushInterval = null;
  var currentUrlIndex = 0;

  this.getCurrentUrlIndex = function() {
    return currentUrlIndex;
  };

  this.setCurrentUrlIndex = function(index) {
    currentUrlIndex = index;
  };

  /**this.getIntervalLoop = function() {
    return pushInterval;
  };

  this.setIntervalLoop = function(loop) {
    pushInterval = loop;
  };**/

  this.setIdToken = function(token) {
    idToken = token;
    sitesModel = new SitesModel(token);
    loopModel = new LoopModel(token);
    deviceListController = new DeviceListController(token);
  };

  this.getIdToken = function() {
    return idToken;
  };

  this.getCurrentState = function() {
    return currentState;
  };

  this.setCurrentState = function(state) {
    currentState = state;
  };

  this.getDeviceListController = function() {
    return deviceListController;
  };

  this.setSitesModel = function(s) {
    return sitesModel;
  };

  this.getSitesModel = function() {
    return sitesModel;
  };

  this.setLoopModel = function(m) {
    loopModel = m;
  };

  this.getLoopModel = function() {
    return loopModel;
  };

  this.getFriendlyCookie = function() {
    var keyValueStrings = document.cookie.split(';');
    var friendlyCookie = {};
    for(var i=0; i < keyValueStrings.length; i++)  {
      var attribute = keyValueStrings[i].trim().split('=');
      if(attribute.length !== 2) {
        continue;
      }

      friendlyCookie[attribute[0]] = attribute[1];
    }

    return friendlyCookie;
  };

  this.shouldAutoRun = function() {
    return autorun;
  };
}

LoopController.prototype.init = function() {
  var cookie = this.getFriendlyCookie();
  var token = cookie.token;
  if(typeof token === 'undefined') {
    this.setUIState(SIGN_OUT);
    return;
  }
  this.setIdToken(token);

  this.initialiseStaticElements();

  this.setUIState(LOADING);

  this.updateSiteList(function() {
    //this.setUIState(SITE_LIST);
    this.updateLooperState();
  }.bind(this));
};

LoopController.prototype.updateLooperState = function() {
  var loopModel = this.getLoopModel();
  loopModel.updateLoopState(function(err) {
    if(err) {
      console.log('Unable to update the loop state: '+err);
    }
    var looperSwitch = document.querySelector('#sites-looper-checkbox');
    looperSwitch.disabled = false;
    looperSwitch.checked = loopModel.isLooping();
    this.setUIState(SITE_LIST);
  }.bind(this));
}

/**
 * Set the UI state for the page
 */
LoopController.prototype.setUIState = function(newState) {
  var currentState = this.getCurrentState();
  //if(currentState === newState) {
  //  return;
  //}

  // Iterate over the dom elements and show / hide depending on the state
  var classList = ['loading', 'empty-lab', 'site-list', 'nav-bar'];
  var visible = {};

  switch(newState) {
  case LOADING:
    visible['loading'] = true;
    break;
  case SITE_LIST:
    var sitesList = this.getSitesModel().getSitesList(function(err, sites) {
      if(!sites) {
        sites = [];
      }

      if(sites.length === 0) {
        visible['nav-bar'] = true;
        visible['empty-lab'] = true;

        this.cancelPushLooper();
      } else {
        visible['nav-bar'] = true;
        visible['site-list'] = true;

        this.renderSitesList();
      }
    }.bind(this));
    

    break;
  case SIGN_OUT:
    gapi.auth.signOut();

    document.cookie = 'token=; autosignin=false; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = 'autosignin=false; path=/';

    window.location.href = '/';

    break;
  }

  this.alterVisibleViews(visible, classList);

  this.setCurrentState(newState);
};

/**
 * This method goes through the class names in the classList array and if
 * the visible object has a key of the className with value true, it will
 * have the 'hide' className removed, otherwise it's added
 */
LoopController.prototype.alterVisibleViews = function(visible, classList) {
  for(var i = 0; i < classList.length; i++) {
    var className = classList[i];
    var element = document.querySelector('.'+className);
    if(!element) {
      continue;
    }

    if(visible[className]) {
      element.classList.remove('hide');
    } else {
      element.classList.add('hide');
    }
  }
};

/**
 * Initialise any elements on the page which aren't going to change
 * during the use of the page
 */
LoopController.prototype.initialiseStaticElements = function() {
  var inputField = document.querySelector('.url-to-add');

  // Stash the value on keyup
  inputField.onkeyup = function(e) {
    if(Modernizr && Modernizr.localstorage) {
      localStorage.setItem('url-input-field', inputField.value);
    }
  };

  // Set the input value to our stashed value
  if(Modernizr && Modernizr.localstorage) {
    inputField.value = localStorage.getItem('url-input-field');
  }

  // On send button press, send the push message
  var addButton = document.querySelector('.add-url');
  addButton.addEventListener('click', function() {
    document.querySelector('.url-add-container > .add-url').style.display = "none";
    document.querySelector('.url-add-container > .spinner').style.display = "block";

    this.addURLToList(document.querySelector('.url-to-add').value);
  }.bind(this), false);

  // On log out set the UI state accordingly
  var logoutBtn = document.querySelector('.nav-bar > .logout');
  if(logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      this.setUIState(SIGN_OUT);
    }.bind(this), true);
  }

  // Set up push looper switch
  var looperSwitch = document.querySelector('#sites-looper-checkbox');
  looperSwitch.addEventListener('change', function(evt) {
    var looperSwitch = document.querySelector('#sites-looper-checkbox');
    looperSwitch.disabled = true;
    if(evt.target.checked) {
      this.startPushLooper();
    } else {
      this.cancelPushLooper();
    }
  }.bind(this));
};

/**
 * Get the device list from the model
 */
LoopController.prototype.updateSiteList = function(successCb) {
  var sitesModel = this.getSitesModel();
  sitesModel.getSitesList(function(err, sites) {
    if(!(err === null || typeof(err) === 'undefined')) {
      window.alert(err);

      this.setUIState(SIGN_OUT);
      return;
    }

    successCb();
  }.bind(this));
};

/**
 * This method will add the URL to the list of looped URLS
 */
LoopController.prototype.addURLToList = function(url) {
  if(typeof url === undefined || url.length === 0) {
    return;
  }

  var sitesModel = this.getSitesModel();
  sitesModel.addUrlToList(url, function(err) {
    if(!(err === null || typeof(err) === 'undefined')) {
      window.alert('Couldn\'t push the URL to devices: '+err);
    } else {
      document.querySelector('.url-to-add').value = "";
    }

    document.querySelector('.url-add-container > .add-url').style.display = "block";
    document.querySelector('.url-add-container > .spinner').style.display = "none";
    this.setUIState(SITE_LIST);
  }.bind(this));
};

/**
 * Given we have the devices, group them into platforms and
 * query accordingly
 */
LoopController.prototype.renderSitesList = function() {
  var className = 'sites';
  var sitelistElem = document.querySelector('.site-list > .list-elem.'+className);

  this.prepareSiteList(sitelistElem);
};


/**
 * Get the device list populated with relevant browser options
 */
LoopController.prototype.prepareSiteList = function(listElem) {
  while (listElem.firstChild) {
    listElem.removeChild(listElem.firstChild);
  }

  //var device;
  //var deviceListController = this.getDeviceListController();
  var siteRowTemplate = document.querySelector('#site-li-template').innerHTML;
  //var browserSelectTemplate = document.querySelector('#browser-li-template').innerHTML;
  this.getSitesModel().getSitesList(function(err, sites) {
    if(!sites) {
      sites = {};
    }

    var siteId;
    for (siteId in sites) {
      var site = sites[siteId];
      var output = Mustache.render(siteRowTemplate, site);
      var liElement = document.createElement('li');
      liElement.id = 'site-list-item-'+site.id;
      liElement.innerHTML = output;
      listElem.appendChild(liElement);

      this.addListElementEvents(liElement, site.id);
    }

    for(var i = 0; i < sites.length; i++) {
      //device = deviceListController.getDeviceById(deviceIds[i]);
      var site = sites[i];

      // Create Entry for the Device
      var output = Mustache.render(siteRowTemplate, site);
      var liElement = document.createElement('li');
      liElement.id = 'site-list-item-'+site.id;
      liElement.innerHTML = output;
      listElem.appendChild(liElement);

      // If the element is enabled or not
      //var checkbox = liElement.querySelector('#enabled-checkbox-'+site.id);
      //checkbox.checked = site.enabled;

      //if(!site.enabled) {
      //  liElement.classList.add('disabled');
      //}

      this.addListElementEvents(liElement, site.id);
    }
  }.bind(this));
};

LoopController.prototype.addListElementEvents = function(liElement, siteId) {

  // Handle the edit text element
  var editButton = document.querySelector('#edit-button-'+siteId);
  editButton.addEventListener('click',
    this.getEditSiteCallback(siteId), true);

  // Handle the complete text element
  var completeButton = document.querySelector('#complete-button-'+siteId);
  completeButton.addEventListener('click',
    this.getCompleteEditCallback(siteId), true);

  // Handle the delete device action
  var deleteButton = document.querySelector('#delete-button-'+siteId);
  deleteButton.addEventListener('click',
    this.getDeleteSiteCallback(siteId), true);

  // Handle the delete device action
  //var enabledCheckbox = document.querySelector('#enabled-checkbox-'+siteId);
  //enabledCheckbox.addEventListener('change',
  //  this.getEnableSiteCallback(siteId), true);
};

/**
 * A callback to edit a device (at the moment only handles nickname changes)
 */
LoopController.prototype.getEditSiteCallback = function(siteId) {
  return function() {
    var inputField = document.querySelector('#site-name-input-'+siteId);
    inputField.disabled = false;
    inputField.focus();

    var completeButton = document.querySelector('#complete-button-'+siteId);
    completeButton.classList.remove('hide');

    var editButton = document.querySelector('#edit-button-'+siteId);
    editButton.disabled = true;

    var deleteButton = document.querySelector('#delete-button-'+siteId);
    deleteButton.disabled = true;

    //var checkbox = document.querySelector('#enabled-checkbox-'+siteId);
    //checkbox.disabled = true;
  };
};

/**
 * A callback to handle deleting a device
 */
LoopController.prototype.getDeleteSiteCallback = function(siteId) {
  return function() {
    var sitesModel = this.getSitesModel();
    sitesModel.removeUrl(siteId, function(err) {
      if(!(err === null || typeof(err) === "undefined")) {
        window.alert('Unabled to remove url: '+err);
        return;
      }

      console.log('Removing element from list');
      var listItem = document.querySelector('#site-list-item-'+siteId);
      console.log('Removing element from list', listItem);
      listItem.parentNode.removeChild(listItem);

      this.setUIState(SITE_LIST);
    }.bind(this));
  }.bind(this);
};

/**
 * A callback to handle completion of device editing
 */
LoopController.prototype.getCompleteEditCallback = function(siteId) {
  return function() {
    var inputField = document.querySelector('#site-name-input-'+siteId);
    inputField.disabled = true;

    var completeButton = document.querySelector('#complete-button-'+siteId);
    completeButton.classList.add('hide');

    var editButton = document.querySelector('#edit-button-'+siteId);
    editButton.disabled = false;

    var deleteButton = document.querySelector('#delete-button-'+siteId);
    deleteButton.disabled = false;

    //var checkbox = document.querySelector('#enabled-checkbox-'+siteId);
    //checkbox.disabled = false;

    var sitesModel = this.getSitesModel();
    sitesModel.updateSiteUrl(siteId, inputField.value, function(err) {
      if(err !== null) {
        window.alert('Unable to update site url: '+err);
      }
    });
  }.bind(this);
};

/**
 * A callback to handle completion of device editing
 *
 * Currently not used but may add in feature later
 */
LoopController.prototype.getEnableSiteCallback = function(siteId) {
  return function(e) {
    var deviceListItem = document.querySelector('#site-list-item-'+siteId);

    this.getSitesModel().onSiteEnabledChange(siteId, e.target.checked);

    if(e.target.checked) {
      deviceListItem.classList.remove('disabled');
    } else {
      deviceListItem.classList.add('disabled');
    }
  }.bind(this);
};

LoopController.prototype.startPushLooper = function() {
  /**var currentInterval = this.getIntervalLoop();
  if(currentInterval) {
    return;
  }**/

  var loopModel = this.getLoopModel();
  loopModel.startLooping(function(err) {
    if(!(err === null || typeof(err) === 'undefined')) {
      window.alert('Unabled to start looper: '+err);
      return;
    }

    var looperSwitch = document.querySelector('#sites-looper-checkbox');
    looperSwitch.disabled = false;
  });

  var looperSwitch = document.querySelector('#sites-looper-checkbox');
  looperSwitch.checked = true;

  /**var newInterval = setInterval(function() {
    this.handlePush();
  }.bind(this), TIMER_INTERVAL);

  this.handlePush();
  this.setIntervalLoop(newInterval);**/
};

/**LoopController.prototype.handlePush = function() {
  this.getSitesModel().getSitesList(function(err, sitesArray) {
    if(err) {
      window.alert('Unable to push message as couldn\'t any sites');
      return;
    }

    var currentIndex = this.getCurrentUrlIndex();
    if(currentIndex >= sitesArray.length) {
      currentIndex = 0;
    }

    var site = sitesArray[currentIndex];

    this.setCurrentUrlIndex(currentIndex+1);

    this.sendPush(site.url);
  }.bind(this));
}**/

LoopController.prototype.cancelPushLooper = function() {
  /**var currentInterval = this.getIntervalLoop();
  if(currentInterval) {
    clearInterval(currentInterval);
    this.setIntervalLoop(null);
  }**/

  var loopModel = this.getLoopModel();
  loopModel.endLooping(function(err) {
    if(!(err === null || typeof(err) === 'undefined')) {
      window.alert('Unabled to end looper: '+err);
      return;
    }

    var looperSwitch = document.querySelector('#sites-looper-checkbox');
    looperSwitch.disabled = false;
  });

  var looperSwitch = document.querySelector('#sites-looper-checkbox');
  looperSwitch.checked = false;
};

/**LoopController.prototype.sendPush = function(url) {
  var currentdate = new Date(); 
  var timeString = currentdate.getHours() + ":"  
                + currentdate.getMinutes() + ":" 
                + currentdate.getSeconds();
  console.log('loop-ui-controller: sendPush() @ '+timeString+' url = '+url);
  if(typeof url === 'undefined' || url.length === 0) {
    return;
  }

  var deviceController = this.getDeviceListController();
  deviceController.sendUrlPushMessageToAll(url, function(err) {
    if(err) {
      if(err.code === 'invalid_id_token') {
        console.log('loop-ui-controller: Reattempting sign in');

        var autorun = this.shouldAutoRun();
        if(window.location.search.length > 0 && !autorun) {
          // This is to avoid the scenario where autorun is false 
          // and we have it set in the location
          return;
        }
        window.location.search = '?autorun='+(!autorun);
      } else if(err.msg) {
        window.alert('Couldn\'t push the URL to devices: '+err.msg);
      } else {
        window.alert('Couldn\'t push the URL to devices: '+err);
      }
    }
    this.cancelPushLooper();
    return;
  }.bind(this));
};**/

window.onload = function() {
  //localStorage.clear();
  var autorun = false;
  if(window.location.search.lastIndexOf('autorun=true') >= 0) {
    autorun = true;
  }
  window.loopController = new LoopController(autorun);
  loopController.init();
};
