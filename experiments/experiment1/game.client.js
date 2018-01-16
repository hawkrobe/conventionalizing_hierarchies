

//   Copyright (c) 2012 Sven "FuzzYspo0N" Bergström,
//                   2013 Robert XD Hawkins

//     written by : http://underscorediscovery.com
//     written for : http://buildnewgames.com/real-time-multiplayer/

//     modified for collective behavior experiments on Amazon Mechanical Turk

//     MIT Licensed.


// /*
//    THE FOLLOWING FUNCTIONS MAY NEED TO BE CHANGED
// */

// A window global for our game root variable.
var globalGame = {};
// Keeps track of whether player is paying attention...
var incorrect;
var dragging;
var waiting;

//test: let's try a variable selecting, for when the listener selects an object
// we don't need the dragging.
var selecting;

var client_onserverupdate_received = function(data){
  globalGame.my_role = data.trialInfo.roles[globalGame.my_id];

  // Update client versions of variables with data received from
  // server_send_update function in game.core.js
  //data refers to server information
  if(data.players) {
    _.map(_.zip(data.players, globalGame.players),function(z){
      z[1].id = z[0].id;
    });
  }
  
  if (globalGame.roundNum != data.roundNum) {
    globalGame.objects = _.map(data.trialInfo.currStim, function(obj) {
      // Extract the coordinates matching your role &
      // remove the speakerCoords and listenerCoords properties
      var customCoords = (globalGame.my_role == globalGame.playerRoleNames.role1 ?
			  obj.speakerCoords : obj.listenerCoords);
      var customObj = _.chain(obj)
	  .omit('speakerCoords', 'listenerCoords')
	  .extend(obj, {
	    trueX : customCoords.trueX, trueY : customCoords.trueY,
	    gridX : customCoords.gridX, gridY : customCoords.gridY,
	    box : customCoords.box
	  })
	  .value();
      
      var imgObj = new Image(); //initialize object as an image (from HTML5)
      imgObj.onload = function(){ // Draw image as soon as it loads (this is a callback)
        globalGame.ctx.drawImage(imgObj, parseInt(customObj.trueX),
				 parseInt(customObj.trueY),
				 customObj.width, customObj.height);
        if (globalGame.my_role === globalGame.playerRoleNames.role1) {
          highlightCell(globalGame, '#000000', x => x.targetStatus == 'target');
        }
      };
      imgObj.src = customObj.url; // tell client where to find it
      return _.extend(customObj, {img: imgObj});
    });
  };

  globalGame.game_started = data.gs;
  globalGame.players_threshold = data.pt;
  globalGame.player_count = data.pc;
  globalGame.roundNum = data.roundNum;
  globalGame.roundStartTime = new Date();
  globalGame.labels = data.trialInfo.labels;
  globalGame.allObjects = data.allObjects;
  
  if(!_.has(globalGame, 'data')) {
    globalGame.data = data.dataObj;
  }

  // Get rid of "waiting" screen if there are multiple players
  if(data.players.length > 1) {
    $('#messages').empty();
    $("#chatbox").removeAttr("disabled");
    $('#chatbox').focus();
    globalGame.get_player(globalGame.my_id).message = "";

    // reset labels
    // Update w/ role (can only move stuff if agent)
    $('#roleLabel').empty().append("You are the " + globalGame.my_role + '.');

    if(globalGame.my_role === globalGame.playerRoleNames.role1) {
      enableLabels(globalGame);
      globalGame.viewport.removeEventListener("click", mouseClickListener, false);
      $('#instructs')
	.empty()
	.append("<p>Click & drag one word down to the grey box</p>" +
		"<p>to tell the listener which object is the target.</p>");
      // Insert labels & show dropzone
      $('#labels').empty().append(
	_.map(globalGame.labels, (word) => {
	  return '<p class="cell draggable drag-drop">' + word + '</p>';
	}))
	.append('<div id="chatarea" class="dropzone"></div>');
    } else if(globalGame.my_role === globalGame.playerRoleNames.role2) {
      disableLabels(globalGame);
      globalGame.viewport.addEventListener("click", mouseClickListener, false);
      $('#instructs')
	.empty()
	.append("<p>After you see the speaker drag a word into the box,</p>" +
		"<p>click the object they are telling you about.</p>");
      $('#labels').empty().append(
	_.map(globalGame.labels, (word) => {
	  return '<p class="cell draggable drag-drop" style="color:black">' + word + '</p>';
	}))
	.append('<div id="chatarea" class="dropzone"></div>');
    }
  }
    
  // Draw all this new stuff
  drawScreen(globalGame, globalGame.get_player(globalGame.my_id));
};

