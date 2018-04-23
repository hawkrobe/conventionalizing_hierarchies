// drawing.js
// This file contains functions to draw on the HTML5 canvas


function handleButton() {
  // Disable or enable button to fit logic
  if(globalGame.selections.length > 0) {
    $('#advance_button').removeAttr('disabled');
  } else {
    $('#advance_button').attr('disabled', 'disabled');
  }
}

function handleHighlighting(selector, name) {
  var alreadyClicked = _.includes(globalGame.selections, name);
  if(alreadyClicked) {
    _.remove(globalGame.selections, obj => obj == name);
    selector.css({'border-color' : 'black'});
  } else {
    globalGame.selections.push(selector.attr('data-name'));
    selector.css({'border-color' : 'grey'});
  }
}

function setupHandlers() {
  $('#context img').click(function(event) {
    var name = $(this).attr('data-name');
    if(globalGame.messageSent) {
      handleHighlighting($(this), name);
      handleButton();
    }
  });
}

function highlightCell(color, condition) {
  var targetObjects = _.filter(globalGame.objects, condition);
  for (var i = 0; i < targetObjects.length; i++){
    var name = targetObjects[i]['name'];
    $(`img[data-name="${name}"]`)
      .css({'border-color' : color});
  }
}

function initGrid(objects) {
  // Add objects to grid
  _.forEach(objects, (obj) => {
    console.log(obj);
    var gridX = obj['gridX'];
    var gridY = obj['gridY'];
    $("#context").append(
      $('<img/>').attr({
	height: "100%", width: "100%", src: obj.url, 'data-name' : obj.name, style :
	`grid-column: ${gridX}; grid-row: ${gridY}; border: 10px solid; border-color : black`
      })
    );
  });

  // Mark target(s) for speaker
  if (globalGame.my_role === globalGame.playerRoleNames.role1) {
    highlightCell('grey', x => x.targetStatus == 'target'); 
  }

  // Unbind old click listeners if they exist
  $('#context img')
    .off('click');

  // Allow listener to click on things
  if (globalGame.my_role === globalGame.playerRoleNames.role2) {
    globalGame.selections = [];
    setupHandlers(); 
  }
}

var drawScreen = function(game, player) {
  // Draw message in center (for countdown, e.g.)
  if (player.message) {
    $('waiting').text(player.message);
  //   game.ctx.font = "bold 40pt Helvetica";
  //   game.ctx.fillStyle = 'blue';
  //   game.ctx.textAlign = 'center';
  //   wrapText(game, player.message,
  //            game.world.width/2, game.world.height/4,
  //            game.world.width*4/5,
  //            50);
  // }
  } else {
    $('waiting').text('');
    initGrid(game.objects);
  }
};

function drawSketcherFeedback(globalGame, scoreDiff, clickedObjNames) {
  if (scoreDiff > 0) {
    // visual feedback
    highlightCell('#19A319', x => _.includes(clickedObjNames, x.name));
    setTimeout(() => {
      $('#feedback').html('Great job! Your partner correctly identified the target.');
    }, globalGame.feedbackDelay);
  } else {
    highlightCell('#C83232', x => _.includes(clickedObjNames, x.name));
    setTimeout(() => {
      $('#feedback').html('Too bad... Your partner thought the target was the object outlined in ' + 'red'.fontcolor('#C83232').bold() + '.');
    }, globalGame.feedbackDelay);
  }
};

function drawViewerFeedback(globalGame, scoreDiff, clickedObjNames) {
  // viewer feedback
  highlightCell('#000000', x => _.includes(clickedObjNames, x.name));
  if (scoreDiff > 0) {
    highlightCell('#19A319', x => x.targetStatus == 'target');
    setTimeout(() => {
      $('#feedback').html('Great job! You correctly identified the target!');
    }, globalGame.feedbackDelay);
  } else {
    highlightCell('#C83232', x => x.targetStatus == 'target');
    setTimeout(() => {
      $('#feedback').html('Sorry... The target was the object outlined in '
			  + 'red'.fontcolor("#C83232").bold() + '.');
    }, globalGame.feedbackDelay);
  }
};


function disableLabels(game) {
  interact('p').unset();
  interact('#chatarea').unset();
}

function enableLabels(game) {
  var labels = document.querySelector('#message_panel');
  var startPos = null;
  var dropCenter = null;
  interact('p', {context: labels})
    .draggable({
      restrict: {
      	restriction: "parent",
      	endOnly: true,
      	elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
      },
      onstart: function(event) {
      	var rect = interact.getElementRect(event.target);

      	// record center point when starting the very first a drag
      	startPos = {
          x: rect.left + rect.width  / 2,
          y: rect.top  + rect.height / 2
      	}

      	event.interactable.draggable({
          snap: {
            targets: [startPos]
          }
      	});
      },

      snap: {
        targets: [startPos],
        range: Infinity,
        relativePoints: [ { x: 0.5, y: 0.5 } ],
        endOnly: true
      },
      onmove: dragMoveListener
    });
  
  interact('#chatarea')
    .dropzone({
      accept: '.draggable',
      overlap: .5,
      ondragenter: function (event) {
	var draggableElement = event.relatedTarget,
            dropzoneElement  = event.target,
            dropRect         = interact.getElementRect(dropzoneElement);
	
        dropCenter = {
          x: dropRect.left + dropRect.width  / 2,
          y: dropRect.top  + dropRect.height / 2
        };
	
        event.draggable.draggable({
          snap: {
            targets: [dropCenter]
          }
        });
      },
      ondrop: function(event) {
	$('#chatarea').css('background-color', '#32CD32');
	var timeElapsed = new Date() - game.roundStartTime;
	game.socket.send('drop.' + event.relatedTarget.innerHTML + '.' + timeElapsed);
	interact('p', {context: labels}).draggable(false);
      }
    });
  
};

// This is a helper function to write a text string onto the HTML5 canvas.
// It automatically figures out how to break the text into lines that will fit
// Input:
//    * game: the game object (containing the ctx canvas object)
//    * text: the string of text you want to writ
//    * x: the x coordinate of the point you want to start writing at (in pixels)
//    * y: the y coordinate of the point you want to start writing at (in pixels)
//    * maxWidth: the maximum width you want to allow the text to span (in pixels)
//    * lineHeight: the vertical space you want between lines (in pixels)
function wrapText(game, text, x, y, maxWidth, lineHeight) {
  var cars = text.split("\n");
  game.ctx.fillStyle = 'white';
  game.ctx.fillRect(0, 0, game.viewport.width, game.viewport.height);
  game.ctx.fillStyle = 'red';

  for (var ii = 0; ii < cars.length; ii++) {

    var line = "";
    var words = cars[ii].split(" ");

    for (var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + " ";
      var metrics = game.ctx.measureText(testLine);
      var testWidth = metrics.width;

      if (testWidth > maxWidth) {
        game.ctx.fillText(line, x, y);
        line = words[n] + " ";
        y += lineHeight;
      }
      else {
        line = testLine;
      }
    }
    game.ctx.fillText(line, x, y);
    y += lineHeight;
  }
}