var client_onMessage = function(data) {

  var commands = data.split('.');
  var command = commands[0];
  var subcommand = commands[1] || null;
  var commanddata = commands[2] || null;

  switch(command) {
  case 's': //server message
    switch(subcommand) {
      
    case 'feedback' :
      $("#chatbox").attr("disabled", "disabled");
      // update local score
      var clickedObjName = commanddata;
      var target = _.filter(globalGame.objects, (x) => {
	return x.targetStatus == 'target';
      })[0];
      var scoreDiff = target.name == clickedObjName ? globalGame.bonusAmt : 0;
      globalGame.data.subject_information.score += scoreDiff;
      $('#score').empty()
        .append("Bonus: $" + (globalGame.data.subject_information.score/100).toFixed(2));
      
      // draw feedback
      if (globalGame.my_role === globalGame.playerRoleNames.role1) {
	drawSketcherFeedback(globalGame, scoreDiff, clickedObjName);
      } else {
	drawViewerFeedback(globalGame, scoreDiff, clickedObjName);
      }

      break;
      
    case 'alert' : // Not in database, so you can't play...
      alert('You did not enter an ID');
      window.location.replace('http://nodejs.org'); break;

    case 'join' : //join a game requested
      var num_players = commanddata;
      client_onjoingame(num_players, commands[3]); break;

    case 'add_player' : // New player joined... Need to add them to our list.
      console.log("adding player" + commanddata);
      clearTimeout(globalGame.timeoutID);
      if(hidden === 'hidden') {
        flashTitle("GO!");
      }
      globalGame.players.push({id: commanddata,
             player: new game_player(globalGame)}); break;
    }
  }
};

var setupOverlay = function() {
  var closeButton = document.getElementById('transition_button');
  closeButton.onclick = () => {
    $('#transition_text').hide();
    $('#dimScreen').hide();    
  };
};

// We want to test both directions of the lexicon.
// Given a word, what objects does it apply to; given an object, what words apply to it?
function setupPostTest () {
  setupOverlay();
  globalGame.testTargets = _.shuffle(['word', 'object']);
  globalGame.currTargetType = globalGame.testTargets.shift();
  globalGame.selections = [];
  
  var button = document.getElementById('post_test_button');
  var objectNames = _.map(globalGame.allObjects, 'name');
    
  var showNextTarget = () => {
    var targets = globalGame.currTargetType == 'word' ? globalGame.labels : objectNames;
    var targetTag = globalGame.currTargetType == 'word' ? '#word_grid p' : '#object_grid img';
    var targetProperty = globalGame.currTargetType == 'word' ?  'color' : 'border-color';
    var targetSelectedColor = globalGame.currTargetType == 'word' ? 'white' : 'grey';
    var targetUnselectedColor = globalGame.currTargetType == 'word' ? 'grey' : 'white';
    
    // Highlight new target
    globalGame.targetNum += 1;
    globalGame.currTarget = targets[globalGame.targetNum];
    var newTarget = $(`${targetTag}[data-name~="${globalGame.currTarget}"`)
	.css(_.zipObject([targetProperty], [targetSelectedColor]));
  };

  button.onclick = () => {
    var optionTag = globalGame.currTargetType == 'word' ? '#object_grid img' : '#word_grid p';
    var optionProperty = globalGame.currTargetType == 'word' ? 'border-color' : 'color';
    var optionSelectedColor = globalGame.currTargetType == 'word' ? 'grey' : 'white';
    var optionUnselectedColor = globalGame.currTargetType == 'word' ? 'white' :  'grey';
    var targetTag = globalGame.currTargetType == 'word' ? '#word_grid p' : '#object_grid img';
    var targetProperty = globalGame.currTargetType == 'word' ?  'color' : 'border-color';
    var targetUnselectedColor = globalGame.currTargetType == 'word' ? 'grey' : 'white';
    
    var limit = (globalGame.currTargetType == 'word' ? globalGame.labels.length - 1 :
		 globalGame.allObjects.length - 1);

    // Send data from current response
    globalGame.socket.send('postTestData.' + globalGame.currTarget + '.'
			   + globalGame.selections.join('.'));

    // Unselect old target
    if(globalGame.currTarget) {
      var oldTarget = $(`${targetTag}[data-name~="${globalGame.currTarget}"`)
	  .css(_.zipObject([targetProperty], [targetUnselectedColor]));
    }

    // Clear previous selections
    $(optionTag).css(_.zipObject([optionProperty], [optionUnselectedColor]));
    globalGame.selections = [];

    // If you've advanced through both objs and words, move on to exit survey
    if(globalGame.targetNum >= limit && globalGame.testTargets.length == 0){
      $('#post_test').hide();
      $('#exit_survey').show();
    // If you're done with first batch, move to second
    } else if(globalGame.targetNum >= limit) {
      globalGame.currTargetType = globalGame.testTargets.shift();
      // Make sure all borders are gone
      setupPostTestHTML();
      showNextTarget();      
    } else {
      showNextTarget();
    }
  };  

  // Populate display fields
  _.forEach(globalGame.labels, (word) =>{
    $('#word_grid').append(
      $('<p/>')
	.css({color: 'grey'})
	.addClass('cell')
	.addClass('noselect')
	.text(word)
	.attr({'data-name' : word})      
    );
  });
  
  _.forEach(globalGame.allObjects, (obj) => {
    $("#object_grid").append(
      $('<img/>')
      	.attr({height: "50%", width: "25%", src: obj.url,
	       'data-name' : obj.name})
	.css({border: '10px solid', 'border-color' : 'white'})
  	.addClass("imgcell")
    );
  });

  setupPostTestHTML();
  showNextTarget();
};

var setupPostTestHTML = function() {
  // Set up instructions and grid locations
  globalGame.targetNum = -1;

  // Set target array at top
  var intendedTop = `#${globalGame.currTargetType}_grid`;
  $(intendedTop).insertAfter( $('#post_test_instruction') );

  // Unbind old click listeners if they exist 
  $(globalGame.currTargetType == 'word' ? '#word_grid p' : '#object_grid img')
    .off('click');

  // Set new listeners
  $(globalGame.currTargetType == 'word' ? '#object_grid img' : '#word_grid p')
    .click(function(event) {
      var optionProperty = globalGame.currTargetType == 'word' ? 'border-color' : 'color';
      var selectedColor = globalGame.currTargetType == 'word' ? 'grey' : 'white';
      var unselectedColor = globalGame.currTargetType == 'word' ? 'white' : 'grey';
      if(_.includes(globalGame.selections, $(this).attr('data-name'))) {
	_.remove(globalGame.selections, obj => obj == $(this).attr('data-name'));
	$(this).css(_.zipObject([optionProperty], [unselectedColor]));
      } else {
	globalGame.selections.push($(this).attr('data-name'));
	$(this).css(_.zipObject([optionProperty], [selectedColor]));
      }
    });

  // Update instructions
  var wordTaskInstruction = "<p style='font-size:150%'>For each highlighted <b>word</b>, please click all of the <b>objects</b> it can refer to, then click 'next'.</p><p>If you're not sure, or it doesn't mean anything, click 'next' without making a selection.</p>";
  
  var objTaskInstruction = "<p style='font-size:150%'>For each highlighted <b>object</b>, please click all of the <b>words</b> that can refer to it, then click 'next'.</p><p>If you're not sure, or if none of the words refer to it, click 'next' without making a selection.</p>";
  
  $('#post_test_instruction').html(globalGame.currTargetType == 'word' ?
  				   wordTaskInstruction : objTaskInstruction);
};

var client_addnewround = function(game) {
  $('#roundnumber').append(game.roundNum);
};

var customSetup = function(game) {
  // Set up new round on client's browsers after submit round button is pressed.
  // This means clear the chatboxes, update round number, and update score on screen
  game.socket.on('newRoundUpdate', function(data){
    $('#messages').empty();
    if(game.roundNum + 2 > game.numRounds) {
      $('#roundnumber').empty();
      $('#instructs').empty()
        .append("Round\n" + (game.roundNum + 1) + "/" + game.numRounds);
    } else {
      $('#feedback').empty();
      $('#roundnumber').empty()
        .append("Round\n" + (game.roundNum + 2) + "/" + game.numRounds);
    }
  });

  game.socket.on('finishedGame', function(data) {
    $("#main").hide();
    $("#header").hide();
    $("#dimScreen").show();
    $("#post_test").show();
    setupPostTest();
  });
  
  game.socket.on('dragging', function(event) {
    dragMoveListener(event);
  });

  game.socket.on('drop', function(event) {
    $('#chatarea').css('background-color', '#32CD32');
    globalGame.messageSent = true;
  });
};

var client_onjoingame = function(num_players, role) {
  // set role locally
  globalGame.my_role = role;
  globalGame.get_player(globalGame.my_id).role = globalGame.my_role;
  _.map(_.range(num_players - 1), function(i){
    globalGame.players.unshift({id: null, player: new game_player(globalGame)});
  });

  if(num_players == 1) {
    this.timeoutID = setTimeout(function() {
      if(_.size(this.urlParams) == 4) {
        this.submitted = true;
        window.opener.turk.submit(this.data, true);
        window.close();
      } else {
        console.log("would have submitted the following :");
        console.log(this.data);
      }
    }, 1000 * 60 * 15);
    $("#chatbox").attr("disabled", "disabled");
    globalGame.get_player(globalGame.my_id).message = ('Waiting for another player to connect... '
              + 'Please do not refresh the page!');
  }
};

/*
 MOUSE EVENT LISTENERS
 */

function dragMoveListener (event) {
  // Tell the server if this is a real drag event (as opposed to an update from partner)
  var container = $('#message_panel')[0];
  var width = parseInt(container.getBoundingClientRect().width);
  var height = parseInt(container.getBoundingClientRect().height);
  if(_.has(event, 'name')) {
    event.target = $(`p:contains("${event.name}")`)[0];
    event.dx = parseFloat(event.dx) / event.width * width;
    event.dy = parseFloat(event.dy) / event.height * height;
  } else {
    globalGame.socket.send(['dragging', event.target.innerHTML,
			    parseInt(event.dx), parseInt(event.dy),
			    width, height].join('.'));
  }
  
  var target = event.target,
      // keep the dragged position in the data-x/data-y attributes
      x = (parseFloat(target.getAttribute('data-x')) || 0) + parseFloat(event.dx),
      y = (parseFloat(target.getAttribute('data-y')) || 0) + parseFloat(event.dy);
  

  // translate the element
  target.style.webkitTransform =
    target.style.transform =
    'translate(' + x + 'px, ' + y + 'px)';

  // update the posiion attributes
  target.setAttribute('data-x', x);
  target.setAttribute('data-y', y);
}

function mouseClickListener(evt) {
  var bRect = globalGame.viewport.getBoundingClientRect();
  var mouseX = Math.floor((evt.clientX - bRect.left)*(globalGame.viewport.width/bRect.width));
  var mouseY = Math.floor((evt.clientY - bRect.top)*(globalGame.viewport.height/bRect.height));
  if (globalGame.messageSent) { // if message was not sent, don't do anything
    _.forEach(globalGame.objects, function(obj) {
      if (hitTest(obj, mouseX, mouseY)) {
	globalGame.messageSent = false;
	// Tell the server about it
        globalGame.socket.send(["clickedObj", obj.name].join('.'));
      }
    });
  };
};

function hitTest(shape,mx,my) {
  var dx = mx - shape.trueX;
  var dy = my - shape.trueY;
  return (0 < dx) && (dx < shape.width) && (0 < dy) && (dy < shape.height);
}
